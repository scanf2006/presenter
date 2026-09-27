use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

#[derive(Default)]
pub struct Tasks {
    next: u64,
    active: Option<(u64, Arc<AtomicBool>)>,
}
impl Tasks {
    pub fn begin(&mut self) -> Result<u64, String> {
        if self.active.is_some() {
            return Err("A download is already running.".into());
        }
        self.next += 1;
        self.active = Some((self.next, Arc::new(AtomicBool::new(false))));
        Ok(self.next)
    }
    pub fn token(&self, id: u64) -> Result<Arc<AtomicBool>, String> {
        self.active
            .as_ref()
            .filter(|(key, _)| *key == id)
            .map(|(_, token)| token.clone())
            .ok_or("Download task unavailable.".into())
    }
    pub fn cancel(&self, id: u64) {
        if let Ok(token) = self.token(id) {
            token.store(true, Ordering::Relaxed);
        }
    }
    pub fn finish(&mut self, id: u64) {
        if self.active.as_ref().is_some_and(|(key, _)| *key == id) {
            self.cancel(id);
            self.active = None;
        }
    }
}
pub static TASKS: Mutex<Tasks> = Mutex::new(Tasks {
    next: 0,
    active: None,
});
pub struct Completion(pub u64);
impl Drop for Completion {
    fn drop(&mut self) {
        if let Ok(mut tasks) = TASKS.lock() {
            tasks.finish(self.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancel_before_worker_starts_is_preserved_and_does_not_cancel_next_task() {
        let mut tasks = Tasks::default();
        let first = tasks.begin().unwrap();
        tasks.cancel(first);
        assert!(tasks.token(first).unwrap().load(Ordering::Relaxed));
        assert!(tasks.begin().is_err());
        tasks.finish(first);
        let second = tasks.begin().unwrap();
        tasks.cancel(first);
        tasks.finish(first);
        assert!(!tasks.token(second).unwrap().load(Ordering::Relaxed));
    }
}
