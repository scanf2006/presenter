use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rsa::{
    pkcs1v15::{Signature, VerifyingKey},
    pkcs8::DecodePublicKey,
    signature::Verifier,
    RsaPublicKey,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Mutex, OnceLock},
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const PRODUCT: &str = "churchdisplay-pro";
const EULA_PEPPER: &str = "cdp-eula-proof-2026-04";
const TRIAL_DURATION_MS: u64 = 60 * 60 * 1000;
const PUBLIC_KEY: &str = concat!(
    "-----BEGIN PUBLIC KEY-----\n",
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1KEOk+gkfEDB8PUpJdIw\n",
    "cWNNgFmKCM3bN8bu/qb552GGDv/NzqrDIJw94B6yS6lcVHplTLS50gjjhnSCHnCm\n",
    "Hjs+Ml29NZObn1I5AfEKCBw80WIlQJtR790X4zAcG8SSxiWimqgenqIxAyrfzeAD\n",
    "PTRUzkCgdG0iQ7v3bFYWQLlUzmGhw8Y9e9ghG3ab4o1IKV6V4RD8upJr+ZqJodur\n",
    "GKdxr0gXYslQVBQvZkGx0AxVmkZ1YDfSUXWJQIMpZ4gSpUB88ZzlYIKqZeucOtOu\n",
    "CSomk0oMjuiZCFTo6GMdqlHEwHpGCwAwcjrFh0baPawrPSV512UAA5BfHQmEpGXc\n",
    "ywIDAQAB\n-----END PUBLIC KEY-----"
);

#[derive(Default, Serialize, Deserialize)]
struct Stored {
    #[serde(rename = "licenseKey")]
    key: String,
    #[serde(rename = "acceptedEulaAt")]
    accepted_at: Option<String>,
    #[serde(rename = "acceptedEulaProof")]
    proof: String,
    #[serde(rename = "trialConsumedMs")]
    trial_consumed_ms: u64,
}
struct TrialRuntime {
    base_consumed_ms: u64,
    last_persisted_ms: u64,
    started_at: Instant,
}

static TRIAL_RUNTIME: OnceLock<Mutex<TrialRuntime>> = OnceLock::new();
#[derive(Deserialize)]
struct Token {
    product: String,
    holder: Option<String>,
    #[serde(rename = "issuedAt")]
    issued_at: Option<String>,
    #[serde(rename = "expiresAt")]
    expires_at: Option<String>,
    #[serde(rename = "maxVersion")]
    max_version: Option<String>,
    #[serde(rename = "deviceId")]
    device_id: Option<String>,
    features: Option<Vec<String>>,
}
#[derive(Serialize)]
pub struct Status {
    #[serde(rename = "isLicensed")]
    is_licensed: bool,
    summary: String,
    license: Option<serde_json::Value>,
    #[serde(rename = "hasAcceptedEula")]
    has_accepted_eula: bool,
    #[serde(rename = "acceptedEulaAt")]
    accepted_at: Option<String>,
    error: Option<String>,
    trial: Option<serde_json::Value>,
}
#[derive(Serialize)]
pub struct Action {
    pub success: bool,
    pub status: Status,
    pub error: Option<String>,
}
#[derive(Serialize)]
pub struct DeviceIdResult {
    pub success: bool,
    #[serde(rename = "deviceId")]
    pub device_id: String,
}
#[derive(Serialize)]
pub struct LegalDocument {
    pub success: bool,
    pub text: String,
}

fn storage_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("license.json"))
}
fn load(path: &Path) -> Stored {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}
fn save(path: &Path, data: &Stored) -> Result<(), String> {
    fs::write(
        path,
        serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
fn load_with_legacy_migration(app: &AppHandle) -> Result<(PathBuf, Stored), String> {
    let path = storage_path(app)?;
    if path.is_file() {
        return Ok((path.clone(), load(&path)));
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let legacy = app_data_dir.parent().and_then(|roaming_dir| {
        ["churchdisplay-pro", "churchdisplay-pro-dev"]
            .into_iter()
            .map(|name| roaming_dir.join(name).join("app-settings.json"))
            .find(|candidate| candidate.is_file())
    });
    let data = legacy.as_deref().map(load).unwrap_or_default();
    if !data.key.is_empty() || data.accepted_at.is_some() || data.trial_consumed_ms > 0 {
        save(&path, &data)?;
    }
    Ok((path, data))
}
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}
fn format_duration_ms(ms: u64) -> String {
    let seconds = ms.div_ceil(1000);
    format!("{:02}:{:02}", seconds / 60, seconds % 60)
}
fn trial_status(app: &AppHandle, licensed: bool) -> serde_json::Value {
    if licensed {
        return serde_json::json!({
            "enabled": false, "active": false, "expired": false,
            "durationMs": TRIAL_DURATION_MS, "startedAtMs": null, "elapsedMs": 0,
            "remainingMs": null, "remainingLabel": null, "clockTampered": false,
            "message": "Licensed"
        });
    }

    let (path, persisted) = load_with_legacy_migration(app).ok().unzip();
    let persisted = persisted.unwrap_or_default();
    let runtime = TRIAL_RUNTIME.get_or_init(|| {
        Mutex::new(TrialRuntime {
            base_consumed_ms: persisted.trial_consumed_ms,
            last_persisted_ms: persisted.trial_consumed_ms,
            started_at: Instant::now(),
        })
    });
    let mut runtime = runtime.lock().expect("trial runtime lock");
    let elapsed_ms = runtime.base_consumed_ms.saturating_add(
        runtime
            .started_at
            .elapsed()
            .as_millis()
            .try_into()
            .unwrap_or(u64::MAX),
    );
    let consumed_ms = elapsed_ms.min(TRIAL_DURATION_MS);
    if consumed_ms.saturating_sub(runtime.last_persisted_ms) >= 1000
        || consumed_ms == TRIAL_DURATION_MS
    {
        if let Some(path) = path {
            let mut next = load(&path);
            next.trial_consumed_ms = consumed_ms;
            if save(&path, &next).is_ok() {
                runtime.base_consumed_ms = consumed_ms;
                runtime.last_persisted_ms = consumed_ms;
                runtime.started_at = Instant::now();
            }
        }
    }
    let remaining_ms = TRIAL_DURATION_MS.saturating_sub(consumed_ms);
    let expired = remaining_ms == 0;
    serde_json::json!({
        "enabled": true, "active": !expired, "expired": expired,
        "durationMs": TRIAL_DURATION_MS, "startedAtMs": now_ms().saturating_sub(consumed_ms),
        "elapsedMs": consumed_ms, "remainingMs": remaining_ms,
        "remainingLabel": format_duration_ms(remaining_ms), "clockTampered": false,
        "message": if expired { "Trial expired. Please activate license to continue projection." } else { "Trial active." }
    })
}
fn command(program: &str, args: &[&str]) -> String {
    let mut command = Command::new(program);
    command.args(args);
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());
    let Ok(mut child) = command.spawn() else {
        return String::new();
    };
    let stdout = child.stdout.take().unwrap();
    #[cfg(windows)]
    let Ok(_job) = crate::background::ProcessJob::attach(&mut child) else {
        return String::new();
    };
    let reader = std::thread::spawn(move || {
        use std::io::Read;
        let mut bytes = Vec::new();
        let _ = stdout.take(64 * 1024).read_to_end(&mut bytes);
        bytes
    });
    let result = crate::background::wait(
        &mut child,
        std::time::Duration::from_secs(5),
        &std::sync::atomic::AtomicBool::new(false),
    );
    #[cfg(windows)]
    drop(_job);
    let bytes = reader.join().unwrap_or_default();
    if result.is_ok_and(|status| status.success()) {
        String::from_utf8_lossy(&bytes).trim().into()
    } else {
        String::new()
    }
}

pub fn device_id() -> Result<String, String> {
    static CACHE: Mutex<Option<String>> = Mutex::new(None);
    let mut cache = CACHE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(id) = cache.as_ref() {
        return Ok(id.clone());
    }
    let guid_output = command(
        "reg",
        &[
            "query",
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography",
            "/v",
            "MachineGuid",
        ],
    );
    let cpu_output = command("wmic", &["cpu", "get", "Name", "/value"]);
    let guid = guid_output
        .lines()
        .find_map(|line| line.split("MachineGuid").nth(1))
        .and_then(|line| line.split_whitespace().last())
        .unwrap_or("");
    let cpu = cpu_output
        .lines()
        .find_map(|line| line.strip_prefix("Name="))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| {
            command(
                "powershell",
                &[
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name).Trim()",
                ],
            )
        });
    let id = identity_from_parts(guid, &cpu)?;
    *cache = Some(id.clone());
    Ok(id)
}

fn identity_from_parts(guid: &str, cpu: &str) -> Result<String, String> {
    if guid.trim().is_empty() || cpu.trim().is_empty() {
        return Err("Device information temporarily unavailable. Please retry.".into());
    }
    let digest = Sha256::digest(format!("{PRODUCT}|{guid}|win32-x64|{cpu}").as_bytes());
    let id = format!(
        "CDPDEV-{}",
        digest
            .iter()
            .take(12)
            .map(|value| format!("{value:02X}"))
            .collect::<String>()
    );
    Ok(id)
}

fn eula_proof(accepted_at: &str) -> Result<String, String> {
    Ok(Sha256::digest(
        format!("{PRODUCT}|v1|{}|{accepted_at}|{EULA_PEPPER}", device_id()?).as_bytes(),
    )
    .iter()
    .map(|value| format!("{value:02x}"))
    .collect())
}
fn version_cmp(left: &str, right: &str) -> std::cmp::Ordering {
    let parse = |value: &str| {
        value
            .split('.')
            .map(|part| part.parse::<u32>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    let (left, right) = (parse(left), parse(right));
    (0..left.len().max(right.len()))
        .map(|index| {
            left.get(index)
                .unwrap_or(&0)
                .cmp(right.get(index).unwrap_or(&0))
        })
        .find(|order| *order != std::cmp::Ordering::Equal)
        .unwrap_or(std::cmp::Ordering::Equal)
}

fn verify(key: &str, version: &str) -> Result<serde_json::Value, String> {
    let parts = key.trim().split('.').collect::<Vec<_>>();
    if parts.len() != 3 || parts[0] != "CDP1" {
        return Err("Invalid license key format.".into());
    }
    let raw = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|_| "Malformed license payload.")?;
    let token: Token = serde_json::from_slice(&raw).map_err(|_| "Malformed license payload.")?;
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(parts[2])
        .map_err(|_| "Malformed license signature.")?;
    let signature = Signature::try_from(signature_bytes.as_slice())
        .map_err(|_| "Malformed license signature.")?;
    let public = RsaPublicKey::from_public_key_pem(PUBLIC_KEY)
        .map_err(|_| "License public key is unavailable.")?;
    VerifyingKey::<Sha256>::new(public)
        .verify(format!("CDP1.{}", parts[1]).as_bytes(), &signature)
        .map_err(|_| "License signature verification failed.")?;
    validate_token(token, version, OffsetDateTime::now_utc(), device_id)
}

fn validate_token(
    token: Token,
    version: &str,
    now: OffsetDateTime,
    device: impl FnOnce() -> Result<String, String>,
) -> Result<serde_json::Value, String> {
    if token.product != PRODUCT {
        return Err("License product mismatch.".into());
    }
    if let Some(id) = token.device_id.as_deref().filter(|id| !id.is_empty()) {
        if id != device()? {
            return Err("License is bound to a different device.".into());
        }
    }
    if let Some(issued) = &token.issued_at {
        if OffsetDateTime::parse(issued, &Rfc3339)
            .ok()
            .is_some_and(|time| time > now)
        {
            return Err(
                "System clock appears to be set incorrectly (before license issue date).".into(),
            );
        }
    }
    if let Some(expiry) = &token.expires_at {
        if now
            > OffsetDateTime::parse(expiry, &Rfc3339)
                .map_err(|_| "License expiry date is invalid.")?
        {
            return Err("License has expired.".into());
        }
    }
    if token
        .max_version
        .as_deref()
        .is_some_and(|max| version_cmp(version, max).is_gt())
    {
        return Err(format!(
            "License is valid up to version {}, but current version is {version}.",
            token.max_version.unwrap()
        ));
    }
    Ok(
        serde_json::json!({ "product": token.product, "holder": token.holder.unwrap_or_else(|| "Unknown".into()), "issuedAt": token.issued_at, "expiresAt": token.expires_at, "features": token.features.unwrap_or_default(), "maxVersion": token.max_version }),
    )
}

pub fn status(app: &AppHandle) -> Result<Status, String> {
    let stored = load_with_legacy_migration(app)
        .ok()
        .map(|(_, data)| data)
        .unwrap_or_default();
    // An unavailable identity is not an invalid license; leave persisted state untouched.
    if stored.accepted_at.is_some() || !stored.key.is_empty() {
        device_id()?;
    }
    let accepted = match stored.accepted_at.as_ref() {
        Some(at) => stored.proof == eula_proof(at)?,
        None => false,
    };
    let version = app.package_info().version.to_string();
    let result = (!stored.key.trim().is_empty()).then(|| verify(&stored.key, &version));
    let licensed = matches!(result, Some(Ok(_)));
    let trial = Some(trial_status(app, licensed));
    Ok(match result {
        Some(Ok(license)) => Status {
            is_licensed: true,
            summary: license
                .get("holder")
                .and_then(|value| value.as_str())
                .unwrap_or("Unknown")
                .into(),
            license: Some(license),
            has_accepted_eula: accepted,
            accepted_at: stored.accepted_at,
            error: None,
            trial,
        },
        Some(Err(error)) => Status {
            is_licensed: false,
            summary: format!("Invalid license ({error})"),
            license: None,
            has_accepted_eula: accepted,
            accepted_at: stored.accepted_at,
            error: Some(error),
            trial,
        },
        None => Status {
            is_licensed: false,
            summary: "Unlicensed".into(),
            license: None,
            has_accepted_eula: accepted,
            accepted_at: stored.accepted_at,
            error: None,
            trial,
        },
    })
}

pub fn ensure_projection_access(app: &AppHandle) -> Result<(), String> {
    let current = status(app)?;
    current.projection_access()
}

impl Status {
    fn projection_access(&self) -> Result<(), String> {
        if self.is_licensed
            || !self.trial.as_ref().is_some_and(|trial| {
                trial
                    .get("expired")
                    .and_then(|value| value.as_bool())
                    .unwrap_or(false)
            })
        {
            return Ok(());
        }
        Err("Trial expired. Please activate license to continue projection.".into())
    }
}

pub fn accept_eula(app: &AppHandle) -> Result<Action, String> {
    let (path, mut data) = load_with_legacy_migration(app)?;
    let accepted_at = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|e| e.to_string())?;
    data.proof = eula_proof(&accepted_at)?;
    data.accepted_at = Some(accepted_at);
    save(&path, &data)?;
    Ok(Action {
        success: true,
        status: status(app)?,
        error: None,
    })
}
pub fn activate(app: &AppHandle, key: String) -> Result<Action, String> {
    let current = status(app)?;
    if !current.has_accepted_eula {
        return Ok(Action {
            success: false,
            status: current,
            error: Some("Please accept EULA before activation.".into()),
        });
    }
    if let Err(error) = verify(&key, &app.package_info().version.to_string()) {
        return Ok(Action {
            success: false,
            status: current,
            error: Some(error),
        });
    }
    let (path, mut data) = load_with_legacy_migration(app)?;
    data.key = key.trim().into();
    save(&path, &data)?;
    Ok(Action {
        success: true,
        status: status(app)?,
        error: None,
    })
}
pub fn clear(app: &AppHandle) -> Result<Action, String> {
    let (path, mut data) = load_with_legacy_migration(app)?;
    data.key.clear();
    data.accepted_at = None;
    data.proof.clear();
    save(&path, &data)?;
    Ok(Action {
        success: true,
        status: status(app)?,
        error: None,
    })
}
pub fn eula() -> String {
    include_str!("../../EULA.md").into()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn token(expiry: &str) -> Token {
        serde_json::from_value(serde_json::json!({"product":PRODUCT,"deviceId":"device","issuedAt":"2026-01-01T00:00:00Z","expiresAt":expiry,"maxVersion":"0.3.208"})).unwrap()
    }
    fn now() -> OffsetDateTime {
        OffsetDateTime::parse("2026-09-27T00:00:00Z", &Rfc3339).unwrap()
    }
    #[test]
    fn license_expiry_device_and_version_rules_are_enforced() {
        assert!(
            validate_token(token("2026-10-01T00:00:00Z"), "0.3.208", now(), || Ok(
                "device".into()
            ))
            .is_ok()
        );
        assert_eq!(
            validate_token(token("2026-09-26T00:00:00Z"), "0.3.208", now(), || Ok(
                "device".into()
            ))
            .unwrap_err(),
            "License has expired."
        );
        assert!(
            validate_token(token("2026-10-01T00:00:00Z"), "0.3.209", now(), || Ok(
                "device".into()
            ))
            .unwrap_err()
            .contains("up to version")
        );
        assert!(
            validate_token(token("2026-10-01T00:00:00Z"), "0.3.208", now(), || Ok(
                "different".into()
            ))
            .unwrap_err()
            .contains("different device")
        );
        assert_eq!(
            validate_token(token("2026-10-01T00:00:00Z"), "0.3.208", now(), || Err(
                "device unavailable".into()
            ))
            .unwrap_err(),
            "device unavailable"
        );
    }
    #[test]
    fn future_issue_and_invalid_signature_are_rejected() {
        let mut future = token("2026-10-01T00:00:00Z");
        future.issued_at = Some("2026-09-28T00:00:00Z".into());
        assert!(
            validate_token(future, "0.3.208", now(), || Ok("device".into()))
                .unwrap_err()
                .contains("before license issue")
        );
        let payload = URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(&serde_json::json!({"product":PRODUCT})).unwrap());
        let forged = format!("CDP1.{payload}.{}", URL_SAFE_NO_PAD.encode([0u8; 256]));
        assert!(verify(&forged, "0.3.208")
            .unwrap_err()
            .contains("signature verification failed"));
    }
    #[test]
    fn exhausted_trial_blocks_projection_but_a_license_allows_it() {
        let mut current = Status {
            is_licensed: false,
            summary: String::new(),
            license: None,
            has_accepted_eula: true,
            accepted_at: None,
            error: None,
            trial: Some(serde_json::json!({"expired":false})),
        };
        assert!(current.projection_access().is_ok());
        current.trial = Some(serde_json::json!({"expired":true}));
        assert!(current.projection_access().is_err());
        current.is_licensed = true;
        assert!(current.projection_access().is_ok());
    }
    #[test]
    fn missing_identity_is_an_error_and_complete_identity_is_stable() {
        assert!(identity_from_parts("", "CPU").is_err());
        assert!(identity_from_parts("GUID", " ").is_err());
        let expected = Sha256::digest(format!("{PRODUCT}|GUID|win32-x64|CPU").as_bytes());
        let expected = format!(
            "CDPDEV-{}",
            expected
                .iter()
                .take(12)
                .map(|v| format!("{v:02X}"))
                .collect::<String>()
        );
        assert_eq!(identity_from_parts("GUID", "CPU").unwrap(), expected);
    }
}
