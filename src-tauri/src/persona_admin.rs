//! CR217: a persona read and edited through the Mirror host (Core CR205, mirror-mind 0.42.0).
//! CR221: every persona listed, for the sidebar's Personas section.
//! CR222 and CR223: a persona created, and one deleted after a preview (Core CR207, 0.44.0). The
//! Core deletes behind its own named backup; Nautilus then removes the persona's image (CR218).
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
const PERSONA_LIST_UNREADABLE: &str = "Mirror answered without its personas.";
const MAX_LISTED_PERSONAS: usize = 512;
/// The host method the command calls, named once so the real-host test proves the command's own.
const LIST_PERSONAS_METHOD: &str = "listPersonas";
const CREATE_PERSONA_METHOD: &str = "createPersona";
const PREVIEW_PERSONA_DELETION_METHOD: &str = "previewPersonaDeletion";
const DELETE_PERSONA_METHOD: &str = "deletePersona";
const PERSONA_DELETION_UNREADABLE: &str = "Mirror's list of what this persona holds could not be read.";
/// Held identical to the surface's `PERSONA_DELETION_CHANGED`: a stale preview is shown again.
pub(crate) const PERSONA_DELETION_CHANGED: &str = "What this persona holds changed since the list was shown. Review the new list and confirm again.";
const CREATABLE: [&str; 5] = ["persona", "name", "prompt", "description", "routingKeywords"];
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

/// The core call's request for a new persona: an id, a name and a prompt, and a description and
/// routing keywords when given. Values are the Core's to check; the shape is checked here.
pub(crate) fn persona_create_call(request: &Value) -> Result<Value, String> {
    let malformed = || PERSONA_MALFORMED.to_string();
    let fields = request.as_object().ok_or_else(malformed)?;
    let persona = fields.get("persona").and_then(Value::as_str).ok_or_else(malformed)?;
    let keywords_are_text = |value: &Value| value.as_array().is_some_and(|items| items.iter().all(Value::is_string));
    if !is_persona_id(persona)
        || fields.keys().any(|key| !CREATABLE.contains(&key.as_str()))
        || !fields.get("name").is_some_and(Value::is_string)
        || !fields.get("prompt").is_some_and(Value::is_string)
        || fields.get("description").is_some_and(|value| !value.is_string())
        || fields.get("routingKeywords").is_some_and(|value| !keywords_are_text(value))
    {
        return Err(malformed());
    }
    Ok(request.clone())
}

/// The core call's request for deleting `persona` as the preview with `digest` showed it.
pub(crate) fn persona_deletion_call(persona: &str, digest: &str) -> Result<Value, String> {
    let is_digest = digest.len() == 64 && digest.bytes().all(|byte| byte.is_ascii_hexdigit());
    if !is_persona_id(persona) || !is_digest {
        return Err(PERSONA_MALFORMED.to_string());
    }
    Ok(json!({ "persona": persona, "expectedDigest": digest }))
}

/// The Core's preview of a deletion, with whether this device keeps an image for the persona.
pub(crate) fn persona_deletion_preview_answer(result: Value, image: bool) -> Result<Value, String> {
    let counts = |key: &str, names: &[&str]| result.get(key).is_some_and(|value| names.iter().all(|name| value.get(*name).is_some_and(Value::is_u64)));
    let ids = |value: Option<&Value>| value.and_then(Value::as_array).is_some_and(|items| items.iter().all(Value::is_string));
    let readable = result.get("persona").and_then(Value::as_str).is_some_and(is_persona_id)
        && ids(result.get("heirs"))
        && counts("kept", &["conversations", "memories", "runtime_sessions"])
        && counts("deleted", &["descriptors", "identity_integrations", "extension_bindings"])
        && ids(result.pointer("/cleared/journey_defaults"))
        && result.pointer("/cleared/sticky_default").is_some_and(Value::is_boolean)
        && result.get("digest").and_then(Value::as_str).is_some_and(|digest| !digest.is_empty());
    if !readable {
        return Err(PERSONA_DELETION_UNREADABLE.to_string());
    }
    let mut answer = result;
    answer["image"] = json!(image);
    Ok(answer)
}

/// The persona as the Core answered it, when it is one.
pub(crate) fn persona_answer(result: Value) -> Result<Value, String> {
    let readable = result.get("id").and_then(Value::as_str).is_some_and(is_persona_id)
        && result.get("prompt").is_some_and(Value::is_string)
        && result.get("updatedAt").is_some_and(Value::is_string);
    if readable { Ok(result) } else { Err(PERSONA_UNREADABLE.to_string()) }
}

/// The personas as the Core listed them: each entry with a persona id, a name and a description
/// that are text or absent. An entry that is not one is left out; an answer that is not a list
/// is a failure.
pub(crate) fn persona_list_answer(result: Value) -> Result<Value, String> {
    let entries = result.as_array().ok_or_else(|| PERSONA_LIST_UNREADABLE.to_string())?;
    let text_or_absent = |value: Option<&Value>| value.is_none_or(|value| value.is_null() || value.is_string());
    let listed = entries
        .iter()
        .filter(|entry| {
            entry.get("id").and_then(Value::as_str).is_some_and(is_persona_id)
                && text_or_absent(entry.get("name"))
                && text_or_absent(entry.get("description"))
        })
        .take(MAX_LISTED_PERSONAS)
        .map(|entry| json!({ "id": entry["id"], "name": entry.get("name").cloned().unwrap_or(Value::Null),
                             "description": entry.get("description").cloned().unwrap_or(Value::Null) }))
        .collect();
    Ok(Value::Array(listed))
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
        "invalid_persona_id" => "A persona's id must be lowercase letters, digits and single hyphens, at most 80 characters.".to_string(),
        "persona_exists" => "Mirror already keeps a persona with this id. Choose another.".to_string(),
        "persona_has_heirs" => "Other personas inherit from this one, so Mirror kept it.".to_string(),
        "backup_failed" => "Mirror could not take its backup, so nothing was deleted.".to_string(),
        "metadata_unreadable" => {
            "Mirror cannot read this persona's details, so it changed none of them. Its prompt alone can still be saved.".to_string()
        }
        _ => "Mirror refused the persona change.".to_string(),
    }
}

/// A deletion's refusal: a stale preview is shown again, every other reads as an edit's does.
pub(crate) fn describe_persona_deletion_refusal(error: MirrorHostError) -> String {
    match &error {
        MirrorHostError::Rejected { name, reason, .. } if name == "PersonaCallRejectedError" && reason == "persona_changed" => {
            PERSONA_DELETION_CHANGED.to_string()
        }
        _ => describe_persona_refusal(error),
    }
}

/// CR216's rule: the kept name is the one the Core keeps now. A name that cannot be kept costs only
/// the transcript's label until the persona's next turn, never the saved persona.
fn remember_name(app: &AppHandle, persona: &Value) {
    if let (Some(id), Ok(dir)) = (persona["id"].as_str(), crate::home_state::home_state_dir(app)) {
        let _ = crate::mirror_context::remember_persona_name_in(&dir, id, persona["name"].as_str());
    }
}

#[tauri::command(async)]
pub(crate) fn create_persona(app: AppHandle, request: Value) -> Result<Value, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let call = persona_create_call(&request)?;
    let home = crate::mirror_host_bridge::active_home(&app)?;
    let result = crate::mirror_host_bridge::request_for(&app, &home, CREATE_PERSONA_METHOD, json!({ "request": call }))
        .map_err(describe_persona_refusal)?;
    let persona = persona_answer(result)?;
    remember_name(&app, &persona);
    Ok(persona)
}

#[tauri::command(async)]
pub(crate) fn preview_persona_deletion(app: AppHandle, persona: String) -> Result<Value, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let call = persona_read_call(&persona)?;
    let home = crate::mirror_host_bridge::active_home(&app)?;
    let result = crate::mirror_host_bridge::request_for(&app, &home, PREVIEW_PERSONA_DELETION_METHOD, json!({ "request": call }))
        .map_err(describe_persona_refusal)?;
    let image = crate::home_state::home_state_dir(&app)
        .is_ok_and(|dir| crate::journey_appearance::has_persona_image_at(&dir, &persona));
    persona_deletion_preview_answer(result, image)
}

/// Deletes in Mirror, then removes the persona's image here. The kept name (CR216) stays, so a
/// bubble the persona signed still shows it. An image that cannot be removed is reported, not a
/// failure: the persona is already gone from Mirror.
#[tauri::command(async)]
pub(crate) fn delete_persona(app: AppHandle, persona: String, expected_digest: String) -> Result<Value, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let call = persona_deletion_call(&persona, &expected_digest)?;
    let home = crate::mirror_host_bridge::active_home(&app)?;
    let result = crate::mirror_host_bridge::request_for(&app, &home, DELETE_PERSONA_METHOD, json!({ "request": call }))
        .map_err(describe_persona_deletion_refusal)?;
    let backup = result.pointer("/backup/path").and_then(Value::as_str).map(str::to_string);
    let problem = crate::home_state::home_state_dir(&app)
        .and_then(|dir| crate::journey_appearance::remove_persona_image_at(&dir, &persona))
        .err()
        .map(|error| format!("Mirror deleted the persona, but Nautilus kept its image: {error}"));
    Ok(json!({ "backup": backup, "problem": problem }))
}

#[tauri::command(async)]
pub(crate) fn list_personas(app: AppHandle) -> Result<Value, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let home = crate::mirror_host_bridge::active_home(&app)?;
    let result = crate::mirror_host_bridge::request_for(&app, &home, LIST_PERSONAS_METHOD, json!({}))
        .map_err(describe_persona_refusal)?;
    persona_list_answer(result)
}

#[tauri::command(async)]
pub(crate) fn read_persona(app: AppHandle, persona: String) -> Result<Value, String> {
    let _serialized = crate::native_command_serialization::acquire();
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
    remember_name(&app, &persona);
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
    fn a_list_keeps_only_entries_that_are_personas_and_carries_nothing_else() {
        let listed = persona_list_answer(json!([
            {"id": "coach", "name": "Coach", "description": "Goals", "prompt": "never sent on"},
            {"id": "zeta"},
            {"id": "medica", "name": null, "description": null},
            {"id": "../private", "name": "Escape"},
            {"id": "x", "name": 7},
            {"id": "y", "description": ["a"]},
            "coach",
        ]))
        .unwrap();
        assert_eq!(
            listed,
            json!([
                {"id": "coach", "name": "Coach", "description": "Goals"},
                {"id": "zeta", "name": null, "description": null},
                {"id": "medica", "name": null, "description": null},
            ])
        );
        for answer in [json!({}), json!(null), json!("coach")] {
            assert_eq!(persona_list_answer(answer.clone()).unwrap_err(), PERSONA_LIST_UNREADABLE, "{answer}");
        }
        let many: Vec<Value> = (0..600).map(|n| json!({"id": format!("p{n}")})).collect();
        assert_eq!(persona_list_answer(Value::Array(many)).unwrap().as_array().unwrap().len(), MAX_LISTED_PERSONAS);
    }

    #[test]
    fn a_creation_carries_an_id_a_name_a_prompt_and_only_the_fields_it_may() {
        let request = json!({"persona": "gardener", "name": "Gardener", "prompt": "p", "description": "d", "routingKeywords": ["a"]});
        assert_eq!(persona_create_call(&request).unwrap(), request);
        let bare = json!({"persona": "gardener", "name": "Gardener", "prompt": "p"});
        assert_eq!(persona_create_call(&bare).unwrap(), bare);
        for malformed in [
            json!({"name": "Gardener", "prompt": "p"}),
            json!({"persona": "Gardener", "name": "Gardener", "prompt": "p"}),
            json!({"persona": "gardener", "prompt": "p"}),
            json!({"persona": "gardener", "name": "Gardener"}),
            json!({"persona": "gardener", "name": null, "prompt": "p"}),
            json!({"persona": "gardener", "name": "Gardener", "prompt": "p", "description": 7}),
            json!({"persona": "gardener", "name": "Gardener", "prompt": "p", "routingKeywords": "a"}),
            json!({"persona": "gardener", "name": "Gardener", "prompt": "p", "routingKeywords": [1]}),
            json!({"persona": "gardener", "name": "Gardener", "prompt": "p", "inheritsFrom": "ego"}),
            json!(["gardener"]),
        ] {
            assert_eq!(persona_create_call(&malformed).unwrap_err(), PERSONA_MALFORMED, "{malformed}");
        }
    }

    #[test]
    fn a_deletion_names_one_persona_and_the_digest_it_was_shown() {
        let digest = "a".repeat(64);
        assert_eq!(persona_deletion_call("coach", &digest).unwrap(), json!({"persona": "coach", "expectedDigest": digest}));
        for (persona, digest) in [("Coach", "a".repeat(64)), ("coach", "a".repeat(63)), ("coach", "g".repeat(64)), ("coach", String::new())] {
            assert_eq!(persona_deletion_call(persona, &digest).unwrap_err(), PERSONA_MALFORMED, "{persona} {digest}");
        }
    }

    #[test]
    fn a_preview_is_the_cores_with_the_image_or_a_failure() {
        let core = json!({"persona": "coach", "heirs": [], "kept": {"conversations": 2, "memories": 0, "runtime_sessions": 1},
                          "deleted": {"descriptors": 1, "identity_integrations": 0, "extension_bindings": 0},
                          "cleared": {"journey_defaults": ["work"], "sticky_default": false}, "digest": "d"});
        let answered = persona_deletion_preview_answer(core.clone(), true).unwrap();
        assert_eq!(answered["image"], true);
        assert_eq!(answered["kept"], core["kept"]);
        for broken in ["/persona", "/heirs", "/kept/memories", "/deleted/extension_bindings", "/cleared/journey_defaults", "/cleared/sticky_default", "/digest"] {
            let mut answer = core.clone();
            let (parent, key) = broken.rsplit_once('/').unwrap();
            let target = if parent.is_empty() { &mut answer } else { answer.pointer_mut(parent).unwrap() };
            target.as_object_mut().unwrap().remove(key);
            assert_eq!(persona_deletion_preview_answer(answer, false).unwrap_err(), PERSONA_DELETION_UNREADABLE, "{broken}");
        }
        let mut negative = core.clone();
        negative["kept"]["conversations"] = json!(-1);
        assert!(persona_deletion_preview_answer(negative, false).is_err());
    }

    #[test]
    fn a_stale_deletion_asks_for_the_list_again() {
        assert_eq!(describe_persona_deletion_refusal(refused("persona_changed")), PERSONA_DELETION_CHANGED);
        assert_eq!(describe_persona_deletion_refusal(refused("backup_failed")), describe_persona_refusal(refused("backup_failed")));
        assert!(describe_persona_refusal(refused("persona_exists")).contains("id"));
        assert!(describe_persona_refusal(refused("invalid_persona_id")).contains("id"));
        assert!(describe_persona_refusal(refused("persona_has_heirs")).contains("inherit"));
        assert!(describe_persona_refusal(refused("backup_failed")).contains("backup"));
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
        // CR221: the list, in the shape the sidebar reads.
        let listed = persona_list_answer(host.request_for_home(&home, LIST_PERSONAS_METHOD, json!({})).unwrap()).unwrap();
        let ids: Vec<&str> = listed.as_array().unwrap().iter().filter_map(|entry| entry["id"].as_str()).collect();
        assert!(ids.contains(&"coach") && ids.contains(&"writer"), "{ids:?}");
        assert!(listed.as_array().unwrap().iter().all(|entry| entry.get("prompt").is_none()));
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
        // CR222: a persona created, and a taken id refused in the Navigator's words.
        let creation = persona_create_call(&json!({"persona": "gardener", "name": "Gardener", "prompt": "# Gardener"})).unwrap();
        let created = send(CREATE_PERSONA_METHOD, creation.clone()).unwrap();
        assert_eq!(created["name"], "Gardener");
        assert!(send(CREATE_PERSONA_METHOD, creation).unwrap_err().contains("already keeps"));
        // CR223: its preview in the shape the confirmation reads, then its deletion behind a backup.
        let preview = host.request_for_home(&home, PREVIEW_PERSONA_DELETION_METHOD, json!({"request": persona_read_call("gardener").unwrap()})).unwrap();
        let preview = persona_deletion_preview_answer(preview, false).unwrap();
        assert_eq!(preview["heirs"], json!([]));
        let digest = preview["digest"].as_str().unwrap();
        let stale = persona_deletion_call("gardener", &"0".repeat(64)).unwrap();
        let refused = host.request_for_home(&home, DELETE_PERSONA_METHOD, json!({"request": stale})).map_err(describe_persona_deletion_refusal);
        assert_eq!(refused.unwrap_err(), PERSONA_DELETION_CHANGED);
        let receipt = host.request_for_home(&home, DELETE_PERSONA_METHOD, json!({"request": persona_deletion_call("gardener", digest).unwrap()})).unwrap();
        assert!(PathBuf::from(receipt.pointer("/backup/path").unwrap().as_str().unwrap()).is_file());
        let listed = persona_list_answer(host.request_for_home(&home, LIST_PERSONAS_METHOD, json!({})).unwrap()).unwrap();
        assert!(listed.as_array().unwrap().iter().all(|entry| entry["id"] != "gardener"));
        let _ = std::fs::remove_dir_all(&parent);
    }
}
