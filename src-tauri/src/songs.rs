//! The song library: schema migration and the list, save, delete and web import
//! commands.

use crate::SuccessResult;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub(crate) struct Song {
    id: i64,
    title: String,
    author: String,
    lyrics: String,
    #[serde(rename = "backgroundType")]
    background_type: String,
    #[serde(rename = "backgroundPath")]
    background_path: String,
    #[serde(rename = "songStyle")]
    song_style: Option<serde_json::Value>,
    #[serde(rename = "createdAt")]
    created_at: i64,
    #[serde(rename = "updatedAt")]
    updated_at: i64,
}

#[derive(Deserialize)]
pub(crate) struct SongInput {
    id: Option<i64>,
    title: String,
    author: Option<String>,
    lyrics: String,
    #[serde(rename = "backgroundType")]
    background_type: Option<String>,
    #[serde(rename = "backgroundPath")]
    background_path: Option<String>,
    #[serde(rename = "songStyle")]
    song_style: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub(crate) struct SongSaveResult {
    success: bool,
    id: i64,
}

pub(crate) const SONGS_COLUMNS: [(&str, &str); 7] = [
    ("author", "TEXT DEFAULT ''"),
    ("lyrics", "TEXT NOT NULL DEFAULT ''"),
    ("background_type", "TEXT DEFAULT ''"),
    ("background_path", "TEXT DEFAULT ''"),
    ("style_json", "TEXT DEFAULT ''"),
    ("created_at", "INTEGER DEFAULT 0"),
    ("updated_at", "INTEGER DEFAULT 0"),
];

// A songs.db carried over from the Electron release predates later columns, and
// `CREATE TABLE IF NOT EXISTS` leaves an existing table untouched. Without this
// backfill the first `songs_list` fails with "no such column: style_json" and the
// whole song library becomes unreachable.
pub(crate) fn ensure_songs_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT DEFAULT '',
                lyrics TEXT NOT NULL,
                background_type TEXT DEFAULT '',
                background_path TEXT DEFAULT '',
                style_json TEXT DEFAULT '',
                created_at INTEGER DEFAULT (strftime('%s','now')),
                updated_at INTEGER DEFAULT (strftime('%s','now'))
            );",
        )
        .map_err(|e| e.to_string())?;
    let mut statement = connection
        .prepare("PRAGMA table_info(songs)")
        .map_err(|e| e.to_string())?;
    let existing = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;
    // Not a block: a `?` at the tail of one keeps a temporary holding the
    // statement's borrow alive past the block's own locals (E0597). Binding in a
    // plain `let` drops that temporary at the end of the statement instead.
    drop(statement);
    for (name, definition) in SONGS_COLUMNS {
        if existing.iter().any(|column| column.as_str() == name) {
            continue;
        }
        connection
            .execute_batch(&format!(
                "ALTER TABLE songs ADD COLUMN {name} {definition};"
            ))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) fn songs_database(app: &AppHandle) -> Result<Connection, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    let songs_path = app_data_dir.join("songs.db");

    // The Electron release stored songs under its product-name folder. Copy it
    // exactly once when this Tauri profile has not created a songs database yet.
    if !songs_path.exists() {
        if let Some(roaming_dir) = app_data_dir.parent() {
            for legacy_name in ["churchdisplay-pro", "churchdisplay-pro-dev"] {
                let legacy_path = roaming_dir.join(legacy_name).join("songs.db");
                if legacy_path.is_file() {
                    fs::copy(&legacy_path, &songs_path).map_err(|e| e.to_string())?;
                    break;
                }
            }
        }
    }

    let connection = Connection::open(songs_path).map_err(|e| e.to_string())?;
    ensure_songs_schema(&connection)?;
    Ok(connection)
}

#[tauri::command]
pub(crate) fn songs_list(app: AppHandle) -> Result<Vec<Song>, String> {
    let connection = songs_database(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT id, title, author, lyrics, background_type, background_path, style_json, created_at, updated_at
             FROM songs ORDER BY updated_at DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let style_json: Option<String> = row.get(6)?;
            Ok(Song {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                lyrics: row.get(3)?,
                background_type: row.get(4)?,
                background_path: row.get(5)?,
                song_style: style_json.and_then(|style| serde_json::from_str(&style).ok()),
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn songs_save(app: AppHandle, song: SongInput) -> Result<SongSaveResult, String> {
    if song.title.trim().is_empty() {
        return Err("Song title is required.".to_string());
    }
    let connection = songs_database(&app)?;
    let style_json = song
        .song_style
        .map(|style| style.to_string())
        .unwrap_or_default();
    let author = song.author.unwrap_or_default();
    let background_type = song.background_type.unwrap_or_default();
    let background_path = song.background_path.unwrap_or_default();
    let id = if let Some(id) = song.id {
        let updated = connection
            .execute(
                "UPDATE songs SET title=?1, author=?2, lyrics=?3, background_type=?4, background_path=?5,
                 style_json=?6, updated_at=strftime('%s','now') WHERE id=?7",
                rusqlite::params![song.title, author, song.lyrics, background_type, background_path, style_json, id],
            )
            .map_err(|e| e.to_string())?;
        // A zero-row update means the song was removed elsewhere. Reporting success
        // would tell the user their edit was stored when nothing was written.
        if updated == 0 {
            return Err("This song no longer exists; it may have been deleted.".to_string());
        }
        id
    } else {
        connection
            .execute(
                "INSERT INTO songs (title, author, lyrics, background_type, background_path, style_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![song.title, author, song.lyrics, background_type, background_path, style_json],
            )
            .map_err(|e| e.to_string())?;
        connection.last_insert_rowid()
    };
    Ok(SongSaveResult { success: true, id })
}

#[tauri::command]
pub(crate) fn songs_delete(app: AppHandle, song_id: i64) -> Result<SuccessResult, String> {
    let connection = songs_database(&app)?;
    connection
        .execute("DELETE FROM songs WHERE id=?1", rusqlite::params![song_id])
        .map_err(|e| e.to_string())?;
    Ok(SuccessResult { success: true })
}

#[tauri::command]
pub(crate) async fn songs_web_site_search(keyword: String) -> Vec<crate::hymn_import::HymnResult> {
    tauri::async_runtime::spawn_blocking(move || crate::hymn_import::search(keyword))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub(crate) async fn songs_web_fetch_lyrics(source_url: String) -> crate::hymn_import::LyricsResult {
    tauri::async_runtime::spawn_blocking(move || crate::hymn_import::lyrics(source_url))
        .await
        .unwrap_or(crate::hymn_import::LyricsResult {
            title: String::new(),
            lyrics: String::new(),
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Kept byte-identical to the statement `songs_list` prepares, so a column the
    // read path needs but the migration forgets fails this test rather than a user.
    const SONGS_LIST_QUERY: &str =
        "SELECT id, title, author, lyrics, background_type, background_path, style_json, created_at, updated_at
             FROM songs ORDER BY updated_at DESC, id DESC";

    #[test]
    fn a_legacy_songs_table_is_backfilled_so_the_song_list_query_runs() {
        let connection = Connection::open_in_memory().unwrap();
        // The shape an older Electron songs.db can have: no author, style or timestamps.
        connection
            .execute_batch(
                "CREATE TABLE songs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    lyrics TEXT NOT NULL
                );
                INSERT INTO songs (title, lyrics) VALUES ('Old Hymn', 'line one');",
            )
            .unwrap();
        assert!(
            connection.prepare(SONGS_LIST_QUERY).is_err(),
            "fixture should reproduce the missing-column failure"
        );

        ensure_songs_schema(&connection).unwrap();

        assert!(connection.prepare(SONGS_LIST_QUERY).is_ok());
        let (title, lyrics, style, updated): (String, String, String, i64) = connection
            .query_row(
                "SELECT title, lyrics, style_json, updated_at FROM songs WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(title, "Old Hymn");
        assert_eq!(lyrics, "line one");
        assert_eq!(style, "");
        assert_eq!(updated, 0);
    }

    #[test]
    fn ensuring_the_schema_again_adds_nothing_and_keeps_existing_songs() {
        let connection = Connection::open_in_memory().unwrap();
        ensure_songs_schema(&connection).unwrap();
        connection
            .execute(
                "INSERT INTO songs (title, lyrics, style_json) VALUES (?1, ?2, ?3)",
                rusqlite::params!["New", "body", r#"{"size":1}"#],
            )
            .unwrap();

        ensure_songs_schema(&connection).unwrap();

        let style: String = connection
            .query_row(
                "SELECT style_json FROM songs WHERE title = 'New'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(style, r#"{"size":1}"#);
        let columns: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('songs')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            columns,
            SONGS_COLUMNS.len() as i64 + 2,
            "id and title plus the backfilled set"
        );
    }
}
