//! A Journey's memory, read from Mirror for the Journey memory panel.
//!
//! Mirror extracts memories from a Journey's Conversations and hands them to the agent when a
//! turn calls for them (`deliverMirrorContext`). The person never saw that list. The host answers
//! `listJourneyMemories` from the home's own `memories` table, newest first, and this passes on
//! exactly the fields the panel reads. Nothing here writes.

use serde_json::{json, Value};
use tauri::AppHandle;

pub(crate) const LIST_JOURNEY_MEMORIES_METHOD: &str = "listJourneyMemories";

/// Enough for a Journey in long use; the host says when the list was cut.
const MEMORY_LIMIT: u64 = 200;

const UNREADABLE: &str = "Mirror answered without this Journey's memories.";

/// The host's request for one Journey, by its exact id.
pub(crate) fn journey_memory_call(journey_id: &str) -> Value {
    json!({ "journeyId": journey_id, "limit": MEMORY_LIMIT })
}

/// What the panel reads of the host's answer: the Journey's id and each memory's id, kind, layer,
/// title, content, persona, conversation, date and readiness. A memory without the texts the panel
/// needs is left out rather than shown half; an answer without a list is refused in words.
pub(crate) fn journey_memory_answer(result: &Value) -> Result<Value, String> {
    let journey_id = result.get("journeyId").and_then(Value::as_str).filter(|id| !id.is_empty());
    let memories = result.get("memories").and_then(Value::as_array);
    let (Some(journey_id), Some(memories)) = (journey_id, memories) else {
        return Err(UNREADABLE.to_string());
    };
    let kept: Vec<Value> = memories.iter().filter_map(memory_entry).collect();
    Ok(json!({
        "journeyId": journey_id,
        "memories": kept,
        "truncated": result.get("truncated").and_then(Value::as_bool).unwrap_or(false),
    }))
}

fn memory_entry(memory: &Value) -> Option<Value> {
    let text = |key: &str| memory.get(key).and_then(Value::as_str);
    let optional = |key: &str| memory.get(key).and_then(Value::as_str).filter(|value| !value.is_empty());
    let id = text("id").filter(|id| !id.is_empty())?;
    Some(json!({
        "id": id,
        "memoryType": text("memoryType")?,
        "layer": text("layer").unwrap_or(""),
        "title": text("title")?,
        "content": text("content")?,
        "persona": optional("persona"),
        "conversationId": optional("conversationId"),
        "createdAt": text("createdAt")?,
        "readinessState": optional("readinessState"),
    }))
}

#[tauri::command(async)]
pub(crate) fn list_journey_memories(app: AppHandle, journey_id: String) -> Result<Value, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let journey_id = crate::sanitize_journey_id(&journey_id)?;
    let home = crate::mirror_host_bridge::active_home(&app)?;
    let result = crate::mirror_host_bridge::request_for(
        &app,
        &home,
        LIST_JOURNEY_MEMORIES_METHOD,
        json!({ "request": journey_memory_call(&journey_id) }),
    )
    .map_err(crate::mirror_host_bridge::describe_journey_refusal)?;
    journey_memory_answer(&result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory(id: &str) -> Value {
        json!({
            "id": id, "memoryType": "decision", "layer": "ego", "title": "Keep the slug", "content": "The slug is the id.",
            "persona": null, "conversationId": "conv-1", "createdAt": "2026-11-20T10:00:00Z", "readinessState": "observed", "embedding": [1, 2],
        })
    }

    #[test]
    fn a_read_names_one_journey_and_bounds_the_list() {
        assert_eq!(journey_memory_call("nautilus-windows"), json!({"journeyId": "nautilus-windows", "limit": 200}));
        assert_eq!(LIST_JOURNEY_MEMORIES_METHOD, "listJourneyMemories");
    }

    #[test]
    fn the_answer_keeps_what_the_panel_reads_and_nothing_else() {
        let answer = journey_memory_answer(&json!({"journeyId": "j", "memories": [memory("m-1")], "truncated": true, "counts": {"decision": 1}})).unwrap();
        assert_eq!(answer, json!({
            "journeyId": "j",
            "memories": [{
                "id": "m-1", "memoryType": "decision", "layer": "ego", "title": "Keep the slug", "content": "The slug is the id.",
                "persona": null, "conversationId": "conv-1", "createdAt": "2026-11-20T10:00:00Z", "readinessState": "observed",
            }],
            "truncated": true,
        }));
    }

    #[test]
    fn a_memory_missing_a_text_is_left_out_and_an_answer_without_a_list_is_refused() {
        let mut headless = memory("m-2");
        headless.as_object_mut().unwrap().remove("title");
        let answer = journey_memory_answer(&json!({"journeyId": "j", "memories": [memory("m-1"), headless, "text", {"id": ""}]})).unwrap();
        assert_eq!(answer["memories"].as_array().unwrap().len(), 1);
        assert_eq!(answer["truncated"], false);
        for bad in [json!(null), json!({"journeyId": "j"}), json!({"journeyId": "", "memories": []}), json!({"memories": []})] {
            assert_eq!(journey_memory_answer(&bad).unwrap_err(), UNREADABLE);
        }
    }

    #[test]
    fn the_command_serializes_then_checks_the_id_then_asks_the_host() {
        let source = include_str!("journey_memory.rs");
        let command = &source[source.find("pub(crate) fn list_journey_memories").unwrap()..source.find("#[cfg(test)]").unwrap()];
        assert!(command.find("native_command_serialization::acquire()").unwrap() < command.find("sanitize_journey_id").unwrap());
        assert!(command.find("sanitize_journey_id").unwrap() < command.find("request_for").unwrap());
    }
}
