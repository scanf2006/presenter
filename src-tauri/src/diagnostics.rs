use std::{
    fs,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

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
    let mut events: Vec<serde_json::Value> = fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
    events.push(serde_json::json!({"event":event,"timestamp":SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()}));
    if events.len() > 200 {
        events.drain(..events.len() - 200);
    }
    if let Ok(bytes) = serde_json::to_vec(&events) {
        let _ = fs::write(path, bytes);
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
    let raw: Vec<serde_json::Value> = fs::read(source)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
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
