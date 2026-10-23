mod background;
mod bible;
mod diagnostics;
mod download_task;
mod health;
mod hymn_import;
mod license_store;
mod media;
mod ppt;
mod ppt_cache;
mod projector_events;
mod queue_store;
mod setup_store;
mod songs;
mod youtube;

use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize)]
struct DisplayInfo {
    id: String,
    label: String,
    is_primary: bool,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Clone, Serialize)]
struct ProjectorContentSnapshot {
    revision: u64,
    payload: serde_json::Value,
}

struct ProjectorContentState(Mutex<ProjectorContentSnapshot>);

#[derive(Serialize)]
struct SuccessResult {
    success: bool,
}

#[derive(Serialize)]
struct QueueLoadResult {
    success: bool,
    found: bool,
    items: Vec<serde_json::Value>,
    error: Option<String>,
}

#[derive(Serialize)]
struct SetupTransferResult {
    success: bool,
    cancelled: bool,
    #[serde(rename = "backupDir")]
    backup_dir: String,
    #[serde(rename = "copiedCount")]
    copied_count: usize,
    #[serde(rename = "skippedCount")]
    skipped_count: usize,
    #[serde(rename = "totalBytes")]
    total_bytes: u64,
    warnings: Vec<String>,
    error: Option<String>,
}

fn queue_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("projector-queue.json"))
}

fn migrate_legacy_queue_if_needed(app: &AppHandle, queue_path: &Path) -> Result<(), String> {
    if queue_path.exists() {
        return Ok(());
    }
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if let Some(roaming_dir) = app_data_dir.parent() {
        for legacy_name in ["churchdisplay-pro", "churchdisplay-pro-dev"] {
            let legacy_path = roaming_dir.join(legacy_name).join("projector-queue.json");
            if legacy_path.is_file() {
                fs::copy(legacy_path, queue_path).map_err(|e| e.to_string())?;
                break;
            }
        }
    }
    Ok(())
}

fn copy_tree(
    source: &Path,
    target: &Path,
    overwrite: bool,
    counts: &mut (usize, usize, u64),
) -> Result<(), String> {
    for entry in fs::read_dir(source).map_err(|e| e.to_string())?.flatten() {
        let from = entry.path();
        let to = target.join(entry.file_name());
        if from.is_dir() {
            fs::create_dir_all(&to).map_err(|e| e.to_string())?;
            copy_tree(&from, &to, overwrite, counts)?;
        } else if overwrite || !to.exists() {
            fs::create_dir_all(target).map_err(|e| e.to_string())?;
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
            counts.0 += 1;
            counts.2 += fs::metadata(&from).map(|m| m.len()).unwrap_or(0);
        } else {
            counts.1 += 1;
        }
    }
    Ok(())
}

// Columns the song commands read, each with a constant default so SQLite can
// backfill existing rows. `ALTER TABLE ... ADD COLUMN` rejects a non-constant
// default, so timestamps use 0 here instead of the strftime default used at
// creation. `id` and `title` are deliberately absent: a table missing those is
// not a songs table, and failing loudly beats guessing.

#[tauri::command]
fn minimize_main_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or("Control window is unavailable.")?
        .minimize()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_maximize_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Control window is unavailable.")?;
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn close_main_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or("Control window is unavailable.")?
        .close()
        .map_err(|e| e.to_string())
}

// `%` and `_` are LIKE wildcards. Unescaped, a keyword containing either matches
// far more than the reader asked for, and a lone `%` scans every verse in the book.

fn monitors(app: &AppHandle) -> Result<Vec<tauri::Monitor>, String> {
    app.get_webview_window("main")
        .ok_or("Control window is unavailable.")?
        .available_monitors()
        .map_err(|error| error.to_string())
}

fn monitor_id(monitor: &tauri::Monitor) -> String {
    monitor
        .name()
        .cloned()
        .unwrap_or_else(|| format!("unnamed:{}:{}", monitor.position().x, monitor.position().y))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

#[tauri::command]
async fn get_displays(app: AppHandle) -> Result<Vec<DisplayInfo>, String> {
    static LAST_TOPOLOGY: Mutex<String> = Mutex::new(String::new());
    let current = monitors(&app)?;
    let topology = format!(
        "{:?}",
        current
            .iter()
            .map(|m| (m.position(), m.size(), m.scale_factor()))
            .collect::<Vec<_>>()
    );
    if let Ok(mut previous) = LAST_TOPOLOGY.lock() {
        if *previous != topology {
            *previous = topology;
            diagnostics::record(&app, "displays_changed");
        }
    }
    let primary = app
        .get_webview_window("main")
        .ok_or("Control window is unavailable.")?
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .map(|monitor| *monitor.position());
    current
        .into_iter()
        .map(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            Ok(DisplayInfo {
                id: monitor_id(&monitor),
                label: monitor
                    .name()
                    .cloned()
                    .unwrap_or_else(|| "Display".to_string()),
                is_primary: primary == Some(*position),
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            })
        })
        .collect()
}

#[tauri::command]
async fn show_projector(app: AppHandle, display_id: String) -> Result<(), String> {
    diagnostics::record(&app, "projector_requested");
    license_store::ensure_projection_access(&app)?;
    let monitor = monitors(&app)?
        .into_iter()
        .find(|monitor| monitor_id(monitor) == display_id)
        .ok_or("Selected display is unavailable.")?;
    let projector = app
        .get_webview_window("projector")
        .ok_or("Projector window is unavailable.")?;
    projector
        .set_fullscreen(false)
        .map_err(|error| error.to_string())?;
    projector
        .set_position(*monitor.position())
        .map_err(|error| error.to_string())?;
    projector
        .set_size(*monitor.size())
        .map_err(|error| error.to_string())?;
    projector.show().map_err(|error| error.to_string())?;
    projector
        .set_fullscreen(true)
        .map_err(|error| error.to_string())?;
    projector.set_focus().map_err(|error| error.to_string())?;
    diagnostics::record(&app, "projector_shown");
    Ok(())
}

#[tauri::command]
fn hide_projector(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("projector")
        .ok_or("Projector window is unavailable.")?
        .hide()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn queue_load(app: AppHandle) -> QueueLoadResult {
    let fail = |error: String| QueueLoadResult {
        success: false,
        found: true,
        items: vec![],
        error: Some(error),
    };
    let queue_path = match queue_file_path(&app) {
        Ok(path) => path,
        Err(error) => return fail(error),
    };
    if let Err(error) = migrate_legacy_queue_if_needed(&app, &queue_path) {
        return fail(error);
    }
    if !queue_path.is_file() {
        return QueueLoadResult {
            success: true,
            found: false,
            items: vec![],
            error: None,
        };
    }
    let raw = match fs::read_to_string(&queue_path) {
        Ok(raw) => raw,
        Err(error) => return fail(error.to_string()),
    };
    let items = match queue_store::parse_items(&raw) {
        Ok(items) => items,
        Err(error) => return fail(error.to_string()),
    };
    QueueLoadResult {
        success: true,
        found: true,
        items,
        error: None,
    }
}

#[tauri::command]
fn queue_save(app: AppHandle, items: Vec<serde_json::Value>) -> Result<SuccessResult, String> {
    let queue_path = queue_file_path(&app)?;
    queue_store::save_items(&queue_path, &items)?;
    Ok(SuccessResult { success: true })
}

#[tauri::command]
fn license_get_status(app: AppHandle) -> Result<license_store::Status, String> {
    license_store::status(&app)
}

#[tauri::command]
fn license_get_device_id() -> Result<license_store::DeviceIdResult, String> {
    Ok(license_store::DeviceIdResult {
        success: true,
        device_id: license_store::device_id()?,
    })
}

#[tauri::command]
fn license_activate(app: AppHandle, license_key: String) -> Result<license_store::Action, String> {
    license_store::activate(&app, license_key)
}

#[tauri::command]
fn license_clear(app: AppHandle) -> Result<license_store::Action, String> {
    license_store::clear(&app)
}

#[tauri::command]
fn legal_accept_eula(app: AppHandle) -> Result<license_store::Action, String> {
    license_store::accept_eula(&app)
}

#[tauri::command]
fn legal_get_document(doc_type: String) -> Result<license_store::LegalDocument, String> {
    if doc_type != "eula" {
        return Err("Unsupported legal document.".into());
    }
    Ok(license_store::LegalDocument {
        success: true,
        text: license_store::eula(),
    })
}

#[tauri::command]
fn send_to_projector(app: AppHandle, payload: serde_json::Value) -> Result<(), String> {
    license_store::ensure_projection_access(&app)?;
    let snapshot = {
        let state = app.state::<ProjectorContentState>();
        let mut content = state
            .0
            .lock()
            .map_err(|_| "Projector state is unavailable.")?;
        content.revision = content.revision.saturating_add(1);
        content.payload = payload;
        content.clone()
    };
    app.emit_to("projector", "projector-content", snapshot)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_projector_content(app: AppHandle) -> Result<ProjectorContentSnapshot, String> {
    app.state::<ProjectorContentState>()
        .0
        .lock()
        .map(|content| content.clone())
        .map_err(|_| "Projector state is unavailable.".to_string())
}

#[tauri::command]
fn send_projector_transition(
    app: AppHandle,
    payload: projector_events::ProjectorTransition,
) -> Result<(), String> {
    license_store::ensure_projection_access(&app)?;
    payload.validate()?;
    app.emit_to("projector", "projector-transition", payload)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn send_projector_media_command(
    app: AppHandle,
    payload: projector_events::ProjectorMediaCommand,
) -> Result<(), String> {
    license_store::ensure_projection_access(&app)?;
    payload.validate()?;
    app.emit_to("projector", "projector-media-command", payload)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn export_setup_bundle(app: AppHandle, folder: String) -> SetupTransferResult {
    let fail = |error| SetupTransferResult {
        success: false,
        cancelled: false,
        backup_dir: String::new(),
        copied_count: 0,
        skipped_count: 0,
        total_bytes: 0,
        warnings: vec![],
        error: Some(error),
    };
    let data = match app.path().app_data_dir() {
        Ok(path) => path,
        Err(error) => return fail(error.to_string()),
    };
    let target = PathBuf::from(folder).join(format!(
        "churchdisplay-pro-export-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    ));
    if let Err(error) = fs::create_dir_all(&target) {
        return fail(error.to_string());
    }
    let mut counts = (0, 0, 0);
    for name in ["projector-queue.json", "songs.db"] {
        let source = data.join(name);
        if source.is_file() {
            if let Err(error) = fs::copy(&source, target.join(name)) {
                return fail(error.to_string());
            }
            counts.0 += 1;
            counts.2 += fs::metadata(source).map(|m| m.len()).unwrap_or(0);
        }
    }
    let media = data.join("media");
    if media.is_dir() {
        if let Err(error) = copy_tree(&media, &target.join("media"), true, &mut counts) {
            return fail(error);
        }
    }
    SetupTransferResult {
        success: true,
        cancelled: false,
        backup_dir: target.to_string_lossy().into_owned(),
        copied_count: counts.0,
        skipped_count: counts.1,
        total_bytes: counts.2,
        warnings: vec![],
        error: None,
    }
}

#[tauri::command]
fn import_setup_bundle(app: AppHandle, folder: String) -> SetupTransferResult {
    let fail = |error| SetupTransferResult {
        success: false,
        cancelled: false,
        backup_dir: String::new(),
        copied_count: 0,
        skipped_count: 0,
        total_bytes: 0,
        warnings: vec![],
        error: Some(error),
    };
    let source = PathBuf::from(folder);
    let data = match app.path().app_data_dir() {
        Ok(path) => path,
        Err(error) => return fail(error.to_string()),
    };
    if !source.is_dir() {
        return fail("Selected backup folder is unavailable.".to_string());
    }
    if let Err(error) = setup_store::validate_import(&source) {
        return fail(error);
    }
    let mut counts = (0, 0, 0);
    for name in setup_store::CORE_FILES {
        let from = source.join(name);
        if from.is_file() {
            if let Err(error) = setup_store::replace_file(&from, &data.join(name)) {
                return fail(error.to_string());
            }
            counts.0 += 1;
            counts.2 += fs::metadata(from).map(|m| m.len()).unwrap_or(0);
        }
    }
    let media = source.join("media");
    if media.is_dir() {
        if let Err(error) = copy_tree(&media, &data.join("media"), false, &mut counts) {
            return fail(error);
        }
    }
    SetupTransferResult {
        success: true,
        cancelled: false,
        backup_dir: source.to_string_lossy().into_owned(),
        copied_count: counts.0,
        skipped_count: counts.1,
        total_bytes: counts.2,
        warnings: vec![],
        error: None,
    }
}

/// Records that a panic happened, so it stops being invisible. Without this a
/// panic in a command reaches the UI as a bare failure and leaves nothing
/// behind to look at afterwards.
///
/// The message and location go to the log only. A panic payload can carry file
/// paths or user content, and `diagnostics` is an exportable artifact that by
/// design holds fixed event names and timestamps alone, so it gets the event
/// name and nothing else.
fn install_panic_hook(app: AppHandle) {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log::error!("{info}");
        diagnostics::record(&app, "panic");
        previous(info);
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProjectorContentState(Mutex::new(
            ProjectorContentSnapshot {
                revision: 0,
                payload: serde_json::Value::Null,
            },
        )))
        // Must be registered before any other plugin. Two instances would
        // fight over the same external display, projector window and queue
        // file, which double-clicking the icon is enough to cause.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            diagnostics::record(app, "second_instance_blocked");
            if let Some(main) = app.get_webview_window("main") {
                // Show the running instance instead of silently doing nothing.
                let _ = main.unminimize();
                let _ = main.show();
                let _ = main.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                window.app_handle().exit(0);
            }
        })
        .setup(|app| {
            install_panic_hook(app.handle().clone());
            diagnostics::record(app.handle(), "app_started");
            #[cfg(debug_assertions)]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
                if let Some(main) = app.get_webview_window("main") {
                    main.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            youtube::cancel_youtube_download,
            youtube::begin_youtube_download,
            youtube::finish_youtube_download,
            diagnostics::export_diagnostics,
            bible::bible_get_books,
            bible::bible_get_verses,
            bible::bible_search,
            songs::songs_list,
            songs::songs_save,
            songs::songs_delete,
            songs::songs_web_site_search,
            songs::songs_web_fetch_lyrics,
            youtube::youtube_cache_download,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window,
            media::import_media_files,
            media::get_media_list,
            media::delete_media_file,
            ppt::convert_ppt,
            queue_load,
            queue_save,
            license_get_status,
            license_get_device_id,
            license_activate,
            license_clear,
            legal_accept_eula,
            legal_get_document,
            health::startup_health_check,
            get_displays,
            show_projector,
            hide_projector,
            send_to_projector,
            get_projector_content,
            send_projector_transition,
            send_projector_media_command,
            export_setup_bundle,
            import_setup_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
