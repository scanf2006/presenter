use std::{fs, path::Path};

fn count(path: &Path) -> Option<usize> {
    let raw = fs::read_to_string(path).ok()?;
    let count = raw.trim_start_matches('\u{feff}').trim().parse().ok()?;
    (count > 0 && count <= 10000).then_some(count)
}
fn valid_slides(dir: &Path, count: usize) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    let images = entries
        .filter_map(Result::ok)
        .filter(|entry| {
            matches!(
                entry.path().extension().and_then(|s| s.to_str()),
                Some("png" | "jpg" | "jpeg")
            )
        })
        .count();
    if images != count {
        return false;
    }
    (1..=count).all(|i| {
        fs::metadata(dir.join(format!("slide_{i:03}.png")))
            .is_ok_and(|m| m.is_file() && m.len() > 0)
    })
}
pub fn complete(dir: &Path) -> bool {
    count(&dir.join("complete.json")).is_some_and(|n| valid_slides(dir, n))
}
pub fn prepare(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
        let image = matches!(
            path.extension().and_then(|s| s.to_str()),
            Some("png" | "jpg" | "jpeg")
        );
        if path.is_file() && (image || name == "complete.json" || name == "expected-slides.json") {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
pub fn finish(dir: &Path, actual: usize) -> Result<(), String> {
    let expected =
        count(&dir.join("expected-slides.json")).ok_or("PowerPoint slide count unavailable.")?;
    if actual != expected || !valid_slides(dir, expected) {
        return Err("PowerPoint conversion is incomplete.".into());
    }
    fs::write(dir.join("complete.json"), expected.to_string()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn partial_output_cannot_be_reused_and_retry_removes_stale_slides() {
        let dir = std::env::temp_dir().join(format!(
            "presenter-ppt-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        prepare(&dir).unwrap();
        fs::write(dir.join("expected-slides.json"), "2").unwrap();
        fs::write(dir.join("slide_001.png"), b"image").unwrap();
        assert!(!complete(&dir));
        assert!(finish(&dir, 1).is_err());
        fs::write(dir.join("slide_002.png"), b"image").unwrap();
        finish(&dir, 2).unwrap();
        assert!(complete(&dir));
        fs::write(dir.join("complete.json"), "1").unwrap();
        assert!(!complete(&dir));
        finish(&dir, 2).unwrap();
        fs::write(dir.join("slide_002.png"), b"").unwrap();
        assert!(!complete(&dir));
        prepare(&dir).unwrap();
        assert!(!dir.join("slide_001.png").exists());
        assert!(!complete(&dir));
        fs::remove_dir(&dir).unwrap();
    }
}
