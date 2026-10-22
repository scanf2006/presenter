//! The managed media library: import, listing, deletion and the paths and type
//! rules behind them.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub(crate) struct MediaFile {
    id: String,
    name: String,
    #[serde(rename = "type")]
    media_type: String,
    path: String,
    size: u64,
    #[serde(rename = "createdAt")]
    created_at: u128,
}

pub(crate) fn media_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("media");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

pub(crate) fn media_type_for_path(path: &Path) -> Option<&'static str> {
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

pub(crate) fn media_file(path: PathBuf, media_type: &str) -> Result<MediaFile, String> {
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

pub(crate) fn is_youtube_temporary_file(path: &Path) -> bool {
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

pub(crate) fn managed_media_path(app: &AppHandle, file_path: &str) -> Result<PathBuf, String> {
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

pub(crate) fn office_compatible_path(path: &Path) -> PathBuf {
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

#[tauri::command]
pub(crate) fn import_media_files(
    app: AppHandle,
    file_paths: Vec<String>,
) -> Result<Vec<MediaFile>, String> {
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
pub(crate) fn get_media_list(
    app: AppHandle,
    filter: Option<String>,
) -> Result<Vec<MediaFile>, String> {
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
pub(crate) fn delete_media_file(app: AppHandle, file_path: String) -> Result<(), String> {
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
