//! YouTube cache downloads: URL parsing, the bundled tool lookup and the
//! download command, including its single-flight reservation.

use crate::media::media_root;
use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader, Read};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub(crate) fn begin_youtube_download() -> Result<u64, String> {
    crate::download_task::TASKS
        .lock()
        .map_err(|_| "Download unavailable")?
        .begin()
}

#[tauri::command]
pub(crate) fn finish_youtube_download(task_id: u64) {
    if let Ok(mut tasks) = crate::download_task::TASKS.lock() {
        tasks.finish(task_id);
    }
}

#[tauri::command]
pub(crate) fn cancel_youtube_download(task_id: u64) {
    if let Ok(tasks) = crate::download_task::TASKS.lock() {
        tasks.cancel(task_id);
    }
}

#[derive(Serialize)]
pub(crate) struct YouTubeDownloadResult {
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

pub(crate) fn youtube_video_id(raw_url: &str) -> Result<String, String> {
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

pub(crate) fn youtube_tool_path(app: &AppHandle, name: &str) -> Option<PathBuf> {
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
    let installed = app
        .path()
        .app_data_dir()
        .ok()?
        .parent()?
        .join("churchdisplay-pro")
        .join("tools")
        .join(name);
    installed.is_file().then_some(installed)
}

#[tauri::command]
pub(crate) async fn youtube_cache_download(
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
        let _completion = crate::download_task::Completion(task_id);
        let token = match crate::download_task::TASKS
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
        crate::diagnostics::record(&app, "youtube_started");
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
        // Only the validated video id reaches the downloader. The host check above
        // accepts the user's original URL, which can still carry arbitrary query
        // parameters, so rebuild a canonical watch URL from the id instead.
        let canonical_url = format!("https://www.youtube.com/watch?v={video_id}");
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
        let mut child = match command
            .arg(&canonical_url)
            .creation_flags(0x08000000)
            .spawn()
        {
            Ok(child) => child,
            Err(error) => return fail(error.to_string()),
        };
        let _job = match crate::background::ProcessJob::attach(&mut child) {
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
        let outcome = crate::background::wait(&mut child, Duration::from_secs(30 * 60), &token);
        drop(_job);
        if let Some(reader) = progress {
            let _ = reader.join();
        }
        let status = match outcome {
            Ok(status) => status,
            Err(error) => {
                let _ = fs::remove_file(&output_path);
                crate::diagnostics::record(
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
            crate::diagnostics::record(&app, "youtube_failed");
            let _ = fs::remove_file(&output_path);
            return fail(if detail.is_empty() {
                "YouTube download failed.".to_string()
            } else {
                detail
            });
        }
        crate::diagnostics::record(&app, "youtube_completed");
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
