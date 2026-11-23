//! CR173: the Desktop's own Anthropic provider, a pinned fork of `pi-claude-bridge`.
//!
//! Reaching Anthropic's models is part of what the Desktop promises, so it no longer borrows the
//! person's bridge. The runtime the app carries names the provider it pins in its receipt
//! (`pin-receipt.json`: the hash of the provider's source tree, the hash of its lockfile and the
//! Claude Code version it ships). `pi-install.mjs --kind anthropic` installs exactly that into
//! `<app data>/anthropic/anthropic-<source>-<lockfile>/` and writes an install receipt; this module
//! accepts that folder only when both receipts agree, and names the Pi extension in it.
//!
//! CR275: an update can change the pin, and then the folder the app installed earlier is an earlier
//! pin's. `anthropic_install` tells that apart from no install at all, so the app brings it up to
//! the pin instead of showing Claude as never connected.

use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub(crate) const ANTHROPIC_DIRECTORY: &str = "anthropic";
pub(crate) const ANTHROPIC_NOT_INSTALLED: &str =
    "Claude models are not installed for Nautilus yet. Install them from the setup screen.";
/// The person's own copy, which the Desktop's replaces in every invocation it makes.
pub(crate) const UPSTREAM_PACKAGE: &str = "pi-claude-bridge";
/// The provider's Pi extension, inside an install.
const ENTRY: &str = "provider/src/index.ts";

/// The provider a runtime pins, from its receipt.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct PinnedAnthropic {
    pub source_sha256: String,
    pub lockfile_sha256: String,
    pub claude_code: String,
}

fn is_lowercase_hex(value: &str, length: usize) -> bool {
    value.len() == length && value.bytes().all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
}

pub(crate) fn pinned_anthropic(runtime_dir: &Path) -> Result<PinnedAnthropic, String> {
    let damaged = || crate::mirror_host_bridge::RUNTIME_MISSING.to_string();
    let receipt: Value = fs::read(runtime_dir.join("pin-receipt.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .ok_or_else(damaged)?;
    let field = |name: &str| receipt.pointer(&format!("/anthropic/{name}")).and_then(Value::as_str).map(str::to_string);
    let hash = |name: &str| field(name).filter(|hash| is_lowercase_hex(hash, 64)).ok_or_else(damaged);
    Ok(PinnedAnthropic {
        source_sha256: hash("sourceSha256")?,
        lockfile_sha256: hash("lockfileSha256")?,
        claude_code: field("claudeCode").filter(|version| !version.is_empty()).ok_or_else(damaged)?,
    })
}

/// Where the pinned provider is installed: one folder per source and lockfile.
pub(crate) fn install_dir(app_data_root: &Path, pinned: &PinnedAnthropic) -> PathBuf {
    app_data_root
        .join(ANTHROPIC_DIRECTORY)
        .join(format!("anthropic-{}-{}", &pinned.source_sha256[..12], &pinned.lockfile_sha256[..12]))
}

/// The installed provider's Pi extension, when its install receipt is the pinned one;
/// `ANTHROPIC_NOT_INSTALLED` otherwise.
pub(crate) fn resolve_app_anthropic(app_data_root: &Path, runtime_dir: &Path) -> Result<PathBuf, String> {
    let pinned = pinned_anthropic(runtime_dir)?;
    let not_installed = || ANTHROPIC_NOT_INSTALLED.to_string();
    let directory = install_dir(app_data_root, &pinned);
    let receipt: Value = fs::read(directory.join("install-receipt.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .ok_or_else(not_installed)?;
    let field = |name: &str| receipt.get(name).and_then(Value::as_str);
    if field("kind") != Some("anthropic")
        || field("sourceSha256") != Some(pinned.source_sha256.as_str())
        || field("lockfileSha256") != Some(pinned.lockfile_sha256.as_str())
        || field("entry") != Some(ENTRY)
    {
        return Err(not_installed());
    }
    let entry = directory.join(ENTRY);
    if !fs::symlink_metadata(&entry).is_ok_and(|metadata| metadata.is_file()) {
        return Err(not_installed());
    }
    let entry = crate::platform::canonicalize(&entry).map_err(|_| not_installed())?;
    let directory = crate::platform::canonicalize(&directory).map_err(|_| not_installed())?;
    if !entry.starts_with(&directory) {
        return Err(not_installed());
    }
    Ok(entry)
}

/// CR275: what the app data holds for the provider the runtime pins.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum AnthropicInstall {
    /// The pinned provider, by its Pi extension.
    Current(PathBuf),
    /// Only an earlier pin's: the person connected Claude before this version of the app.
    Superseded,
    /// None: the person never connected Claude through the app.
    Absent,
}

/// An install folder whose receipt is a finished provider install, of any pin.
fn is_finished_install(directory: &Path) -> bool {
    let Some(name) = directory.file_name().and_then(|name| name.to_str()) else { return false };
    if !name.starts_with("anthropic-") || !fs::symlink_metadata(directory).is_ok_and(|metadata| metadata.is_dir()) {
        return false;
    }
    fs::read(directory.join("install-receipt.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .is_some_and(|receipt| receipt.get("kind").and_then(Value::as_str) == Some("anthropic")
            && receipt.get("entry").and_then(Value::as_str) == Some(ENTRY))
}

pub(crate) fn anthropic_install(app_data_root: &Path, runtime_dir: &Path) -> Result<AnthropicInstall, String> {
    match resolve_app_anthropic(app_data_root, runtime_dir) {
        Ok(entry) => return Ok(AnthropicInstall::Current(entry)),
        Err(error) if error != ANTHROPIC_NOT_INSTALLED => return Err(error),
        Err(_) => {}
    }
    let earlier = fs::read_dir(app_data_root.join(ANTHROPIC_DIRECTORY))
        .map(|entries| entries.flatten().any(|entry| is_finished_install(&entry.path())))
        .unwrap_or(false);
    Ok(if earlier { AnthropicInstall::Superseded } else { AnthropicInstall::Absent })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub(crate) const SOURCE: &str = "25e01d9e72808aaa0dbc81e888ea776c737d26af15de36ccd7670447d3a0a134";
    pub(crate) const LOCK: &str = "ea4895ef6832973cbc6541cffb85fb4aabef8037a919794c31704ce688457ee1";

    fn scratch(label: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!("anthropic-provider-{label}-{}-{:?}", std::process::id(), std::thread::current().id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        crate::platform::canonicalize(&directory).unwrap()
    }

    /// A runtime pinning the provider, and an app data folder with it installed.
    pub(crate) fn installed(label: &str) -> (PathBuf, PathBuf, PathBuf) {
        let base = scratch(label);
        let runtime = base.join("runtime");
        fs::create_dir_all(&runtime).unwrap();
        fs::write(
            runtime.join("pin-receipt.json"),
            format!(r#"{{"anthropic":{{"sourceSha256":"{SOURCE}","lockfileSha256":"{LOCK}","claudeCode":"2.1.306"}}}}"#),
        )
        .unwrap();
        let app_data = base.join("app-data");
        let target = app_data.join("anthropic").join("anthropic-25e01d9e7280-ea4895ef6832");
        fs::create_dir_all(target.join("provider/src")).unwrap();
        fs::write(target.join("provider/src/index.ts"), "export default function () {}\n").unwrap();
        fs::write(
            target.join("install-receipt.json"),
            format!(r#"{{"kind":"anthropic","sourceSha256":"{SOURCE}","lockfileSha256":"{LOCK}","claudeCode":"2.1.306","entry":"provider/src/index.ts"}}"#),
        )
        .unwrap();
        (base, runtime, app_data)
    }

    #[test]
    fn the_installed_pin_names_its_pi_extension() {
        let (base, runtime, app_data) = installed("resolved");
        assert_eq!(
            pinned_anthropic(&runtime).unwrap(),
            PinnedAnthropic { source_sha256: SOURCE.into(), lockfile_sha256: LOCK.into(), claude_code: "2.1.306".into() }
        );
        assert_eq!(install_dir(&app_data, &pinned_anthropic(&runtime).unwrap()), app_data.join("anthropic/anthropic-25e01d9e7280-ea4895ef6832"));
        assert_eq!(
            resolve_app_anthropic(&app_data, &runtime).unwrap(),
            app_data.join("anthropic/anthropic-25e01d9e7280-ea4895ef6832/provider/src/index.ts")
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[cfg(unix)]
    #[test]
    fn anything_but_the_pinned_install_is_not_installed() {
        let (base, runtime, app_data) = installed("refused");
        let target = app_data.join("anthropic/anthropic-25e01d9e7280-ea4895ef6832");
        let receipt = target.join("install-receipt.json");
        let original = fs::read_to_string(&receipt).unwrap();
        for (from, to) in [
            ("\"kind\":\"anthropic\"", "\"kind\":\"pi\""),
            (SOURCE, &"e".repeat(64)),
            (LOCK, &"f".repeat(64)),
            ("\"entry\":\"provider/src/index.ts\"", "\"entry\":\"../../elsewhere.ts\""),
        ] {
            fs::write(&receipt, original.replacen(from, to, 1)).unwrap();
            assert_eq!(resolve_app_anthropic(&app_data, &runtime).unwrap_err(), ANTHROPIC_NOT_INSTALLED, "{to}");
        }
        fs::remove_file(&receipt).unwrap();
        assert_eq!(resolve_app_anthropic(&app_data, &runtime).unwrap_err(), ANTHROPIC_NOT_INSTALLED, "a stopped install has no receipt");
        fs::write(&receipt, &original).unwrap();

        let entry = target.join("provider/src/index.ts");
        fs::remove_file(&entry).unwrap();
        assert_eq!(resolve_app_anthropic(&app_data, &runtime).unwrap_err(), ANTHROPIC_NOT_INSTALLED, "no extension");
        std::os::unix::fs::symlink("/Users/someone/.pi/agent/npm/node_modules/pi-claude-bridge/src/index.ts", &entry).unwrap();
        assert_eq!(resolve_app_anthropic(&app_data, &runtime).unwrap_err(), ANTHROPIC_NOT_INSTALLED, "a link to the person's copy");
        fs::remove_file(&entry).unwrap();

        // A folder on the way that is a link leaves the install, though the file itself is plain.
        fs::remove_dir_all(target.join("provider")).unwrap();
        let outside = base.join("outside");
        fs::create_dir_all(outside.join("src")).unwrap();
        fs::write(outside.join("src/index.ts"), "").unwrap();
        std::os::unix::fs::symlink(&outside, target.join("provider")).unwrap();
        assert_eq!(resolve_app_anthropic(&app_data, &runtime).unwrap_err(), ANTHROPIC_NOT_INSTALLED, "an install reaching outside itself");
        let _ = fs::remove_dir_all(&base);
    }

    /// CR275: an earlier pin's finished install beside the pinned one's folder.
    pub(crate) fn supersede(app_data: &Path) {
        let earlier = app_data.join("anthropic").join("anthropic-b2df6deaf78c-ea4895ef6832");
        fs::create_dir_all(earlier.join("provider/src")).unwrap();
        fs::write(earlier.join("provider/src/index.ts"), "export default function () {}\n").unwrap();
        fs::write(
            earlier.join("install-receipt.json"),
            format!(r#"{{"kind":"anthropic","sourceSha256":"{}","lockfileSha256":"{LOCK}","claudeCode":"2.1.300","entry":"provider/src/index.ts"}}"#, "b2df6deaf78c".repeat(5) + "b2df"),
        )
        .unwrap();
    }

    #[test]
    fn an_earlier_pins_install_is_told_apart_from_none() {
        let (base, runtime, app_data) = installed("superseded");
        let current = app_data.join("anthropic/anthropic-25e01d9e7280-ea4895ef6832");
        assert!(matches!(anthropic_install(&app_data, &runtime).unwrap(), AnthropicInstall::Current(_)));

        fs::remove_dir_all(&current).unwrap();
        assert_eq!(anthropic_install(&app_data, &runtime).unwrap(), AnthropicInstall::Absent, "an empty anthropic folder");
        fs::remove_dir_all(app_data.join("anthropic")).unwrap();
        assert_eq!(anthropic_install(&app_data, &runtime).unwrap(), AnthropicInstall::Absent, "no anthropic folder");

        supersede(&app_data);
        assert_eq!(anthropic_install(&app_data, &runtime).unwrap(), AnthropicInstall::Superseded);

        // A stopped install, a Pi install or a stray file is not a connection the person made.
        let earlier = app_data.join("anthropic/anthropic-b2df6deaf78c-ea4895ef6832");
        let receipt = earlier.join("install-receipt.json");
        let original = fs::read_to_string(&receipt).unwrap();
        fs::write(&receipt, original.replace("\"kind\":\"anthropic\"", "\"kind\":\"pi\"")).unwrap();
        assert_eq!(anthropic_install(&app_data, &runtime).unwrap(), AnthropicInstall::Absent, "a Pi receipt");
        fs::remove_file(&receipt).unwrap();
        assert_eq!(anthropic_install(&app_data, &runtime).unwrap(), AnthropicInstall::Absent, "no receipt");
        fs::write(app_data.join("anthropic/install.log"), "log").unwrap();
        fs::create_dir_all(app_data.join("anthropic/.installing-1234")).unwrap();
        assert_eq!(anthropic_install(&app_data, &runtime).unwrap(), AnthropicInstall::Absent, "a log and a staging folder");
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn a_runtime_that_pins_no_provider_is_damaged() {
        let (base, runtime, app_data) = installed("damaged");
        let receipt = runtime.join("pin-receipt.json");
        let original = fs::read_to_string(&receipt).unwrap();
        for damaged in [original.replace(SOURCE, "25E0"), original.replace(LOCK, "short"), "{}".to_string()] {
            fs::write(&receipt, damaged).unwrap();
            assert_eq!(resolve_app_anthropic(&app_data, &runtime).unwrap_err(), crate::mirror_host_bridge::RUNTIME_MISSING);
            assert_eq!(anthropic_install(&app_data, &runtime).unwrap_err(), crate::mirror_host_bridge::RUNTIME_MISSING);
        }
        let _ = fs::remove_dir_all(&base);
    }
}
