use serde::{Deserialize, Serialize};
use serde_json::Value;

const MAX_TRANSITION_MS: f64 = 5_000.0;

#[derive(Clone, Deserialize, Serialize)]
pub struct ProjectorTransition {
    pub enabled: bool,
    #[serde(rename = "delayMs")]
    pub delay_ms: f64,
    #[serde(rename = "durationMs")]
    pub duration_ms: f64,
}

impl ProjectorTransition {
    pub fn validate(&self) -> Result<(), String> {
        for (name, value) in [("delayMs", self.delay_ms), ("durationMs", self.duration_ms)] {
            if !value.is_finite() || !(0.0..=MAX_TRANSITION_MS).contains(&value) {
                return Err(format!("{name} must be between 0 and {MAX_TRANSITION_MS}."));
            }
        }
        Ok(())
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaCommandType {
    Play,
    Pause,
    Seek,
    Mute,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ProjectorMediaCommand {
    #[serde(rename = "type")]
    command_type: MediaCommandType,
    value: Option<Value>,
}

impl ProjectorMediaCommand {
    pub fn validate(&self) -> Result<(), String> {
        match &self.command_type {
            MediaCommandType::Play | MediaCommandType::Pause => Ok(()),
            MediaCommandType::Seek => self
                .value
                .as_ref()
                .and_then(Value::as_f64)
                .filter(|value| value.is_finite() && *value >= 0.0)
                .map(|_| ())
                .ok_or("seek requires a non-negative numeric value.".to_string()),
            MediaCommandType::Mute => self
                .value
                .as_ref()
                .filter(|value| value.is_boolean())
                .map(|_| ())
                .ok_or("mute requires a boolean value.".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_transition_configuration() {
        let config: ProjectorTransition =
            serde_json::from_str(r#"{"enabled":true,"delayMs":20,"durationMs":60}"#)
                .expect("transition payload");
        assert!(config.validate().is_ok());
    }

    #[test]
    fn rejects_out_of_range_transition_configuration() {
        let config: ProjectorTransition =
            serde_json::from_str(r#"{"enabled":true,"delayMs":5001,"durationMs":60}"#)
                .expect("transition payload");
        assert!(config.validate().is_err());
    }

    #[test]
    fn only_accepts_known_media_commands_with_valid_values() {
        let seek: ProjectorMediaCommand =
            serde_json::from_str(r#"{"type":"seek","value":1.5}"#).expect("seek command");
        let invalid_mute: ProjectorMediaCommand =
            serde_json::from_str(r#"{"type":"mute","value":"yes"}"#).expect("mute command");

        assert!(seek.validate().is_ok());
        assert!(invalid_mute.validate().is_err());
        assert!(serde_json::from_str::<ProjectorMediaCommand>(r#"{"type":"stop"}"#).is_err());
    }
}
