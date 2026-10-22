//! PowerPoint conversion: locating the bundled script, running it and collecting
//! the slides it produced.

use crate::media::{managed_media_path, media_root, office_compatible_path};
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub(crate) struct PptSlide {
    index: usize,
    path: String,
    name: String,
}

#[derive(Serialize)]
pub(crate) struct PptConvertResult {
    success: bool,
    slides: Vec<PptSlide>,
    #[serde(rename = "outputDir")]
    output_dir: String,
    #[serde(rename = "slideCount")]
    slide_count: usize,
    error: Option<String>,
}

pub(crate) fn ppt_script_path(app: &AppHandle) -> Result<PathBuf, String> {
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

pub(crate) fn collect_ppt_slides(output_dir: &Path) -> Vec<PptSlide> {
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
pub(crate) async fn convert_ppt(app: AppHandle, ppt_path: String) -> PptConvertResult {
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
        if !cached.is_empty() && crate::ppt_cache::complete(&output_dir) {
            return PptConvertResult {
                success: true,
                slide_count: cached.len(),
                slides: cached,
                output_dir: output_dir.to_string_lossy().into_owned(),
                error: None,
            };
        }
        if let Err(error) = crate::ppt_cache::prepare(&output_dir) {
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
        let _job = match crate::background::ProcessJob::attach(&mut child) {
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
        if let Err(error) =
            crate::background::wait_captured(&mut child, _job, Duration::from_secs(120))
        {
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
        if let Err(error) = crate::ppt_cache::finish(&output_dir, slides.len()) {
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
