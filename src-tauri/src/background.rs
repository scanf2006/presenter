#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    process::{Child, Command, ExitStatus},
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

pub fn terminate(child: &mut Child) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill.exe")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .creation_flags(0x08000000)
            .output();
    }
    let _ = child.kill();
    let _ = child.wait();
}

pub fn wait(
    child: &mut Child,
    timeout: Duration,
    cancel: &AtomicBool,
) -> Result<ExitStatus, String> {
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status),
            Err(_) => {
                terminate(child);
                return Err("Process wait failed.".into());
            }
            _ => {}
        }
        let cancelled = cancel.load(Ordering::Relaxed);
        if cancelled || start.elapsed() >= timeout {
            terminate(child);
            return Err(if cancelled {
                "Task cancelled."
            } else {
                "Task timed out."
            }
            .into());
        }
        thread::sleep(Duration::from_millis(50));
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    fn sleeper() -> Child {
        Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", "Start-Sleep -Seconds 30"])
            .creation_flags(0x08000000)
            .spawn()
            .unwrap()
    }
    #[test]
    fn timeout_reaps_child() {
        let mut child = sleeper();
        assert_eq!(
            wait(
                &mut child,
                Duration::from_millis(100),
                &AtomicBool::new(false)
            )
            .unwrap_err(),
            "Task timed out."
        );
        assert!(child.try_wait().unwrap().is_some());
    }
    #[test]
    fn cancellation_reaps_child() {
        let mut child = sleeper();
        assert_eq!(
            wait(&mut child, Duration::from_secs(30), &AtomicBool::new(true)).unwrap_err(),
            "Task cancelled."
        );
        assert!(child.try_wait().unwrap().is_some());
    }
}
