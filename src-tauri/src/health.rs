//! The startup health report: what is checked and how each result is recorded.

use crate::bible::bible_db_path;
use crate::media::media_root;
use crate::ppt::ppt_script_path;
use crate::{monitors, now_ms};
use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub(crate) struct HealthCheck {
    id: String,
    label: String,
    status: String,
    detail: String,
    action: String,
}

#[derive(Serialize)]
pub(crate) struct HealthSummary {
    #[serde(rename = "okCount")]
    ok_count: usize,
    #[serde(rename = "warnCount")]
    warn_count: usize,
    #[serde(rename = "errorCount")]
    error_count: usize,
}

#[derive(Serialize)]
pub(crate) struct StartupHealthReport {
    success: bool,
    #[serde(rename = "checkedAt")]
    checked_at: u64,
    host: String,
    #[serde(rename = "appVersion")]
    app_version: String,
    summary: HealthSummary,
    checks: Vec<HealthCheck>,
}

pub(crate) fn push_health_check(
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

pub(crate) fn directory_is_writable(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| error.to_string())?;
    let probe = path.join(format!(".health-{}-{}.tmp", std::process::id(), now_ms()));
    fs::write(&probe, b"ok").map_err(|error| error.to_string())?;
    fs::remove_file(probe).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn startup_health_check(app: AppHandle) -> StartupHealthReport {
    crate::diagnostics::record(&app, "health_checked");
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
