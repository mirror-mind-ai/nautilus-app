//! CR217: a persona read and edited through the Mirror host (Core CR205, mirror-mind 0.42.0).
//!
//! Nautilus never writes the identity table. The surface asks for one persona whole and sends
//! an edit as the fields it changes; the Core checks every value and names what it refuses.
//! This side checks only the request's shape, puts each refusal in the Navigator's words, and
//! keeps a saved name in `persona-names.json` (CR216), so the transcript shows it at once.

use crate::mirror_host::MirrorHostError;
use crate::mirror_context::is_persona_id;
use serde_json::{json, Value};
use tauri::AppHandle;

const PERSONA_MALFORMED: &str = "Persona request is malformed.";
const PERSONA_UNREADABLE: &str = "Mirror answered without the persona.";
pub(crate) const PERSONA_STALE_MESSAGE: &str = "This persona changed in Mirror after it was opened. Reopen it and try again.";
const WRITABLE: [&str; 4] = ["name", "prompt", "description", "routingKeywords"];

/// The core call's request for reading `persona`.
pub(crate) fn persona_read_call(persona: &str) -> Result<Value, String> {
    if !is_persona_id(persona) {
        return Err(PERSONA_MALFORMED.to_string());
    }
    Ok(json!({ "persona": persona }))
}

/// The core call's request for an edit: the persona, the `updatedAt` it was read at, and at
/// least one writable field. Values are the Core's to check.
pub(crate) fn persona_update_call(request: &Value) -> Result<Value, String> {
    let malformed = || PERSONA_MALFORMED.to_string();
    let fields = request.as_object().ok_or_else(malformed)?;
    let persona = fields.get("persona").and_then(Value::as_str).ok_or_else(malformed)?;
    let reading = fields.get("expectedUpdatedAt").and_then(Value::as_str).ok_or_else(malformed)?;
    if !is_persona_id(persona)
        || reading.is_empty()
        || fields.keys().any(|key| key != "persona" && key != "expectedUpdatedAt" && !WRITABLE.contains(&key.as_str()))
        || !fields.keys().any(|key| WRITABLE.contains(&key.as_str()))
    {
        return Err(malformed());
    }
    Ok(request.clone())
}

/// The persona as the Core answered it, when it is one.
pub(crate) fn persona_answer(result: Value) -> Result<Value, String> {
    let readable = result.get("id").and_then(Value::as_str).is_some_and(is_persona_id)
        && result.get("prompt").is_some_and(Value::is_string)
        && result.get("updatedAt").is_some_and(Value::is_string);
    if readable { Ok(result) } else { Err(PERSONA_UNREADABLE.to_string()) }
}

/// A persona refusal in the Navigator's words; any other failure as every host failure reads.
pub(crate) fn describe_persona_refusal(error: MirrorHostError) -> String {
    let MirrorHostError::Rejected { name, reason, .. } = &error else { return crate::mirror_host_bridge::describe(error) };
    if name != "PersonaCallRejectedError" {
        return crate::mirror_host_bridge::describe(error);
    }
    match reason.as_str() {
        "persona_changed" => PERSONA_STALE_MESSAGE.to_string(),
        "unknown_persona" => "Mirror no longer keeps this persona.".to_string(),
        "invalid_name" => "A persona's name must be 1 to 80 characters, on one line.".to_string(),
        "invalid_prompt" => "A persona's prompt cannot be empty.".to_string(),
        "invalid_description" => "A persona's description must be 1 to 2,000 characters, or empty to remove it.".to_string(),
        "invalid_routing_keywords" => "Routing keywords must be at most 200, each 1 to 80 characters, on one line.".to_string(),
        "metadata_unreadable" => {
            "Mirror cannot read this persona's details, so it changed none of them. Its prompt alone can still be saved.".to_string()
        }
        _ => "Mirror refused the persona change.".to_string(),
    }
}

#[tauri::command(async)]
pub(crate) fn read_persona(app: AppHandle, persona: String) -> Result<Value, String> {
    let call = persona_read_call(&persona)?;
    let home = crate::mirror_host_bridge::active_home(&app)?;
    let result = crate::mirror_host_bridge::request_for(&app, &home, "readPersona", json!({ "request": call }))
        .map_err(describe_persona_refusal)?;
    persona_answer(result)
}

#[tauri::command(async)]
pub(crate) fn update_persona(app: AppHandle, request: Value) -> Result<Value, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let call = persona_update_call(&request)?;
    let home = crate::mirror_host_bridge::active_home(&app)?;
    let result = crate::mirror_host_bridge::request_for(&app, &home, "updatePersona", json!({ "request": call }))
        .map_err(describe_persona_refusal)?;
    let persona = persona_answer(result)?;
    // CR216's rule: the kept name is the one the Core keeps now. A name that cannot be kept costs
    // only the transcript's label until the persona's next turn, never the saved edit.
    if let (Some(id), Ok(dir)) = (persona["id"].as_str(), crate::home_state::home_state_dir(&app)) {
        let _ = crate::mirror_context::remember_persona_name_in(&dir, id, persona["name"].as_str());
    }
    Ok(persona)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mirror_home::MarkedHome;
    use crate::mirror_host::{MirrorHost, MirrorHostConfig};
    use std::path::PathBuf;

    fn refused(reason: &str) -> MirrorHostError {
        MirrorHostError::Rejected { name: "PersonaCallRejectedError".into(), reason: reason.into(), message: reason.into() }
    }

    #[test]
    fn a_read_names_one_persona_id() {
        assert_eq!(persona_read_call("analista-sql").unwrap(), json!({"persona": "analista-sql"}));
        for persona in ["", "Analista", "../private", "a b", "ana_sql"] {
            assert_eq!(persona_read_call(persona).unwrap_err(), PERSONA_MALFORMED, "{persona}");
        }
    }

    #[test]
    fn an_edit_carries_its_persona_its_reading_and_only_the_fields_it_changes() {
        let request = json!({"persona": "coach", "expectedUpdatedAt": "t", "name": "Coach", "prompt": "p",
                             "description": null, "routingKeywords": ["a"]});
        assert_eq!(persona_update_call(&request).unwrap(), request);
        assert_eq!(
            persona_update_call(&json!({"persona": "coach", "expectedUpdatedAt": "t", "name": null})).unwrap(),
            json!({"persona": "coach", "expectedUpdatedAt": "t", "name": null})
        );
        for malformed in [
            json!({"persona": "coach", "expectedUpdatedAt": "t"}),
            json!({"persona": "coach", "name": "Coach"}),
            json!({"persona": "coach", "expectedUpdatedAt": "", "name": "Coach"}),
            json!({"persona": "Coach", "expectedUpdatedAt": "t", "name": "Coach"}),
            json!({"persona": "coach", "expectedUpdatedAt": "t", "defaultModel": "m"}),
            json!({"persona": "coach", "expectedUpdatedAt": "t", "name": "Coach", "inheritsFrom": "ego"}),
            json!({"expectedUpdatedAt": "t", "name": "Coach"}),
            json!(["coach"]),
        ] {
            assert_eq!(persona_update_call(&malformed).unwrap_err(), PERSONA_MALFORMED, "{malformed}");
        }
    }

    #[test]
    fn an_answer_is_the_persona_or_a_failure() {
        let persona = json!({"id": "coach", "name": "Coach", "prompt": "p", "updatedAt": "t"});
        assert_eq!(persona_answer(persona.clone()).unwrap(), persona);
        for answer in [json!({}), json!({"id": "coach", "prompt": "p"}), json!({"id": "../x", "prompt": "p", "updatedAt": "t"}),
                       json!({"id": "coach", "prompt": 1, "updatedAt": "t"}), json!(null)] {
            assert_eq!(persona_answer(answer.clone()).unwrap_err(), PERSONA_UNREADABLE, "{answer}");
        }
    }

    #[test]
    fn each_refusal_reads_as_a_sentence_that_names_the_field() {
        assert_eq!(describe_persona_refusal(refused("persona_changed")), PERSONA_STALE_MESSAGE);
        assert!(describe_persona_refusal(refused("invalid_name")).contains("name"));
        assert!(describe_persona_refusal(refused("invalid_prompt")).contains("prompt"));
        assert!(describe_persona_refusal(refused("invalid_description")).contains("description"));
        assert!(describe_persona_refusal(refused("invalid_routing_keywords")).contains("keywords"));
        assert!(describe_persona_refusal(refused("metadata_unreadable")).contains("prompt"));
        for reason in ["unknown_persona", "invalid_request", "something_new"] {
            let sentence = describe_persona_refusal(refused(reason));
            assert!(sentence.ends_with('.') && !sentence.contains('_'), "{reason}: {sentence}");
        }
        let other = MirrorHostError::Rejected { name: "DatabaseNotCurrentError".into(), reason: "ahead".into(), message: String::new() };
        assert_eq!(describe_persona_refusal(other), "Mirror refused the request (DatabaseNotCurrentError: ahead).");
    }

    /// CR217 through the real core: read, edit, a stale edit, a refused value. Run as
    /// `real_host_feeds` is.
    #[test]
    #[ignore]
    fn real_host_reads_and_edits_a_persona_in_the_shapes_the_app_reads() {
        let runtime = PathBuf::from(std::env::var("MIRROR_HOST_RUNTIME").expect("MIRROR_HOST_RUNTIME"));
        let parent = std::env::temp_dir().join(format!("mirror-bridge-personas-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&parent);
        std::fs::create_dir_all(&parent).unwrap();
        let parent = parent.canonicalize().unwrap();
        let mut host = MirrorHost::new(MirrorHostConfig::for_runtime(runtime));
        host.request("createMarkedHome", json!({"request": {"homePath": parent.join("ana"), "userName": "ana"}})).unwrap();
        let home = MarkedHome::open(&parent.join("ana")).unwrap();
        let mut send = |method: &str, call: Value| {
            host.request_for_home(&home, method, json!({"request": call})).map_err(describe_persona_refusal).and_then(persona_answer)
        };
        let coach = send("readPersona", persona_read_call("coach").unwrap()).unwrap();
        assert_eq!(coach["name"], "Coach");
        let at = coach["updatedAt"].as_str().unwrap().to_string();
        let edit = |fields: Value| {
            let mut request = json!({"persona": "coach", "expectedUpdatedAt": at});
            request.as_object_mut().unwrap().extend(fields.as_object().unwrap().clone());
            persona_update_call(&request).unwrap()
        };
        assert!(send("updatePersona", edit(json!({"name": " "}))).unwrap_err().contains("name"));
        let saved = send("updatePersona", edit(json!({"name": "Treinadora", "routingKeywords": ["hábitos"]}))).unwrap();
        assert_eq!(saved["name"], "Treinadora");
        assert_eq!(saved["routingKeywords"], json!(["hábitos"]));
        assert_eq!(saved["prompt"], coach["prompt"]);
        assert_eq!(send("updatePersona", edit(json!({"prompt": "Outro."}))).unwrap_err(), PERSONA_STALE_MESSAGE);
        let _ = std::fs::remove_dir_all(&parent);
    }
}
