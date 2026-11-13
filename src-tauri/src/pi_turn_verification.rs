//! CR157: a Pi-backed outbox item's text is checked against its Pi session once per settlement.
//!
//! CR126 made every outbox and journal step re-derive the turn from the whole Pi session and
//! compare it with the item. That is a fact about an append-only file Pi has stopped writing by the
//! time a settlement runs, yet each step paid for it again: about seven full reads of a session that
//! reaches hundreds of megabytes, under CR149's process-wide command lock.
//!
//! This module remembers a verdict, never a file: a claim that verified against the session as it
//! stood, keyed by the session's path, size and modification time. Only successes are remembered,
//! and any change to the file sends the next check back to a full read.

use serde_json::{json, Value};
use std::collections::VecDeque;
use std::fs;
use std::io;
use std::path::Path;
use std::sync::Mutex;
use std::time::SystemTime;

/// A settlement touches one item at a time; a handful covers several Journeys finishing together.
const REMEMBERED_VERDICTS: usize = 16;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct SessionStamp {
    len: u64,
    modified: SystemTime,
}

struct Verdict {
    session_file: String,
    stamp: SessionStamp,
    claim: String,
}

static VERDICTS: Mutex<VecDeque<Verdict>> = Mutex::new(VecDeque::new());

pub(crate) fn session_stamp(path: &Path) -> Option<SessionStamp> {
    let metadata = fs::metadata(path).ok()?;
    Some(SessionStamp { len: metadata.len(), modified: metadata.modified().ok()? })
}

/// Reads the session and returns the stamp it had throughout the read. The stamp is `None` when the
/// file changed while it was being read, so a torn read is never remembered.
pub(crate) fn read_stamped(path: &Path) -> io::Result<(Option<SessionStamp>, String)> {
    let before = session_stamp(path);
    let content = fs::read_to_string(path)?;
    let after = session_stamp(path);
    Ok((before.filter(|stamp| Some(stamp) == after.as_ref()), content))
}

/// Everything the CR126 comparison reads from the item, so a verdict covers exactly that claim.
pub(crate) fn claim(item: &Value) -> String {
    let text = |pointer: &str| item.pointer(pointer).cloned().unwrap_or(Value::Null);
    json!([
        text("/piSessionId"),
        text("/piUserEntryId"),
        text("/piAssistantEntryId"),
        text("/createdAt"),
        text("/messages/0/content"),
        text("/messages/0/createdAt"),
        text("/messages/1/content"),
        text("/messages/1/createdAt"),
    ]).to_string()
}

pub(crate) fn already_verified(session_file: &str, claim: &str) -> bool {
    let Some(current) = session_stamp(Path::new(session_file)) else { return false };
    let verdicts = VERDICTS.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    verdicts.iter().any(|verdict| {
        verdict.session_file == session_file && verdict.stamp == current && verdict.claim == claim
    })
}

pub(crate) fn remember(session_file: &str, stamp: SessionStamp, claim: String) {
    let mut verdicts = VERDICTS.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    verdicts.retain(|verdict| !(verdict.session_file == session_file && verdict.claim == claim));
    if verdicts.len() == REMEMBERED_VERDICTS {
        verdicts.pop_front();
    }
    verdicts.push_back(Verdict { session_file: session_file.to_string(), stamp, claim });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::path::PathBuf;

    fn session(name: &str, content: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("cr157-verdict-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("session.jsonl");
        fs::write(&path, content).unwrap();
        path
    }

    fn item(answer: &str) -> Value {
        json!({
            "piSessionId": "session-one", "piUserEntryId": "pi-user", "piAssistantEntryId": "pi-assistant",
            "createdAt": "2026-08-30T10:00:01Z",
            "messages": [
                { "content": "hello", "createdAt": "2026-08-30T10:00:00Z" },
                { "content": answer, "createdAt": "2026-08-30T10:00:01Z" },
            ],
        })
    }

    #[test]
    fn a_verdict_holds_while_the_session_is_unchanged() {
        let path = session("unchanged", "{}\n");
        let file = path.to_str().unwrap();
        let (stamp, _) = read_stamped(&path).unwrap();
        assert!(!already_verified(file, &claim(&item("hi"))));
        remember(file, stamp.unwrap(), claim(&item("hi")));
        assert!(already_verified(file, &claim(&item("hi"))));
    }

    #[test]
    fn a_verdict_covers_only_the_claim_it_verified() {
        let path = session("claim", "{}\n");
        let file = path.to_str().unwrap();
        remember(file, session_stamp(&path).unwrap(), claim(&item("hi")));
        assert!(!already_verified(file, &claim(&item("something else"))));
    }

    #[test]
    fn a_session_that_grew_is_verified_again() {
        let path = session("grew", "{}\n");
        let file = path.to_str().unwrap();
        remember(file, session_stamp(&path).unwrap(), claim(&item("hi")));
        OpenOptions::new().append(true).open(&path).unwrap().write_all(b"{}\n").unwrap();
        assert!(!already_verified(file, &claim(&item("hi"))));
    }

    #[test]
    fn a_session_that_disappeared_is_never_verified() {
        let path = session("gone", "{}\n");
        let file = path.to_str().unwrap();
        remember(file, session_stamp(&path).unwrap(), claim(&item("hi")));
        fs::remove_file(&path).unwrap();
        assert!(!already_verified(file, &claim(&item("hi"))));
    }

    #[test]
    fn the_remembered_verdicts_stay_bounded() {
        let path = session("bounded", "{}\n");
        let file = path.to_str().unwrap();
        let stamp = session_stamp(&path).unwrap();
        for index in 0..(REMEMBERED_VERDICTS * 2) {
            remember(file, stamp.clone(), claim(&item(&format!("answer {index}"))));
        }
        assert!(VERDICTS.lock().unwrap().len() <= REMEMBERED_VERDICTS);
        assert!(already_verified(file, &claim(&item(&format!("answer {}", REMEMBERED_VERDICTS * 2 - 1)))));
    }
}
