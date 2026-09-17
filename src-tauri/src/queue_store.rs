use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::Path};

pub const MAX_QUEUE_SIZE: usize = 500;
pub const MAX_QUEUE_BYTES: usize = 2 * 1024 * 1024;

#[derive(Deserialize)]
struct QueueEnvelope {
    items: Vec<Value>,
}

#[derive(Serialize)]
struct QueueEnvelopeForSave<'a> {
    #[serde(rename = "schemaVersion")]
    schema_version: u8,
    items: &'a [Value],
}

pub fn parse_items(raw: &str) -> Result<Vec<Value>, String> {
    let value: Value = serde_json::from_str(raw).map_err(|error| error.to_string())?;
    match value {
        Value::Array(items) => Ok(items),
        Value::Object(_) => serde_json::from_value::<QueueEnvelope>(value)
            .map(|envelope| envelope.items)
            .map_err(|error| format!("Invalid queue envelope: {error}")),
        _ => Err("Queue data must be an array or an object with an items array.".to_string()),
    }
}

pub fn save_items(queue_path: &Path, items: &[Value]) -> Result<(), String> {
    let items = if items.len() > MAX_QUEUE_SIZE {
        &items[..MAX_QUEUE_SIZE]
    } else {
        items
    };
    let json = serde_json::to_vec_pretty(&QueueEnvelopeForSave {
        schema_version: 2,
        items,
    })
    .map_err(|error| error.to_string())?;
    if json.len() > MAX_QUEUE_BYTES {
        return Err("Queue data exceeds maximum size.".to_string());
    }

    let temporary_path = queue_path.with_extension(format!("json.tmp.{}", std::process::id()));
    let backup_path = queue_path.with_extension("json.bak");
    fs::write(&temporary_path, json).map_err(|error| error.to_string())?;
    if queue_path.exists() {
        let _ = fs::remove_file(&backup_path);
        fs::rename(queue_path, &backup_path).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temporary_path, queue_path) {
        if backup_path.exists() {
            let _ = fs::rename(&backup_path, queue_path);
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

    fn temporary_queue_path() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("current time")
            .as_nanos();
        let directory = env::temp_dir().join(format!(
            "churchdisplay-queue-test-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("test directory");
        directory.join("projector-queue.json")
    }

    #[test]
    fn accepts_legacy_array_payload() {
        let items = parse_items(r#"[{"id":"legacy"}]"#).expect("legacy queue loads");
        assert_eq!(items.len(), 1);
    }

    #[test]
    fn rejects_invalid_envelopes_instead_of_treating_them_as_empty() {
        assert!(parse_items(r#"{"items":null}"#).is_err());
        assert!(parse_items(r#"{"unexpected":true}"#).is_err());
        assert!(parse_items(r#"true"#).is_err());
    }

    #[test]
    fn saves_a_versioned_envelope_and_replaces_previous_contents() {
        let path = temporary_queue_path();
        fs::write(&path, r#"[{"id":"old"}]"#).expect("old queue");
        let items = vec![serde_json::json!({"id": "new"})];

        save_items(&path, &items).expect("queue saves");

        assert_eq!(
            parse_items(&fs::read_to_string(&path).expect("saved queue"))
                .expect("saved queue parses"),
            items
        );
        assert!(!path.with_extension("json.bak").exists());
        fs::remove_dir_all(path.parent().expect("test directory")).expect("test cleanup");
    }
}
