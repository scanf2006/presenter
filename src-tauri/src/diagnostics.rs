use std::{
    fs,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

fn read_events(path: &std::path::Path) -> Result<Vec<serde_json::Value>, String> {
    let bytes = fs::read(path).map_err(|_| "Unable to read diagnostic log.".to_string())?;
    serde_json::from_slice(&bytes)
        .map_err(|_| "Diagnostic log is damaged; original file has been preserved.".into())
}

fn write_events(path: &std::path::Path, events: &[serde_json::Value]) -> Result<(), String> {
    use std::io::Write;
    let temporary = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(events).map_err(|e| e.to_string())?;
    let mut file = fs::File::create(&temporary).map_err(|e| e.to_string())?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    // Same-directory rename replaces the old file without truncating it first.
    fs::rename(temporary, path).map_err(|e| e.to_string())
}

static LOCK: Mutex<()> = Mutex::new(());

// Only fixed event names and timestamps are persisted; no paths, URLs or license data.
pub fn record(app: &AppHandle, event: &'static str) {
    let Ok(_guard) = LOCK.lock() else { return };
    let Ok(dir) = app.path().app_log_dir() else {
        return;
    };
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("diagnostics.json");
    let mut events = match read_events(&path) {
        Ok(events) => events,
        Err(_) if !path.exists() => Vec::new(),
        Err(error) => {
            log::warn!("{error}");
            return;
        }
    };
    events.push(serde_json::json!({"event":event,"timestamp":SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()}));
    if events.len() > 200 {
        events.drain(..events.len() - 200);
    }
    if write_events(&path, &events).is_err() {
        log::warn!("Unable to update diagnostic log.");
    }
}

#[tauri::command]
pub fn export_diagnostics(app: AppHandle, folder: String) -> Result<String, String> {
    let _guard = LOCK.lock().map_err(|_| "Diagnostics unavailable")?;
    let source = app
        .path()
        .app_log_dir()
        .map_err(|e| e.to_string())?
        .join("diagnostics.json");
    let raw = read_events(&source)?;
    let events = safe_events(&raw);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let target =
        std::path::Path::new(&folder).join(format!("presenter-diagnostics-{timestamp}.json"));
    let report =
        serde_json::json!({"version":app.package_info().version.to_string(),"events":events});
    fs::write(
        &target,
        serde_json::to_vec_pretty(&report).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

fn safe_events(raw: &[serde_json::Value]) -> Vec<serde_json::Value> {
    let allowed = [
        "app_started",
        "youtube_started",
        "youtube_completed",
        "youtube_failed",
        "youtube_cancelled_or_timed_out",
        "youtube_cancelled",
        "youtube_timed_out",
        "projector_requested",
        "projector_shown",
        "displays_changed",
        "health_checked",
    ];
    raw.iter()
        .filter_map(|item| {
            let event = item.get("event")?.as_str()?;
            if !allowed.contains(&event) {
                return None;
            }
            Some(serde_json::json!({"event":event,"timestamp":item.get("timestamp")?.as_u64()?}))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn interrupted_write_preserves_old_log_and_corruption_is_reported() {
        let dir = std::env::temp_dir().join(format!(
            "presenter-diagnostics-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&dir).unwrap();
        let path = dir.join("diagnostics.json");
        let old = vec![serde_json::json!({"event":"app_started","timestamp":1})];
        write_events(&path, &old).unwrap();
        fs::write(path.with_extension("json.tmp"), b"[").unwrap();
        assert_eq!(read_events(&path).unwrap(), old);
        write_events(&path, &[]).unwrap();
        assert!(read_events(&path).unwrap().is_empty());
        fs::write(&path, b"[").unwrap();
        assert!(read_events(&path).unwrap_err().contains("damaged"));
        assert_eq!(fs::read(&path).unwrap(), b"[");
        fs::remove_file(path).unwrap();
        fs::remove_dir(dir).unwrap();
    }
    #[test]
    fn export_discards_unknown_events_and_sensitive_fields() {
        let events = vec![
            serde_json::json!({"event":"app_started","timestamp":123,"license":"secret","path":"private"}),
            serde_json::json!({"event":"secret","timestamp":124}),
            serde_json::json!({"event":"youtube_failed","timestamp":"private"}),
        ];
        assert_eq!(
            safe_events(&events),
            vec![serde_json::json!({"event":"app_started","timestamp":123})]
        );
    }
}
