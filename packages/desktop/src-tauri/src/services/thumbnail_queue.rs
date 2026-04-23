use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tokio::sync::{Notify, Semaphore};

pub type Key = (i64, String);

#[derive(Debug)]
pub struct QueueSlot {
    pub enqueued_at: Instant,
    pub cancel: Arc<AtomicBool>,
}

impl QueueSlot {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            enqueued_at: Instant::now(),
            cancel: Arc::new(AtomicBool::new(false)),
        })
    }
}

pub struct ThumbnailQueue {
    pending: Mutex<VecDeque<Key>>,
    active: Mutex<HashMap<Key, Arc<QueueSlot>>>,
    semaphore: Arc<Semaphore>,
    notify: Arc<Notify>,
}

pub enum EnqueueOutcome {
    New(Arc<QueueSlot>),
    AlreadyPending(Arc<QueueSlot>),
}

impl ThumbnailQueue {
    pub fn new(concurrency: usize) -> Arc<Self> {
        Arc::new(Self {
            pending: Mutex::new(VecDeque::new()),
            active: Mutex::new(HashMap::new()),
            semaphore: Arc::new(Semaphore::new(concurrency.max(1))),
            notify: Arc::new(Notify::new()),
        })
    }

    /// Register a thumbnail request.
    ///
    /// De-duplicates by `key`: if the slot already exists, its cancel flag is
    /// reset and it is moved to the back of the pending queue (most-recent).
    /// Returns the resulting `QueueSlot` (new or existing).
    pub fn enqueue(&self, key: Key) -> EnqueueOutcome {
        let mut active = self.active.lock().unwrap();
        if let Some(existing) = active.get(&key).cloned() {
            // Reset cancel flag — caller explicitly requested again.
            existing.cancel.store(false, Ordering::Release);
            // Ensure the key is in pending and at the back (most-recent LIFO
            // position). If it was canceled out, re-add it.
            let mut pending = self.pending.lock().unwrap();
            if let Some(pos) = pending.iter().position(|k| k == &key) {
                pending.remove(pos);
            }
            pending.push_back(key);
            drop(pending);
            self.notify.notify_one();
            return EnqueueOutcome::AlreadyPending(existing);
        }

        let slot = QueueSlot::new();
        active.insert(key.clone(), slot.clone());
        drop(active);

        let mut pending = self.pending.lock().unwrap();
        pending.push_back(key);
        drop(pending);

        self.notify.notify_one();
        EnqueueOutcome::New(slot)
    }

    /// Cancel a queued or in-flight request.
    ///
    /// Sets the slot's cancel flag and, if the key is still in the pending
    /// queue, removes it immediately so the worker never picks it up.
    pub fn cancel(&self, key: &Key) {
        let active = self.active.lock().unwrap();
        if let Some(slot) = active.get(key) {
            slot.cancel.store(true, Ordering::Release);
        }
        drop(active);

        let mut pending = self.pending.lock().unwrap();
        if let Some(pos) = pending.iter().position(|k| k == key) {
            pending.remove(pos);
        }
    }

    /// Pop the most-recently-enqueued pending key (LIFO).
    pub fn pop_lifo(&self) -> Option<Key> {
        let mut pending = self.pending.lock().unwrap();
        pending.pop_back()
    }

    pub fn slot_for(&self, key: &Key) -> Option<Arc<QueueSlot>> {
        self.active.lock().unwrap().get(key).cloned()
    }

    /// Called by the worker after emit/abort to release tracking state.
    pub fn complete(&self, key: &Key) {
        self.active.lock().unwrap().remove(key);
    }

    pub fn semaphore(&self) -> Arc<Semaphore> {
        self.semaphore.clone()
    }

    pub fn notify(&self) -> Arc<Notify> {
        self.notify.clone()
    }

    #[cfg(test)]
    pub fn pending_len(&self) -> usize {
        self.pending.lock().unwrap().len()
    }

    #[cfg(test)]
    pub fn active_len(&self) -> usize {
        self.active.lock().unwrap().len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn k(id: i64, p: &str) -> Key {
        (id, p.to_string())
    }

    #[test]
    fn enqueue_new_adds_to_pending() {
        let q = ThumbnailQueue::new(4);
        match q.enqueue(k(1, "a.jpg")) {
            EnqueueOutcome::New(_) => {}
            _ => panic!("expected New"),
        }
        assert_eq!(q.pending_len(), 1);
        assert_eq!(q.active_len(), 1);
    }

    #[test]
    fn enqueue_duplicate_is_deduped_and_bumped_to_back() {
        let q = ThumbnailQueue::new(4);
        q.enqueue(k(1, "a.jpg"));
        q.enqueue(k(2, "b.jpg"));
        q.enqueue(k(3, "c.jpg"));
        // Bump "a" back to the end (it was at the head of LIFO-pop perspective,
        // now we request it again — it should be the next to pop).
        match q.enqueue(k(1, "a.jpg")) {
            EnqueueOutcome::AlreadyPending(_) => {}
            _ => panic!("expected AlreadyPending"),
        }
        assert_eq!(q.pending_len(), 3);
        assert_eq!(q.active_len(), 3);
        assert_eq!(q.pop_lifo(), Some(k(1, "a.jpg")));
        assert_eq!(q.pop_lifo(), Some(k(3, "c.jpg")));
        assert_eq!(q.pop_lifo(), Some(k(2, "b.jpg")));
    }

    #[test]
    fn pop_lifo_returns_most_recent_first() {
        let q = ThumbnailQueue::new(4);
        q.enqueue(k(1, "a"));
        q.enqueue(k(1, "b"));
        q.enqueue(k(1, "c"));
        q.enqueue(k(1, "d"));
        q.enqueue(k(1, "e"));
        assert_eq!(q.pop_lifo(), Some(k(1, "e")));
        assert_eq!(q.pop_lifo(), Some(k(1, "d")));
        assert_eq!(q.pop_lifo(), Some(k(1, "c")));
        assert_eq!(q.pop_lifo(), Some(k(1, "b")));
        assert_eq!(q.pop_lifo(), Some(k(1, "a")));
        assert_eq!(q.pop_lifo(), None);
    }

    #[test]
    fn cancel_pending_removes_and_sets_flag() {
        let q = ThumbnailQueue::new(4);
        let slot = match q.enqueue(k(1, "a.jpg")) {
            EnqueueOutcome::New(s) => s,
            _ => unreachable!(),
        };
        q.cancel(&k(1, "a.jpg"));
        assert!(slot.cancel.load(Ordering::Acquire));
        assert_eq!(q.pending_len(), 0);
        // Slot is still tracked until the worker completes it.
        assert_eq!(q.active_len(), 1);
        q.complete(&k(1, "a.jpg"));
        assert_eq!(q.active_len(), 0);
    }

    #[test]
    fn cancel_unknown_key_is_noop() {
        let q = ThumbnailQueue::new(4);
        q.cancel(&k(99, "nope.jpg")); // no panic, no effect
        assert_eq!(q.pending_len(), 0);
    }

    #[test]
    fn semaphore_permit_count_matches_concurrency() {
        let q = ThumbnailQueue::new(4);
        assert_eq!(q.semaphore().available_permits(), 4);
    }

    #[test]
    fn re_enqueue_after_cancel_resets_flag() {
        let q = ThumbnailQueue::new(4);
        let slot1 = match q.enqueue(k(1, "a")) {
            EnqueueOutcome::New(s) => s,
            _ => unreachable!(),
        };
        q.cancel(&k(1, "a"));
        assert!(slot1.cancel.load(Ordering::Acquire));
        // Re-enqueue returns the same slot with flag cleared.
        let slot2 = match q.enqueue(k(1, "a")) {
            EnqueueOutcome::AlreadyPending(s) => s,
            _ => panic!("expected AlreadyPending — slot is still tracked"),
        };
        assert!(!slot2.cancel.load(Ordering::Acquire));
        assert!(Arc::ptr_eq(&slot1, &slot2));
    }
}
