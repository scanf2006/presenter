use crate::queue_store;
use rusqlite::{Connection, OpenFlags};
use std::{fs, path::Path};

pub const CORE_FILES: [&str; 2] = ["projector-queue.json", "songs.db"];

pub fn validate_import(source: &Path) -> Result<(), String> {
    validate_optional_file(source, "projector-queue.json", |path| {
        let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
        queue_store::parse_items(&raw).map(|_| ())
    })?;
    validate_optional_file(source, "songs.db", validate_songs_database)
}

fn validate_optional_file(
    source: &Path,
    name: &str,
    validate: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<(), String> {
    let path = source.join(name);
    if !path.exists() {
        return Ok(());
    }
    if !path.is_file() {
        return Err(format!("Imported {name} is not a file."));
    }
    validate(&path).map_err(|error| format!("Invalid imported {name}: {error}"))
}

fn validate_songs_database(path: &Path) -> Result<(), String> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| error.to_string())?;
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if integrity != "ok" {
        return Err(format!("SQLite integrity check failed: {integrity}"));
    }
    let has_songs_table = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'songs')",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())?;
    if has_songs_table == 0 {
        return Err("Required songs table is missing.".to_string());
    }
    Ok(())
}

pub fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    let temporary_path = target.with_extension(format!("tmp.{}", std::process::id()));
    let backup_path = target.with_extension("import.bak");
    fs::copy(source, &temporary_path).map_err(|error| error.to_string())?;
    if target.exists() {
        let _ = fs::remove_file(&backup_path);
        fs::rename(target, &backup_path).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temporary_path, target) {
        if backup_path.exists() {
            let _ = fs::rename(&backup_path, target);
        }
        return Err(error.to_string());
    }
    let _ = fs::remove_file(backup_path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        env,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temporary_directory(name: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("current time")
            .as_nanos();
        let directory = env::temp_dir().join(format!(
            "churchdisplay-{name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("test directory");
        directory
    }

    #[test]
    fn rejects_invalid_queue_before_any_import_can_begin() {
        let source = temporary_directory("setup-invalid-queue");
        fs::write(source.join("projector-queue.json"), r#"{"items":null}"#)
            .expect("invalid queue fixture");

        assert!(validate_import(&source).is_err());
        fs::remove_dir_all(source).expect("test cleanup");
    }

    #[test]
    fn accepts_a_valid_queue_and_songs_database() {
        let source = temporary_directory("setup-valid");
        fs::write(source.join("projector-queue.json"), r#"{"items":[]}"#).expect("queue fixture");
        let database = Connection::open(source.join("songs.db")).expect("songs fixture");
        database
            .execute_batch("CREATE TABLE songs (id INTEGER PRIMARY KEY, title TEXT NOT NULL);")
            .expect("songs table");
        drop(database);

        assert!(validate_import(&source).is_ok());
        fs::remove_dir_all(source).expect("test cleanup");
    }

    #[test]
    fn replaces_existing_file_without_leaving_a_backup() {
        let source = temporary_directory("setup-replace-source");
        let target_directory = temporary_directory("setup-replace-target");
        let imported = source.join("projector-queue.json");
        let target = target_directory.join("projector-queue.json");
        fs::write(&imported, "new").expect("source fixture");
        fs::write(&target, "old").expect("target fixture");

        replace_file(&imported, &target).expect("replace succeeds");

        assert_eq!(fs::read_to_string(&target).expect("replaced file"), "new");
        assert!(!target.with_extension("import.bak").exists());
        fs::remove_dir_all(source).expect("source cleanup");
        fs::remove_dir_all(target_directory).expect("target cleanup");
    }
}
