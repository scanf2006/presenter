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

fn drain_tail(mut stream: impl std::io::Read + Send + 'static) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut tail = std::collections::VecDeque::new();
        let mut buffer = [0; 8192];
        loop {
            match stream.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    tail.extend(&buffer[..count]);
                    if tail.len() > 65536 {
                        tail.drain(..tail.len() - 65536);
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
        tail.into_iter().collect()
    })
}

#[cfg(windows)]
pub fn wait_captured(child: &mut Child, job: ProcessJob, timeout: Duration) -> Result<(), String> {
    let stdout = child.stdout.take().map(drain_tail);
    let stderr = child.stderr.take().map(drain_tail);
    let status = wait(child, timeout, &AtomicBool::new(false));
    drop(job);
    let collect = |reader: Option<thread::JoinHandle<Vec<u8>>>| {
        reader.and_then(|r| r.join().ok()).unwrap_or_default()
    };
    let output = collect(stdout);
    let errors = collect(stderr);
    let status = status?;
    if status.success() {
        return Ok(());
    }
    let detail = format!(
        "{}\n{}",
        String::from_utf8_lossy(&errors),
        String::from_utf8_lossy(&output)
    );
    Err(if detail.trim().is_empty() {
        format!("Conversion exited with {status}.")
    } else {
        detail.trim().to_string()
    })
}

// Non-inherited job handles are closed by Windows even when the app crashes.
#[cfg(windows)]
pub struct ProcessJob(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl ProcessJob {
    pub fn attach(child: &mut Child) -> Result<Self, String> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::JobObjects::*;
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle.is_null() {
                terminate(child);
                return Err("Unable to create process job.".into());
            }
            let job = Self(handle);
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _,
                std::mem::size_of_val(&limits) as u32,
            ) == 0
                || AssignProcessToJobObject(handle, child.as_raw_handle()) == 0
            {
                terminate(child);
                return Err("Unable to manage background process.".into());
            }
            Ok(job)
        }
    }
}
#[cfg(windows)]
impl Drop for ProcessJob {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn drains_large_stdout_and_stderr_without_blocking() {
        let mut child = Command::new("powershell.exe").args(["-NoProfile", "-Command", "[Console]::Out.Write(('x'*1024)*2048); [Console]::Error.Write(('y'*1024)*2048); [Console]::Error.Write('END'); exit 1"])
            .stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).creation_flags(0x08000000).spawn().unwrap();
        let job = ProcessJob::attach(&mut child).unwrap();
        let error = wait_captured(&mut child, job, Duration::from_secs(30)).unwrap_err();
        assert!(error.contains("END"));
        assert!(error.len() <= 131073);
        assert!(!error.contains("timed out"));
    }
    fn sleeper() -> Child {
        Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", "Start-Sleep -Seconds 30"])
            .creation_flags(0x08000000)
            .spawn()
            .unwrap()
    }
    #[test]
    fn closing_job_terminates_process() {
        let mut child = sleeper();
        let job = ProcessJob::attach(&mut child).unwrap();
        drop(job);
        let start = Instant::now();
        while child.try_wait().unwrap().is_none() {
            assert!(start.elapsed() < Duration::from_secs(5));
            thread::sleep(Duration::from_millis(20));
        }
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
