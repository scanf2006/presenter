//! Bible lookup: the bundled databases and the book, verse and search queries.

use rusqlite::Connection;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub(crate) struct BibleBook {
    sn: i64,
    #[serde(rename = "shortName")]
    short_name: String,
    #[serde(rename = "fullName")]
    full_name: String,
    #[serde(rename = "chapterCount")]
    chapter_count: i64,
    #[serde(rename = "isNewTestament")]
    is_new_testament: bool,
}

#[derive(Serialize)]
pub(crate) struct BibleVerse {
    verse: i64,
    text: String,
}

#[derive(Serialize)]
pub(crate) struct BibleSearchResult {
    #[serde(rename = "bookSN")]
    book_sn: i64,
    chapter: i64,
    verse: i64,
    text: String,
    #[serde(rename = "shortName")]
    short_name: String,
    #[serde(rename = "fullName")]
    full_name: String,
}

pub(crate) fn bible_db_path(app: &AppHandle, version: &str) -> Result<std::path::PathBuf, String> {
    let name = if version == "kjv" {
        "bible_kjv.db"
    } else {
        "bible_cuvs.db"
    };
    let path = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or("Project root is unavailable.")?
            .join("data")
            .join(name)
    } else {
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join(name)
    };
    if path.exists() {
        Ok(path)
    } else {
        Err(format!("Bible database is missing: {}", path.display()))
    }
}

#[tauri::command]
pub(crate) fn bible_get_books(app: AppHandle, version: String) -> Result<Vec<BibleBook>, String> {
    let db = Connection::open(bible_db_path(&app, &version)?).map_err(|e| e.to_string())?;
    let mut statement = db
        .prepare("SELECT SN, ShortName, FullName, ChapterNumber, NewOrOld FROM BibleID ORDER BY SN")
        .map_err(|e| e.to_string())?;
    let books = statement
        .query_map([], |row| {
            Ok(BibleBook {
                sn: row.get(0)?,
                short_name: row.get(1)?,
                full_name: row.get(2)?,
                chapter_count: row.get(3)?,
                is_new_testament: row.get::<_, i64>(4)? == 1,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(books)
}

#[tauri::command]
pub(crate) fn bible_get_verses(
    app: AppHandle,
    version: String,
    book_sn: i64,
    chapter: i64,
) -> Result<Vec<BibleVerse>, String> {
    let db = Connection::open(bible_db_path(&app, &version)?).map_err(|e| e.to_string())?;
    let mut statement = db.prepare("SELECT VerseSN, Lection FROM Bible WHERE VolumeSN = ?1 AND ChapterSN = ?2 ORDER BY VerseSN").map_err(|e| e.to_string())?;
    let verses = statement
        .query_map([book_sn, chapter], |row| {
            Ok(BibleVerse {
                verse: row.get(0)?,
                text: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(verses)
}

pub(crate) fn escape_like(keyword: &str) -> String {
    keyword
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

#[tauri::command]
pub(crate) fn bible_search(
    app: AppHandle,
    version: String,
    keyword: String,
) -> Result<Vec<BibleSearchResult>, String> {
    if keyword.trim().is_empty() {
        return Ok(Vec::new());
    }
    let db = Connection::open(bible_db_path(&app, &version)?).map_err(|e| e.to_string())?;
    let mut statement = db
        .prepare(
            "SELECT b.VolumeSN, b.ChapterSN, b.VerseSN, b.Lection, bi.ShortName, bi.FullName \
     FROM Bible b JOIN BibleID bi ON b.VolumeSN = bi.SN \
     WHERE b.Lection LIKE '%' || ?1 || '%' ESCAPE '\\' LIMIT 100",
        )
        .map_err(|e| e.to_string())?;
    let results = statement
        .query_map([escape_like(keyword.trim())], |row| {
            Ok(BibleSearchResult {
                book_sn: row.get(0)?,
                chapter: row.get(1)?,
                verse: row.get(2)?,
                text: row.get(3)?,
                short_name: row.get(4)?,
                full_name: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(results)
}
