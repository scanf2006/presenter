mod background;
mod diagnostics;
mod download_task;
mod hymn_import;
mod license_store;
mod ppt_cache;
mod projector_events;
mod queue_store;
mod setup_store;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
fn begin_youtube_download() -> Result<u64, String> {
    download_task::TASKS
        .lock()
        .map_err(|_| "Download unavailable")?
        .begin()
}
#[tauri::command]
fn finish_youtube_download(task_id: u64) {
    if let Ok(mut tasks) = download_task::TASKS.lock() {
        tasks.finish(task_id);
    }
}
#[tauri::command]
fn cancel_youtube_download(task_id: u64) {
    if let Ok(tasks) = download_task::TASKS.lock() {
        tasks.cancel(task_id);
    }
}

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

#[derive(Serialize)]
struct HealthCheck {
    id: String,
    label: String,
    status: String,
    detail: String,
    action: String,
}

#[derive(Serialize)]
struct HealthSummary {
    #[serde(rename = "okCount")]
    ok_count: usize,
    #[serde(rename = "warnCount")]
    warn_count: usize,
    #[serde(rename = "errorCount")]
    error_count: usize,
}

#[derive(Serialize)]
struct StartupHealthReport {
    success: bool,
    #[serde(rename = "checkedAt")]
    checked_at: u64,
    host: String,
    #[serde(rename = "appVersion")]
    app_version: String,
    summary: HealthSummary,
    checks: Vec<HealthCheck>,
}

#[derive(Clone, Serialize)]
struct ProjectorContentSnapshot {
    revision: u64,
    payload: serde_json::Value,
}

struct ProjectorContentState(Mutex<ProjectorContentSnapshot>);

#[derive(Serialize)]
struct BibleBook {
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
struct BibleVerse {
    verse: i64,
    text: String,
}

#[derive(Serialize)]
struct BibleSearchResult {
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

#[derive(Serialize)]
struct MediaFile {
    id: String,
    name: String,
    #[serde(rename = "type")]
    media_type: String,
    path: String,
    size: u64,
    #[serde(rename = "createdAt")]
    created_at: u128,
}

#[derive(Serialize)]
struct PptSlide {
    index: usize,
    path: String,
    name: String,
}

#[derive(Serialize)]
struct PptConvertResult {
    success: bool,
    slides: Vec<PptSlide>,
    #[serde(rename = "outputDir")]
    output_dir: String,
    #[serde(rename = "slideCount")]
    slide_count: usize,
    error: Option<String>,
}

#[derive(Serialize)]
struct Song {
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
struct SongInput {
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
struct SongSaveResult {
    success: bool,
    id: i64,
}

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

#[derive(Serialize)]
struct YouTubeDownloadResult {
    success: bool,
    #[serde(rename = "localPath")]
    local_path: String,
    title: String,
    #[serde(rename = "videoId")]
    video_id: String,
    #[serde(rename = "originalUrl")]
    original_url: String,
    reused: bool,
    error: Option<String>,
}

fn media_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("media");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
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

fn songs_database(app: &AppHandle) -> Result<Connection, String> {
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
    Ok(connection)
}

fn media_type_for_path(path: &Path) -> Option<&'static str> {
    match path
        .extension()?
        .to_string_lossy()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" => Some("image"),
        "mp4" | "webm" | "mkv" | "avi" | "mov" => Some("video"),
        "pdf" => Some("pdf"),
        "pptx" | "ppt" => Some("ppt"),
        _ => None,
    }
}

fn media_file(path: PathBuf, media_type: &str) -> Result<MediaFile, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let created_at = metadata
        .created()
        .or_else(|_| metadata.modified())
        .unwrap_or(UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    Ok(MediaFile {
        id: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .split_once('_')
            .map(|(_, name)| name.to_string())
            .unwrap_or_else(|| {
                path.file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned()
            }),
        media_type: media_type.to_string(),
        path: path.to_string_lossy().into_owned(),
        size: metadata.len(),
        created_at,
    })
}

fn is_youtube_temporary_file(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !name.starts_with("youtube_") {
        return false;
    }
    name.contains(".temp.")
        || name
            .rsplit('.')
            .nth(1)
            .map(|part| {
                part.starts_with('f')
                    && part.len() > 1
                    && part[1..]
                        .chars()
                        .all(|character| character.is_ascii_digit() || character == '-')
            })
            .unwrap_or(false)
}

fn managed_media_path(app: &AppHandle, file_path: &str) -> Result<PathBuf, String> {
    let root = media_root(app)?.canonicalize().map_err(|e| e.to_string())?;
    let path = PathBuf::from(file_path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if path.is_file() && path.starts_with(&root) {
        Ok(path)
    } else {
        Err("Media file is outside the managed media directory.".to_string())
    }
}

fn office_compatible_path(path: &Path) -> PathBuf {
    // std::fs::canonicalize adds a `\\?\` prefix on Windows. PowerPoint
    // treats that otherwise valid local path as an unsafe Internet source.
    let path = path.to_string_lossy();
    if let Some(unc_path) = path.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{unc_path}"))
    } else if let Some(local_path) = path.strip_prefix(r"\\?\") {
        PathBuf::from(local_path)
    } else {
        PathBuf::from(path.as_ref())
    }
}

fn youtube_video_id(raw_url: &str) -> Result<String, String> {
    let value = raw_url.trim();
    let (_, rest) = value.split_once("://").ok_or("Invalid YouTube URL.")?;
    let (host, path_and_query) = rest.split_once('/').unwrap_or((rest, ""));
    let host = host.to_ascii_lowercase();
    let id = if host == "youtu.be" || host == "www.youtu.be" {
        path_and_query.split(['/', '?']).next().unwrap_or("")
    } else if [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
    ]
    .contains(&host.as_str())
    {
        if let Some(short_path) = path_and_query.strip_prefix("shorts/") {
            short_path.split(['/', '?']).next().unwrap_or("")
        } else {
            path_and_query
                .split('?')
                .nth(1)
                .unwrap_or("")
                .split('&')
                .find_map(|part| part.strip_prefix("v="))
                .unwrap_or("")
        }
    } else {
        return Err("Only YouTube URLs are supported.".to_string());
    };
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Invalid YouTube video ID.".to_string());
    }
    Ok(id.to_string())
}

fn youtube_tool_path(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let bundled = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()?
            .join("vendor")
            .join("youtube-runtime")
            .join(name)
    } else {
        app.path()
            .resource_dir()
            .ok()?
            .join("youtube-runtime")
            .join(name)
    };
    if bundled.is_file() {
        return Some(bundled);
    }
    app.path()
        .app_data_dir()
        .ok()?
        .parent()?
        .join("churchdisplay-pro")
        .join("tools")
        .join(name)
        .is_file()
        .then(|| {
            app.path()
                .app_data_dir()
                .unwrap()
                .parent()
                .unwrap()
                .join("churchdisplay-pro")
                .join("tools")
                .join(name)
        })
}

#[tauri::command]
async fn youtube_cache_download(
    app: AppHandle,
    input_url: String,
    task_id: u64,
) -> YouTubeDownloadResult {
    tauri::async_runtime::spawn_blocking(move || {
        static DOWNLOAD_LOCK: Mutex<()> = Mutex::new(());
        let fail = |error: String| YouTubeDownloadResult {
            success: false,
            local_path: String::new(),
            title: String::new(),
            video_id: String::new(),
            original_url: input_url.clone(),
            reused: false,
            error: Some(error),
        };
        let Ok(_guard) = DOWNLOAD_LOCK.try_lock() else {
            return fail("A download is already running.".into());
        };
        let _completion = download_task::Completion(task_id);
        let token = match download_task::TASKS
            .lock()
            .ok()
            .and_then(|tasks| tasks.token(task_id).ok())
        {
            Some(token) => token,
            None => return fail("Download task unavailable.".into()),
        };
        if token.load(std::sync::atomic::Ordering::Relaxed) {
            return fail("Task cancelled.".into());
        }
        diagnostics::record(&app, "youtube_started");
        let video_id = match youtube_video_id(&input_url) {
            Ok(video_id) => video_id,
            Err(error) => return fail(error),
        };
        let output_path = match media_root(&app) {
            Ok(root) => root.join("video").join(format!("youtube_{video_id}.mp4")),
            Err(error) => return fail(error),
        };
        if fs::metadata(&output_path)
            .map(|meta| meta.len() >= 1024 * 100)
            .unwrap_or(false)
        {
            return YouTubeDownloadResult {
                success: true,
                local_path: output_path.to_string_lossy().into_owned(),
                title: "YouTube Video".to_string(),
                video_id,
                original_url: input_url,
                reused: true,
                error: None,
            };
        }
        let Some(ytdlp) = youtube_tool_path(&app, "yt-dlp.exe") else {
            return fail("yt-dlp runtime is unavailable.".to_string());
        };
        let mut command = Command::new(ytdlp);
        command.args([
            "--no-playlist",
            "--no-warnings",
            "--socket-timeout",
            "30",
            "--retries",
            "3",
            "--fragment-retries",
            "3",
            "--concurrent-fragments",
            "1",
            "-f",
            "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b[height<=720]",
            "--merge-output-format",
            "mp4",
            "--newline",
            "--progress-template",
            "download:PROGRESS:%(progress._percent_str)s",
            "--output",
        ]);
        command.arg(&output_path);
        if let Some(ffmpeg) = youtube_tool_path(&app, "ffmpeg.exe") {
            command.arg("--ffmpeg-location").arg(ffmpeg);
        }
        if let Some(deno) = youtube_tool_path(&app, "deno.exe") {
            command
                .arg("--js-runtimes")
                .arg(format!("deno:{}", deno.to_string_lossy()));
        }
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child = match command.arg(&input_url).creation_flags(0x08000000).spawn() {
            Ok(child) => child,
            Err(error) => return fail(error.to_string()),
        };
        let _job = match background::ProcessJob::attach(&mut child) {
            Ok(job) => job,
            Err(error) => return fail(error),
        };
        let stderr = child.stderr.take().map(|stream| {
            thread::spawn(move || {
                let mut detail = String::new();
                let _ = BufReader::new(stream).read_to_string(&mut detail);
                detail
            })
        });
        let progress_app = app.clone();
        let progress = child.stdout.take().map(|stdout| {
            thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    if let Some(raw_percent) = line.strip_prefix("PROGRESS:") {
                        let percent = raw_percent
                            .trim()
                            .trim_end_matches('%')
                            .trim()
                            .parse::<f64>()
                            .ok();
                        let _ = progress_app.emit(
                            "youtube-download-progress",
                            serde_json::json!({
                                "status": "downloading",
                                "percent": percent,
                            }),
                        );
                    }
                }
            })
        });
        let outcome = background::wait(&mut child, Duration::from_secs(30 * 60), &token);
        drop(_job);
        if let Some(reader) = progress {
            let _ = reader.join();
        }
        let status = match outcome {
            Ok(status) => status,
            Err(error) => {
                let _ = fs::remove_file(&output_path);
                diagnostics::record(
                    &app,
                    if error == "Task cancelled." {
                        "youtube_cancelled"
                    } else if error == "Task timed out." {
                        "youtube_timed_out"
                    } else {
                        "youtube_failed"
                    },
                );
                let _ = app.emit(
                    "youtube-download-progress",
                    serde_json::json!({"status":"error"}),
                );
                return fail(error);
            }
        };
        let detail = stderr
            .and_then(|reader| reader.join().ok())
            .unwrap_or_default()
            .trim()
            .to_string();
        if !status.success()
            || !fs::metadata(&output_path)
                .map(|meta| meta.len() >= 1024 * 100)
                .unwrap_or(false)
        {
            diagnostics::record(&app, "youtube_failed");
            let _ = fs::remove_file(&output_path);
            return fail(if detail.is_empty() {
                "YouTube download failed.".to_string()
            } else {
                detail
            });
        }
        diagnostics::record(&app, "youtube_completed");
        YouTubeDownloadResult {
            success: true,
            local_path: output_path.to_string_lossy().into_owned(),
            title: "YouTube Video".to_string(),
            video_id,
            original_url: input_url,
            reused: false,
            error: None,
        }
    })
    .await
    .unwrap_or_else(|error| YouTubeDownloadResult {
        success: false,
        local_path: String::new(),
        title: String::new(),
        video_id: String::new(),
        original_url: String::new(),
        reused: false,
        error: Some(error.to_string()),
    })
}

#[tauri::command]
fn songs_list(app: AppHandle) -> Result<Vec<Song>, String> {
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
fn songs_save(app: AppHandle, song: SongInput) -> Result<SongSaveResult, String> {
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
        connection
            .execute(
                "UPDATE songs SET title=?1, author=?2, lyrics=?3, background_type=?4, background_path=?5,
                 style_json=?6, updated_at=strftime('%s','now') WHERE id=?7",
                rusqlite::params![song.title, author, song.lyrics, background_type, background_path, style_json, id],
            )
            .map_err(|e| e.to_string())?;
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
fn songs_delete(app: AppHandle, song_id: i64) -> Result<SuccessResult, String> {
    let connection = songs_database(&app)?;
    connection
        .execute("DELETE FROM songs WHERE id=?1", rusqlite::params![song_id])
        .map_err(|e| e.to_string())?;
    Ok(SuccessResult { success: true })
}

#[tauri::command]
async fn songs_web_site_search(keyword: String) -> Vec<hymn_import::HymnResult> {
    tauri::async_runtime::spawn_blocking(move || hymn_import::search(keyword))
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn songs_web_fetch_lyrics(source_url: String) -> hymn_import::LyricsResult {
    tauri::async_runtime::spawn_blocking(move || hymn_import::lyrics(source_url))
        .await
        .unwrap_or(hymn_import::LyricsResult {
            title: String::new(),
            lyrics: String::new(),
        })
}

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

fn ppt_script_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("scripts")
            .join("ppt-convert.ps1")
    } else {
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("ppt-convert.ps1")
    };
    if path.is_file() {
        Ok(path)
    } else {
        Err("PPT conversion script is missing.".to_string())
    }
}

fn collect_ppt_slides(output_dir: &Path) -> Vec<PptSlide> {
    let Ok(entries) = fs::read_dir(output_dir) else {
        return Vec::new();
    };
    let mut paths = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && matches!(
                    path.extension()
                        .and_then(|extension| extension.to_str())
                        .map(|extension| extension.to_ascii_lowercase())
                        .as_deref(),
                    Some("png") | Some("jpg") | Some("jpeg")
                )
        })
        .collect::<Vec<_>>();
    paths.sort_by_key(|path| {
        path.file_name()
            .map(|name| name.to_string_lossy().into_owned())
    });
    paths
        .into_iter()
        .enumerate()
        .map(|(index, path)| PptSlide {
            index,
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            path: path.to_string_lossy().into_owned(),
        })
        .collect()
}

#[tauri::command]
fn import_media_files(app: AppHandle, file_paths: Vec<String>) -> Result<Vec<MediaFile>, String> {
    let root = media_root(&app)?;
    let mut imported = Vec::new();
    for source in file_paths {
        let source_path = PathBuf::from(source);
        if !source_path.is_file() {
            continue;
        }
        let Some(media_type) = media_type_for_path(&source_path) else {
            continue;
        };
        let target_dir = root.join(media_type);
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        let original_name = source_path
            .file_name()
            .ok_or("Selected file has no name.")?;
        let unique_name = format!(
            "{}_{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            original_name.to_string_lossy()
        );
        let target = target_dir.join(unique_name);
        fs::copy(&source_path, &target).map_err(|e| e.to_string())?;
        imported.push(media_file(target, media_type)?);
    }
    Ok(imported)
}

#[tauri::command]
fn get_media_list(app: AppHandle, filter: Option<String>) -> Result<Vec<MediaFile>, String> {
    let root = media_root(&app)?;
    let types: Vec<&str> = match filter.as_deref() {
        Some("image") => vec!["image"],
        Some("video") => vec!["video"],
        Some("pdf") => vec!["pdf"],
        Some("ppt") => vec!["ppt"],
        _ => vec!["image", "video", "pdf", "ppt"],
    };
    let mut files = Vec::new();
    for media_type in types {
        let directory = root.join(media_type);
        let Ok(entries) = fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && !is_youtube_temporary_file(&path) {
                files.push(media_file(path, media_type)?);
            }
        }
    }
    files.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(files)
}

#[tauri::command]
fn delete_media_file(app: AppHandle, file_path: String) -> Result<(), String> {
    let root = media_root(&app)?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let target = PathBuf::from(file_path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !target.starts_with(&root) || !target.is_file() {
        return Err("Media file is outside the managed media directory.".to_string());
    }
    fs::remove_file(target).map_err(|e| e.to_string())
}

#[tauri::command]
async fn convert_ppt(app: AppHandle, ppt_path: String) -> PptConvertResult {
    tauri::async_runtime::spawn_blocking(move || {
        static CONVERSION_LOCK: Mutex<()> = Mutex::new(());
        let _guard = CONVERSION_LOCK
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let source = match managed_media_path(&app, &ppt_path) {
            Ok(path) => path,
            Err(error) => {
                return PptConvertResult {
                    success: false,
                    slides: vec![],
                    output_dir: String::new(),
                    slide_count: 0,
                    error: Some(error),
                }
            }
        };
        let script = match ppt_script_path(&app) {
            Ok(path) => path,
            Err(error) => {
                return PptConvertResult {
                    success: false,
                    slides: vec![],
                    output_dir: String::new(),
                    slide_count: 0,
                    error: Some(error),
                }
            }
        };
        let mut hasher = DefaultHasher::new();
        source.hash(&mut hasher);
        fs::metadata(&source)
            .and_then(|metadata| metadata.modified())
            .unwrap_or(UNIX_EPOCH)
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .hash(&mut hasher);
        let output_dir = match media_root(&app) {
            Ok(root) => root
                .join("ppt")
                .join(format!("slides_{:x}", hasher.finish())),
            Err(error) => {
                return PptConvertResult {
                    success: false,
                    slides: vec![],
                    output_dir: String::new(),
                    slide_count: 0,
                    error: Some(error),
                }
            }
        };
        let cached = collect_ppt_slides(&output_dir);
        if !cached.is_empty() && ppt_cache::complete(&output_dir) {
            return PptConvertResult {
                success: true,
                slide_count: cached.len(),
                slides: cached,
                output_dir: output_dir.to_string_lossy().into_owned(),
                error: None,
            };
        }
        if let Err(error) = ppt_cache::prepare(&output_dir) {
            return PptConvertResult {
                success: false,
                slides: vec![],
                output_dir: output_dir.to_string_lossy().into_owned(),
                slide_count: 0,
                error: Some(error.to_string()),
            };
        }
        let mut child = match Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&script)
            .arg("-PptPath")
            .arg(office_compatible_path(&source))
            .arg("-OutputDir")
            .arg(&output_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            // Match Electron's windowsHide behavior so Office runs outside the WebView host console.
            .creation_flags(0x08000000)
            .spawn()
        {
            Ok(child) => child,
            Err(error) => {
                return PptConvertResult {
                    success: false,
                    slides: vec![],
                    output_dir: output_dir.to_string_lossy().into_owned(),
                    slide_count: 0,
                    error: Some(format!("Unable to start PowerPoint conversion: {error}")),
                }
            }
        };
        let _job = match background::ProcessJob::attach(&mut child) {
            Ok(job) => job,
            Err(error) => {
                return PptConvertResult {
                    success: false,
                    slides: vec![],
                    output_dir: output_dir.to_string_lossy().into_owned(),
                    slide_count: 0,
                    error: Some(error),
                }
            }
        };
        if let Err(error) = background::wait_captured(&mut child, _job, Duration::from_secs(120)) {
            return PptConvertResult {
                success: false,
                slides: vec![],
                output_dir: output_dir.to_string_lossy().into_owned(),
                slide_count: 0,
                error: Some(if error == "Task timed out." {
                    "TIMEOUT".into()
                } else {
                    error
                }),
            };
        }
        let slides = collect_ppt_slides(&output_dir);
        if let Err(error) = ppt_cache::finish(&output_dir, slides.len()) {
            PptConvertResult {
                success: false,
                slides: vec![],
                output_dir: output_dir.to_string_lossy().into_owned(),
                slide_count: 0,
                error: Some(error),
            }
        } else {
            PptConvertResult {
                success: true,
                slide_count: slides.len(),
                slides,
                output_dir: output_dir.to_string_lossy().into_owned(),
                error: None,
            }
        }
    })
    .await
    .unwrap_or_else(|error| PptConvertResult {
        success: false,
        slides: vec![],
        output_dir: String::new(),
        slide_count: 0,
        error: Some(error.to_string()),
    })
}

fn bible_db_path(app: &AppHandle, version: &str) -> Result<std::path::PathBuf, String> {
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
fn bible_get_books(app: AppHandle, version: String) -> Result<Vec<BibleBook>, String> {
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
fn bible_get_verses(
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

#[tauri::command]
fn bible_search(
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
     WHERE b.Lection LIKE '%' || ?1 || '%' LIMIT 100",
        )
        .map_err(|e| e.to_string())?;
    let results = statement
        .query_map([keyword.trim()], |row| {
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

fn push_health_check(
    checks: &mut Vec<HealthCheck>,
    id: &str,
    label: &str,
    status: &str,
    detail: impl Into<String>,
    action: impl Into<String>,
) {
    checks.push(HealthCheck {
        id: id.into(),
        label: label.into(),
        status: status.into(),
        detail: detail.into(),
        action: action.into(),
    });
}

fn directory_is_writable(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| error.to_string())?;
    let probe = path.join(format!(".health-{}-{}.tmp", std::process::id(), now_ms()));
    fs::write(&probe, b"ok").map_err(|error| error.to_string())?;
    fs::remove_file(probe).map_err(|error| error.to_string())
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
fn startup_health_check(app: AppHandle) -> StartupHealthReport {
    diagnostics::record(&app, "health_checked");
    let mut checks = Vec::new();
    match monitors(&app) {
        Ok(displays) if displays.len() > 1 => push_health_check(
            &mut checks,
            "display",
            "Display Detection",
            "ok",
            format!("{} displays detected.", displays.len()),
            "",
        ),
        Ok(displays) if displays.len() == 1 => push_health_check(
            &mut checks,
            "display",
            "Display Detection",
            "warn",
            "Only one display detected. External projector was not found.",
            "Connect and enable extended display for projector output.",
        ),
        Ok(_) => push_health_check(
            &mut checks,
            "display",
            "Display Detection",
            "error",
            "No display detected.",
            "Check graphics driver / monitor connection.",
        ),
        Err(error) => push_health_check(
            &mut checks,
            "display",
            "Display Detection",
            "error",
            error,
            "Check graphics driver / monitor connection.",
        ),
    }

    match media_root(&app) {
        Ok(path) => match directory_is_writable(&path) {
            Ok(()) => push_health_check(
                &mut checks,
                "mediaDir",
                "Media Directory",
                "ok",
                path.display().to_string(),
                "",
            ),
            Err(error) => push_health_check(
                &mut checks,
                "mediaDir",
                "Media Directory",
                "error",
                error,
                "Check folder permission or antivirus lock.",
            ),
        },
        Err(error) => push_health_check(
            &mut checks,
            "mediaDir",
            "Media Directory",
            "error",
            error,
            "Restart app or create media folder manually.",
        ),
    }

    match media_root(&app).map(|root| root.join("video")) {
        Ok(path) => match directory_is_writable(&path) {
            Ok(()) => push_health_check(
                &mut checks,
                "ytCache",
                "YouTube Cache",
                "ok",
                "Video cache directory is writable.",
                "",
            ),
            Err(error) => push_health_check(
                &mut checks,
                "ytCache",
                "YouTube Cache",
                "error",
                error,
                "Check folder permission or antivirus lock.",
            ),
        },
        Err(error) => push_health_check(
            &mut checks,
            "ytCache",
            "YouTube Cache",
            "error",
            error,
            "Create the media/video directory.",
        ),
    }

    match ppt_script_path(&app) {
        Ok(path) => push_health_check(
            &mut checks,
            "pptScript",
            "PPT Converter Script",
            "ok",
            path.display().to_string(),
            "",
        ),
        Err(error) => push_health_check(
            &mut checks,
            "pptScript",
            "PPT Converter Script",
            "error",
            error,
            "Reinstall the application to restore the bundled PPT converter.",
        ),
    }

    let cuvs = bible_db_path(&app, "cuvs");
    let kjv = bible_db_path(&app, "kjv");
    match (cuvs, kjv) {
        (Ok(cuvs), Ok(_)) => push_health_check(
            &mut checks,
            "bibleData",
            "Bible Data",
            "ok",
            cuvs.parent()
                .map(|path| path.display().to_string())
                .unwrap_or_default(),
            "",
        ),
        (Ok(_), Err(_)) | (Err(_), Ok(_)) => push_health_check(
            &mut checks,
            "bibleData",
            "Bible Data",
            "warn",
            "Partial Bible DB set found.",
            "Reinstall the application to restore Bible data.",
        ),
        (Err(error), Err(_)) => push_health_check(
            &mut checks,
            "bibleData",
            "Bible Data",
            "error",
            error,
            "Reinstall the application to restore Bible data.",
        ),
    }

    match app.path().app_data_dir().map_err(|error| error.to_string()) {
        Ok(path) => match directory_is_writable(&path) {
            Ok(()) => push_health_check(
                &mut checks,
                "songsDb",
                "Songs Database",
                "ok",
                path.join("songs.db").display().to_string(),
                "",
            ),
            Err(error) => push_health_check(
                &mut checks,
                "songsDb",
                "Songs Database",
                "error",
                error,
                "Check user-data folder permission.",
            ),
        },
        Err(error) => push_health_check(
            &mut checks,
            "songsDb",
            "Songs Database",
            "error",
            error,
            "Check user-data folder permission.",
        ),
    }

    let summary = checks.iter().fold(
        HealthSummary {
            ok_count: 0,
            warn_count: 0,
            error_count: 0,
        },
        |mut summary, check| {
            match check.status.as_str() {
                "error" => summary.error_count += 1,
                "warn" => summary.warn_count += 1,
                _ => summary.ok_count += 1,
            }
            summary
        },
    );
    StartupHealthReport {
        success: true,
        checked_at: now_ms(),
        host: std::env::var("COMPUTERNAME").unwrap_or_default(),
        app_version: app.package_info().version.to_string(),
        summary,
        checks,
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProjectorContentState(Mutex::new(
            ProjectorContentSnapshot {
                revision: 0,
                payload: serde_json::Value::Null,
            },
        )))
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                window.app_handle().exit(0);
            }
        })
        .setup(|app| {
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
            cancel_youtube_download,
            begin_youtube_download,
            finish_youtube_download,
            diagnostics::export_diagnostics,
            bible_get_books,
            bible_get_verses,
            bible_search,
            songs_list,
            songs_save,
            songs_delete,
            songs_web_site_search,
            songs_web_fetch_lyrics,
            youtube_cache_download,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window,
            import_media_files,
            get_media_list,
            delete_media_file,
            convert_ppt,
            queue_load,
            queue_save,
            license_get_status,
            license_get_device_id,
            license_activate,
            license_clear,
            legal_accept_eula,
            legal_get_document,
            startup_health_check,
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
