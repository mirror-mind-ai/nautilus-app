//! CR263: a Journey's content whole, read from Mirror for the Journey Briefing panel.
//!
//! The registry carries only a collapsed `## Description`. The briefing is the Journey's `identity`
//! content, the text the runtime delivers to every turn, which the Core answers through
//! `readJourney` (Core CR217, mirror-mind 0.44.2). The read is made each time the panel asks, so a
//! `mirror identity set` shows without a restart.

use serde_json::{json, Value};
use tauri::AppHandle;

pub(crate) const READ_JOURNEY_METHOD: &str = "readJourney";

const UNREADABLE: &str = "Mirror answered without this Journey's content.";

/// The Core's request for one Journey, by its exact id.
pub(crate) fn journey_briefing_call(journey_id: &str) -> Value {
    json!({ "journeyId": journey_id })
}

/// What the panel reads of the Core's answer: the Journey's id, name, content and `updatedAt`,
/// each a text. The content is passed on whole and may be empty.
pub(crate) fn journey_briefing_answer(result: &Value) -> Result<Value, String> {
    let text = |key: &str| result.get(key).and_then(Value::as_str);
    match (text("id"), text("name"), text("content"), text("updatedAt")) {
        (Some(id), Some(name), Some(content), Some(updated_at)) if !id.is_empty() => {
            Ok(json!({ "id": id, "name": name, "content": content, "updatedAt": updated_at }))
        }
        _ => Err(UNREADABLE.to_string()),
    }
}

#[tauri::command(async)]
pub(crate) fn read_journey_briefing(app: AppHandle, journey_id: String) -> Result<Value, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let journey_id = crate::sanitize_journey_id(&journey_id)?;
    let home = crate::mirror_host_bridge::active_home(&app)?;
    let result = crate::mirror_host_bridge::request_for(
        &app,
        &home,
        READ_JOURNEY_METHOD,
        json!({ "request": journey_briefing_call(&journey_id) }),
    )
    .map_err(crate::mirror_host_bridge::describe_journey_refusal)?;
    journey_briefing_answer(&result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mirror_home::MarkedHome;
    use crate::mirror_host::{MirrorHost, MirrorHostConfig, MirrorHostError};
    use std::path::PathBuf;

    #[test]
    fn a_read_names_one_journey_id() {
        assert_eq!(journey_briefing_call("mirror-desktop"), json!({"journeyId": "mirror-desktop"}));
        assert_eq!(READ_JOURNEY_METHOD, "readJourney");
    }

    #[test]
    fn the_answer_keeps_the_content_whole_and_only_what_the_panel_reads() {
        let content = "# T\n**Status:** active\n\n## Description\n\nOne.\n\nTwo.\n";
        let answer = journey_briefing_answer(&json!({
            "id": "sample", "name": "Sample", "content": content, "updatedAt": "2026-11-21T10:00:00Z", "extra": 1
        }))
        .unwrap();
        assert_eq!(answer, json!({"id": "sample", "name": "Sample", "content": content, "updatedAt": "2026-11-21T10:00:00Z"}));
        let empty = journey_briefing_answer(&json!({"id": "sample", "name": "sample", "content": "", "updatedAt": "t"})).unwrap();
        assert_eq!(empty["content"], "");
    }

    #[test]
    fn a_malformed_answer_is_refused_in_words_not_shown_as_an_empty_briefing() {
        for bad in [
            json!(null),
            json!("text"),
            json!({"id": "", "name": "n", "content": "c", "updatedAt": "t"}),
            json!({"id": "a", "name": "n", "content": 7, "updatedAt": "t"}),
            json!({"id": "a", "name": "n", "content": "c"}),
        ] {
            assert_eq!(journey_briefing_answer(&bad).unwrap_err(), UNREADABLE, "{bad}");
        }
    }

    #[test]
    fn an_unknown_journey_is_refused_in_the_navigators_words() {
        let refused = MirrorHostError::Rejected {
            name: "JourneyCallRejectedError".into(),
            reason: "unknown_journey".into(),
            message: "unknown_journey".into(),
        };
        assert_eq!(crate::mirror_host_bridge::describe_journey_refusal(refused), "Journey no longer exists in Mirror.");
    }

    #[test]
    fn the_command_serialises_and_sanitises_before_it_asks() {
        let source = include_str!("journey_briefing.rs");
        let command = &source[source.find("pub(crate) fn read_journey_briefing").unwrap()..source.find("#[cfg(test)]").unwrap()];
        assert!(command.find("native_command_serialization::acquire()").unwrap() < command.find("sanitize_journey_id").unwrap());
        assert!(command.find("sanitize_journey_id").unwrap() < command.find("request_for").unwrap());
    }

    /// Through the real Core (0.44.2): the content whole, the empty one, and the unknown Journey.
    /// Run with `MIRROR_HOST_RUNTIME` set to a laid-out runtime and `--ignored`.
    #[test]
    #[ignore]
    fn real_host_reads_a_journeys_content_whole() {
        let runtime = PathBuf::from(std::env::var("MIRROR_HOST_RUNTIME").expect("MIRROR_HOST_RUNTIME"));
        let parent = std::env::temp_dir().join(format!("mirror-bridge-briefing-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&parent);
        std::fs::create_dir_all(&parent).unwrap();
        let parent = parent.canonicalize().unwrap();
        let mut host = MirrorHost::new(MirrorHostConfig::for_runtime(runtime));
        host.request("createMarkedHome", json!({"request": {"homePath": parent.join("ana"), "userName": "ana"}})).unwrap();
        let home = MarkedHome::open(&parent.join("ana")).unwrap();
        let description = "Um lugar para escrever o livro, com seus capitulos e seu ritmo.";
        host.request_for_home(
            &home,
            "addJourney",
            json!({"request": {"slug": "escrita", "name": "Escrita", "description": description, "parentId": null, "position": 0}}),
        )
        .unwrap();
        let read = |host: &mut MirrorHost, id: &str| {
            host.request_for_home(&home, READ_JOURNEY_METHOD, json!({"request": journey_briefing_call(id)}))
                .map_err(crate::mirror_host_bridge::describe_journey_refusal)
                .and_then(|result| journey_briefing_answer(&result))
        };
        let answer = read(&mut host, "escrita").unwrap();
        assert_eq!(answer["id"], "escrita");
        assert_eq!(answer["name"], "Escrita");
        let content = answer["content"].as_str().unwrap();
        assert!(content.contains("## Description"), "{content}");
        assert!(content.contains(description), "{content}");
        assert!(answer["updatedAt"].as_str().is_some_and(|at| !at.is_empty()));
        assert_eq!(read(&mut host, "no-such-journey").unwrap_err(), "Journey no longer exists in Mirror.");
        let _ = std::fs::remove_dir_all(&parent);
    }
}
