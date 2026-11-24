//! CR262: sign in to Claude again from the app.
//!
//! Claude through Claude Code (CR173) uses the Claude sign-in on this computer, which Claude Code
//! keeps in `~/.claude` and the system keychain: the same one the person's own Claude Code reads.
//! Until this CR the app only knew that its Claude Code was installed, said Connected on that alone,
//! and had no way to sign in again once the sign-in expired.
//!
//! Here the app's own Claude Code is asked whether it is signed in (`auth status --json`, which
//! prints no credential) and runs its own `auth login --claudeai`. Run without a terminal, that
//! command opens the browser itself on a local callback, prints a page to visit if the browser did
//! not open, and reads a pasted code from its input if that page shows one. Its lines become the
//! same sign-in events Pi's do (`pi-login-event`), so Settings shows it in the same panel.
//! Nothing here reads, keeps or logs a credential; a pasted code passes through once, to its input.

use crate::pi_auth::{PiLoginEvent, PiReadiness};
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// The provider a Claude sign-in reports as done; not one of Pi's.
pub(crate) const CLAUDE_LOGIN_PROVIDER: &str = "claude-code";
/// The one prompt a Claude sign-in asks: the code its page shows when the browser could not hand
/// the sign-in back by itself.
pub(crate) const CODE_PROMPT_ID: &str = "code";
const STATUS_DEADLINE: Duration = Duration::from_secs(30);
const LOGIN_DEADLINE: Duration = Duration::from_secs(15 * 60);
const LOGOUT_DEADLINE: Duration = Duration::from_secs(30);
const OUTPUT_LIMIT: u64 = 256 * 1024;

/// Whether the app's Claude Code is signed in, and how.
#[derive(Clone, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClaudeSignIn {
    pub signed_in: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
}

/// The Claude Agent SDK's name for this platform, as its per-platform packages are named.
pub(crate) fn sdk_platform(os: &str, arch: &str) -> Option<String> {
    let os = match os {
        "macos" => "darwin",
        "windows" => "win32",
        "linux" => "linux",
        _ => return None,
    };
    let arch = match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        _ => return None,
    };
    Some(format!("{os}-{arch}"))
}

/// The app's own Claude Code binary, beside the installed provider whose Pi extension is `entry`
/// (`<install>/provider/src/index.ts`).
pub(crate) fn claude_code_binary(entry: &Path) -> Option<PathBuf> {
    let install = entry.parent()?.parent()?.parent()?;
    let platform = sdk_platform(std::env::consts::OS, std::env::consts::ARCH)?;
    let name = if cfg!(windows) { "claude.exe" } else { "claude" };
    let binary = install.join("node_modules").join("@anthropic-ai").join(format!("claude-agent-sdk-{platform}")).join(name);
    crate::platform::executable_file(&binary).then_some(binary)
}

/// The app's Claude Code with the person's HOME and USER, the system's tool folders (the sign-in
/// opens the browser through them) and nothing else from the app's environment. On macOS Claude
/// Code finds its sign-in in the keychain by USER: without it, it says it is signed out.
pub(crate) fn claude_command(binary: &Path, home: &Path, cwd: &Path, args: &[&str]) -> Command {
    let mut command = Command::new(binary);
    crate::platform::without_console(&mut command);
    #[cfg(windows)]
    let path = std::env::join_paths(crate::platform::system_tool_directories()).unwrap_or_default();
    #[cfg(not(windows))]
    let path = "/usr/bin:/bin";
    command.args(args).env_clear().env("PATH", path).current_dir(cwd);
    #[cfg(unix)]
    if let Some(user) = std::env::var_os("USER").filter(|user| !user.is_empty()) {
        command.env("USER", user);
    }
    crate::platform::home_environment(&mut command, home);
    crate::platform::system_environment(&mut command);
    command
}

/// `auth status --json`'s answer. It is printed whatever the exit code, which is 1 when signed out.
pub(crate) fn parse_auth_status(stdout: &str) -> Option<ClaudeSignIn> {
    let start = stdout.find('{')?;
    let end = stdout.rfind('}')?;
    let value: Value = serde_json::from_str(stdout.get(start..=end)?).ok()?;
    let signed_in = value.get("loggedIn")?.as_bool()?;
    let method = value
        .get("authMethod")
        .and_then(Value::as_str)
        .filter(|method| !method.is_empty() && *method != "none" && method.len() <= 40)
        .map(str::to_string);
    Some(ClaudeSignIn { signed_in, method })
}

pub(crate) fn run_status(mut command: Command) -> Result<ClaudeSignIn, String> {
    let unreadable = || "Claude Code did not say whether it is signed in. Try again.".to_string();
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "Nautilus's Claude Code could not be started. Reinstall it from Model providers.".to_string())?;
    let mut stdout = child.stdout.take().expect("piped");
    let reader = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = (&mut stdout).take(OUTPUT_LIMIT).read_to_string(&mut text);
        text
    });
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started.elapsed() < STATUS_DEADLINE => std::thread::sleep(Duration::from_millis(25)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Claude Code did not answer in time. Try again.".to_string());
            }
        }
    }
    parse_auth_status(&reader.join().unwrap_or_default()).ok_or_else(unreadable)
}

/// `auth logout`, run to its end. What it prints and how it exits are not read: whether the person
/// is signed out is what `auth status` says afterwards.
fn run_logout(mut command: Command, deadline: Duration) -> Result<(), String> {
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "Nautilus's Claude Code could not be started. Reinstall it from Model providers.".to_string())?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) if started.elapsed() < deadline => std::thread::sleep(Duration::from_millis(25)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Claude Code did not answer in time. Try again.".to_string());
            }
        }
    }
}

/// CR282: signs the app's Claude Code out through its own `auth logout`, then asks `auth status`
/// (made by `status`) and reports what it says; a sign-in that is still there is an error, whatever
/// the logout said. The sign-in is the one the person's own Claude Code reads, so it ends for both.
pub(crate) fn sign_out(logout: Command, status: impl FnOnce() -> Command, deadline: Duration) -> Result<ClaudeSignIn, String> {
    run_logout(logout, deadline)?;
    let after = run_status(status())?;
    if after.signed_in {
        return Err("Claude Code could not sign out. Try again, or run `claude auth logout` in a terminal.".to_string());
    }
    Ok(after)
}

/// The screen's events for one line of `auth login`: the page to visit, and the code it may show.
pub(crate) fn login_line_events(session: u64, line: &str) -> Vec<PiLoginEvent> {
    let Some(at) = line.find("visit:") else { return Vec::new() };
    let candidate = line[at + "visit:".len()..].split_whitespace().next().unwrap_or("");
    let Some(url) = crate::pi_auth::https_url(candidate) else { return Vec::new() };
    vec![
        PiLoginEvent::AuthUrl {
            session,
            url,
            instructions: Some("Finish signing in to Claude in your browser. If the page shows a code instead, paste it below.".to_string()),
        },
        PiLoginEvent::Prompt {
            session,
            id: CODE_PROMPT_ID.to_string(),
            prompt: "manual_code".to_string(),
            message: "Code from the sign-in page, only if it shows one".to_string(),
            placeholder: Some("Paste the code".to_string()),
        },
    ]
}

/// Why a sign-in that exited unsuccessfully did not finish, from what Claude Code wrote to stderr.
pub(crate) fn describe_claude_login_failure(stderr: &str) -> String {
    let reason = stderr.lines().map(str::trim).filter(|line| !line.is_empty()).last().unwrap_or("");
    let reason = reason.strip_prefix("Login failed:").unwrap_or(reason).trim();
    if reason.is_empty() {
        return "The Claude sign-in did not finish. Try again.".to_string();
    }
    let reason: String = reason.chars().take(300).collect();
    format!("The Claude sign-in did not finish: {reason}")
}

pub(crate) fn readiness_of(sign_in: &ClaudeSignIn) -> Option<PiReadiness> {
    sign_in.signed_in.then(|| PiReadiness { kind: "oauth".to_string(), source: Some("Claude sign-in".to_string()) })
}

struct SignInSession {
    id: u64,
    stdin: ChildStdin,
    child: Arc<Mutex<Child>>,
    cancelled: Arc<AtomicBool>,
}

static SIGN_IN: Mutex<Option<SignInSession>> = Mutex::new(None);

/// Start a sign-in and report its events through `emit`; `after` asks the status once it exits.
pub(crate) fn start_sign_in(
    command: Command,
    emit: impl Fn(PiLoginEvent) + Send + 'static,
    after: impl FnOnce() -> Option<PiReadiness> + Send + 'static,
) -> Result<u64, String> {
    let mut command = command;
    let mut guard = SIGN_IN.lock().map_err(|_| "The sign-in could not be started.".to_string())?;
    if guard.is_some() {
        return Err("A sign-in is already in progress. Finish or cancel it first.".to_string());
    }
    let session = crate::pi_auth::next_session()?;
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Nautilus's Claude Code could not be started. Reinstall it from Model providers.".to_string())?;
    let stdin = child.stdin.take().expect("piped");
    let stdout = child.stdout.take().expect("piped");
    let mut stderr = child.stderr.take().expect("piped");
    let child = Arc::new(Mutex::new(child));
    let cancelled = Arc::new(AtomicBool::new(false));
    *guard = Some(SignInSession { id: session, stdin, child: child.clone(), cancelled: cancelled.clone() });
    drop(guard);
    let deadline = child.clone();
    std::thread::spawn(move || {
        std::thread::sleep(LOGIN_DEADLINE);
        if let Ok(mut child) = deadline.lock() {
            if matches!(child.try_wait(), Ok(None)) {
                let _ = child.kill();
            }
        }
    });
    let errors = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = (&mut stderr).take(OUTPUT_LIMIT).read_to_string(&mut text);
        text
    });
    std::thread::spawn(move || {
        // The browser is opened by Claude Code itself, on its own local callback; the page printed
        // here is the one "Open the sign-in page again" opens, which shows a code to paste.
        for line in BufReader::new(stdout.take(OUTPUT_LIMIT)).lines() {
            let Ok(line) = line else { break };
            for event in login_line_events(session, &line) {
                emit(event);
            }
        }
        // Polled, never waited on under the lock: a cancel takes the same lock to kill it.
        let succeeded = loop {
            let exit = child.lock().map(|mut child| child.try_wait()).unwrap_or(Ok(None));
            match exit {
                Ok(Some(status)) => break status.success(),
                Ok(None) => std::thread::sleep(Duration::from_millis(25)),
                Err(_) => break false,
            }
        };
        let stderr = errors.join().unwrap_or_default();
        if let Ok(mut guard) = SIGN_IN.lock() {
            if guard.as_ref().is_some_and(|sign_in| sign_in.id == session) {
                *guard = None;
            }
        }
        emit(if cancelled.load(Ordering::SeqCst) {
            PiLoginEvent::Failed { session, message: "Sign-in cancelled.".to_string() }
        } else if succeeded {
            PiLoginEvent::Done { session, provider: CLAUDE_LOGIN_PROVIDER.to_string(), ready: after() }
        } else {
            PiLoginEvent::Failed { session, message: describe_claude_login_failure(&stderr) }
        });
    });
    Ok(session)
}

pub(crate) fn answer_sign_in(session: u64, prompt_id: &str, value: &str) -> Result<(), String> {
    let value = value.trim();
    if prompt_id != CODE_PROMPT_ID || value.is_empty() || value.len() > 4096 || value.contains(['\n', '\r']) {
        return Err("That code cannot be sent.".to_string());
    }
    let mut guard = SIGN_IN.lock().map_err(|_| "The sign-in could not be reached.".to_string())?;
    let sign_in = guard.as_mut().filter(|sign_in| sign_in.id == session).ok_or_else(|| "That sign-in has ended.".to_string())?;
    writeln!(sign_in.stdin, "{value}").map_err(|_| "That sign-in has ended.".to_string())
}

/// Claude Code has no cancel to ask for, so the sign-in is ended at once.
pub(crate) fn cancel_sign_in(session: u64) -> Result<(), String> {
    let guard = SIGN_IN.lock().map_err(|_| "The sign-in could not be reached.".to_string())?;
    let Some(sign_in) = guard.as_ref().filter(|sign_in| sign_in.id == session) else { return Ok(()) };
    sign_in.cancelled.store(true, Ordering::SeqCst);
    if let Ok(mut child) = sign_in.child.lock() {
        let _ = child.kill();
    }
    Ok(())
}

pub(crate) fn sign_in_running() -> bool {
    SIGN_IN.lock().map(|guard| guard.is_some()).unwrap_or(true)
}

/// The app's Claude Code and where to run it from, when it is installed as the runtime pins it.
fn claude_context(app: &AppHandle) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let app_data_root = app.path().app_data_dir().map_err(|error| format!("Could not resolve app data directory: {error}"))?;
    let runtime_dir = crate::mirror_host_bridge::current_runtime_dir()?;
    let entry = crate::anthropic_provider::resolve_app_anthropic(&app_data_root, &runtime_dir)?;
    let binary = claude_code_binary(&entry).ok_or_else(|| crate::anthropic_provider::ANTHROPIC_NOT_INSTALLED.to_string())?;
    let home = crate::platform::home_directory().ok_or_else(|| "Could not resolve your home folder.".to_string())?;
    Ok((binary, home, app_data_root))
}

#[tauri::command]
pub(crate) async fn inspect_claude_sign_in(app: AppHandle) -> Result<ClaudeSignIn, String> {
    let (binary, home, cwd) = claude_context(&app)?;
    tauri::async_runtime::spawn_blocking(move || run_status(claude_command(&binary, &home, &cwd, &["auth", "status", "--json"])))
        .await
        .map_err(|error| format!("Asking Claude Code stopped: {error}"))?
}

#[tauri::command]
pub(crate) async fn start_claude_login(app: AppHandle) -> Result<u64, String> {
    if crate::pi_auth::login_in_progress() {
        return Err("A sign-in is already in progress. Finish or cancel it first.".to_string());
    }
    let (binary, home, cwd) = claude_context(&app)?;
    let command = claude_command(&binary, &home, &cwd, &["auth", "login", "--claudeai"]);
    let emitter = app.clone();
    start_sign_in(
        command,
        move |event| {
            let _ = emitter.emit(crate::pi_auth::PI_LOGIN_EVENT, event);
        },
        move || run_status(claude_command(&binary, &home, &cwd, &["auth", "status", "--json"])).ok().as_ref().and_then(readiness_of),
    )
}

#[tauri::command]
pub(crate) async fn sign_out_of_claude(app: AppHandle) -> Result<ClaudeSignIn, String> {
    if crate::pi_auth::login_in_progress() || sign_in_running() {
        return Err("A sign-in is in progress. Finish or cancel it first.".to_string());
    }
    let (binary, home, cwd) = claude_context(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        sign_out(
            claude_command(&binary, &home, &cwd, &["auth", "logout"]),
            || claude_command(&binary, &home, &cwd, &["auth", "status", "--json"]),
            LOGOUT_DEADLINE,
        )
    })
    .await
    .map_err(|error| format!("Signing out of Claude stopped: {error}"))?
}

#[tauri::command]
pub(crate) async fn answer_claude_login(session: u64, prompt_id: String, value: String) -> Result<(), String> {
    answer_sign_in(session, &prompt_id, &value)
}

#[tauri::command]
pub(crate) async fn cancel_claude_login(session: u64) -> Result<(), String> {
    cancel_sign_in(session)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    static SERIAL: Mutex<()> = Mutex::new(());

    fn scratch(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("claude-sign-in-{label}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    /// A shell standing in for `claude auth login`, saying what the real one says without a terminal.
    #[cfg(unix)]
    fn claude_playing(label: &str, script: &str) -> Command {
        let path = scratch(label).join("claude.sh");
        std::fs::write(&path, script).unwrap();
        let mut command = Command::new("/bin/sh");
        command.arg(path);
        command
    }

    #[cfg(unix)]
    const LOGIN: &str = r#"echo 'Opening browser to sign in…'
echo "If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&state=s"
printf 'Paste code here if prompted > '
read line
if [ "$line" = "good#code" ]; then echo 'Login successful.'; exit 0; fi
echo 'Login failed: Request failed with status code 400' >&2
exit 1
"#;

    #[test]
    fn the_status_says_signed_in_or_not_and_never_more() {
        assert_eq!(
            parse_auth_status(r#"{"loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty", "email": "a@b.c"}"#),
            Some(ClaudeSignIn { signed_in: true, method: Some("claude.ai".into()) })
        );
        assert_eq!(
            parse_auth_status("{\n  \"loggedIn\": false,\n  \"authMethod\": \"none\",\n  \"apiProvider\": \"firstParty\"\n}\n"),
            Some(ClaudeSignIn { signed_in: false, method: None })
        );
        assert_eq!(parse_auth_status("Not a status"), None);
        assert_eq!(parse_auth_status(r#"{"authMethod":"claude.ai"}"#), None, "no loggedIn, no answer");
        let shown = serde_json::to_string(&parse_auth_status(r#"{"loggedIn":true,"authMethod":"claude.ai","email":"a@b.c"}"#).unwrap()).unwrap();
        assert!(!shown.contains("a@b.c"), "{shown}");
    }

    #[cfg(unix)]
    #[test]
    fn the_status_is_read_whatever_the_exit_code() {
        let signed_out = claude_playing("status-out", "echo '{\"loggedIn\": false, \"authMethod\": \"none\"}'\nexit 1\n");
        assert_eq!(run_status(signed_out), Ok(ClaudeSignIn { signed_in: false, method: None }));
        assert!(run_status(claude_playing("status-garbled", "echo 'oops'\n")).is_err());
    }

    #[test]
    fn the_binary_is_the_sdk_platform_package_beside_the_provider() {
        assert_eq!(sdk_platform("macos", "x86_64").as_deref(), Some("darwin-x64"));
        assert_eq!(sdk_platform("macos", "aarch64").as_deref(), Some("darwin-arm64"));
        assert_eq!(sdk_platform("windows", "x86_64").as_deref(), Some("win32-x64"));
        assert_eq!(sdk_platform("linux", "aarch64").as_deref(), Some("linux-arm64"));
        assert_eq!(sdk_platform("freebsd", "x86_64"), None);

        let install = scratch("binary").join("anthropic-a-b");
        let entry = install.join("provider/src/index.ts");
        std::fs::create_dir_all(entry.parent().unwrap()).unwrap();
        std::fs::write(&entry, "").unwrap();
        assert_eq!(claude_code_binary(&entry), None, "not installed");
        let platform = sdk_platform(std::env::consts::OS, std::env::consts::ARCH).unwrap();
        let name = if cfg!(windows) { "claude.exe" } else { "claude" };
        let binary = install.join("node_modules/@anthropic-ai").join(format!("claude-agent-sdk-{platform}")).join(name);
        std::fs::create_dir_all(binary.parent().unwrap()).unwrap();
        std::fs::write(&binary, "").unwrap();
        crate::platform::mark_executable(&binary).unwrap();
        assert_eq!(claude_code_binary(&entry), Some(binary));
    }

    #[test]
    fn claude_gets_only_home_and_the_system_tools() {
        let command = claude_command(Path::new("/app/claude"), Path::new("/Users/ana"), Path::new("/data"), &["auth", "status", "--json"]);
        assert_eq!(command.get_program(), "/app/claude");
        let args: Vec<_> = command.get_args().map(|arg| arg.to_string_lossy().into_owned()).collect();
        assert_eq!(args, ["auth", "status", "--json"]);
        let envs: Vec<_> = command.get_envs().map(|(key, value)| (key.to_string_lossy().into_owned(), value.map(|v| v.to_string_lossy().into_owned()))).collect();
        assert!(envs.contains(&("HOME".into(), Some("/Users/ana".into()))));
        #[cfg(unix)]
        assert!(envs.contains(&("PATH".into(), Some("/usr/bin:/bin".into()))));
        // Measured on 2026-11-20: without USER, Claude Code on macOS does not find its sign-in in the
        // keychain and says it is signed out, with the person signed in.
        #[cfg(unix)]
        if let Some(user) = std::env::var("USER").ok().filter(|user| !user.is_empty()) {
            assert!(envs.contains(&("USER".into(), Some(user))));
        }
        let ours: Vec<_> = envs.iter().filter(|(key, _)| !matches!(key.as_str(), "SYSTEMROOT" | "SYSTEMDRIVE" | "USERPROFILE" | "USER")).collect();
        assert_eq!(ours.len(), 2, "{ours:?}");
        let source = include_str!("claude_sign_in.rs");
        let body = &source[source.find("pub(crate) fn claude_command(").unwrap()..];
        assert!(body[..body.find("\n}\n").unwrap()].contains(".env_clear()"));
    }

    #[test]
    fn the_page_to_visit_becomes_the_sign_in_page_and_a_field_for_its_code() {
        assert!(login_line_events(4, "Opening browser to sign in…").is_empty());
        let events = login_line_events(4, "If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&state=s");
        assert!(matches!(&events[0], PiLoginEvent::AuthUrl { session: 4, url, .. } if url == "https://claude.com/cai/oauth/authorize?code=true&state=s"));
        assert!(matches!(&events[1], PiLoginEvent::Prompt { session: 4, id, prompt, .. } if id == CODE_PROMPT_ID && prompt == "manual_code"));
        assert!(login_line_events(4, "If the browser didn't open, visit: http://claude.com/plain").is_empty(), "https only");
    }

    #[test]
    fn a_failed_sign_in_says_why_in_one_line() {
        assert_eq!(
            describe_claude_login_failure("Login failed: Request failed with status code 400\n"),
            "The Claude sign-in did not finish: Request failed with status code 400"
        );
        assert_eq!(describe_claude_login_failure(""), "The Claude sign-in did not finish. Try again.");
        assert!(describe_claude_login_failure(&"x".repeat(5000)).len() < 400);
    }

    #[cfg(unix)]
    #[test]
    fn a_pasted_code_finishes_the_sign_in_and_the_status_is_asked_after() {
        let _serial = SERIAL.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let (events, received) = mpsc::channel();
        let ready = Some(PiReadiness { kind: "oauth".into(), source: Some("Claude sign-in".into()) });
        let answered = ready.clone();
        let session = start_sign_in(claude_playing("good", LOGIN), move |event| events.send(event).unwrap(), move || answered).unwrap();
        assert!(start_sign_in(Command::new("/usr/bin/true"), |_| {}, || None).unwrap_err().contains("already in progress"));
        let wait = || received.recv_timeout(Duration::from_secs(10)).unwrap();
        assert!(matches!(wait(), PiLoginEvent::AuthUrl { .. }));
        assert!(matches!(wait(), PiLoginEvent::Prompt { .. }));
        assert!(answer_sign_in(session, "other", "good#code").is_err(), "only the code prompt");
        assert!(answer_sign_in(session, CODE_PROMPT_ID, "two\nlines").is_err(), "one line");
        assert!(answer_sign_in(session + 1, CODE_PROMPT_ID, "good#code").is_err(), "another session's answer");
        answer_sign_in(session, CODE_PROMPT_ID, "  good#code  ").unwrap();
        let done = wait();
        assert_eq!(done, PiLoginEvent::Done { session, provider: CLAUDE_LOGIN_PROVIDER.into(), ready });
        assert!(received.recv_timeout(Duration::from_millis(500)).is_err(), "ended once");
        assert!(!sign_in_running(), "the slot is free afterwards");
    }

    #[cfg(unix)]
    #[test]
    fn a_refused_code_says_claudes_reason() {
        let _serial = SERIAL.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let (events, received) = mpsc::channel();
        let session = start_sign_in(claude_playing("bad", LOGIN), move |event| events.send(event).unwrap(), || panic!("not asked after a failure")).unwrap();
        let wait = || received.recv_timeout(Duration::from_secs(10)).unwrap();
        wait();
        wait();
        answer_sign_in(session, CODE_PROMPT_ID, "bad").unwrap();
        assert_eq!(
            wait(),
            PiLoginEvent::Failed { session, message: "The Claude sign-in did not finish: Request failed with status code 400".into() }
        );
    }

    #[cfg(unix)]
    #[test]
    fn cancel_ends_a_waiting_sign_in_in_its_own_words() {
        let _serial = SERIAL.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let (events, received) = mpsc::channel();
        let session = start_sign_in(claude_playing("waiting", "exec sleep 60\n"), move |event| events.send(event).unwrap(), || None).unwrap();
        assert!(sign_in_running());
        cancel_sign_in(session).unwrap();
        assert_eq!(received.recv_timeout(Duration::from_secs(10)).unwrap(), PiLoginEvent::Failed { session, message: "Sign-in cancelled.".into() });
        std::thread::sleep(Duration::from_millis(100));
        assert!(!sign_in_running());
    }

    // CR282: signing out runs Claude Code's own `auth logout` and believes only what `auth status`
    // says afterwards: the exit code of the logout is not the answer.
    #[cfg(unix)]
    fn signed_in_marker(label: &str) -> PathBuf {
        let marker = scratch(label).join("signed-in");
        std::fs::write(&marker, "").unwrap();
        marker
    }

    #[cfg(unix)]
    fn status_reading(label: &str, marker: &Path) -> Command {
        let script = format!(
            "if [ -e '{0}' ]; then echo '{{\"loggedIn\": true, \"authMethod\": \"claude.ai\"}}'; else echo '{{\"loggedIn\": false, \"authMethod\": \"none\"}}'; exit 1; fi\n",
            marker.display()
        );
        claude_playing(label, &script)
    }

    #[cfg(unix)]
    #[test]
    fn signing_out_removes_the_sign_in_and_reports_what_status_then_says() {
        let marker = signed_in_marker("out-ok");
        let logout = claude_playing("out-ok-logout", &format!("rm -f '{}'\necho 'Successfully logged out'\n", marker.display()));
        let result = sign_out(logout, || status_reading("out-ok-status", &marker), Duration::from_secs(10));
        assert_eq!(result, Ok(ClaudeSignIn { signed_in: false, method: None }));
        assert!(!marker.exists());
    }

    #[cfg(unix)]
    #[test]
    fn a_logout_that_exits_badly_is_still_a_sign_out_when_status_says_signed_out() {
        let marker = scratch("out-already").join("signed-in"); // never created: already signed out
        let logout = claude_playing("out-already-logout", "echo 'Not logged in' >&2\nexit 1\n");
        assert_eq!(sign_out(logout, || status_reading("out-already-status", &marker), Duration::from_secs(10)).map(|status| status.signed_in), Ok(false));
    }

    #[cfg(unix)]
    #[test]
    fn a_logout_that_leaves_the_sign_in_says_so_even_when_it_exits_well() {
        let marker = signed_in_marker("out-stays");
        let logout = claude_playing("out-stays-logout", "echo 'Successfully logged out'\nexit 0\n");
        let error = sign_out(logout, || status_reading("out-stays-status", &marker), Duration::from_secs(10)).unwrap_err();
        assert!(error.contains("could not sign out"), "{error}");
        assert!(marker.exists());
    }

    #[cfg(unix)]
    #[test]
    fn a_logout_that_never_ends_is_stopped_and_status_is_not_trusted_after_it() {
        let marker = signed_in_marker("out-hangs");
        let error = sign_out(claude_playing("out-hangs-logout", "exec sleep 30\n"), || panic!("not asked after a timeout"), Duration::from_millis(300)).unwrap_err();
        assert_eq!(error, "Claude Code did not answer in time. Try again.");
        assert!(marker.exists());
    }

    #[test]
    fn a_claude_code_that_cannot_be_started_says_to_reinstall_it() {
        let error = sign_out(Command::new("/nonexistent/claude"), || panic!("not asked"), Duration::from_secs(1)).unwrap_err();
        assert!(error.contains("could not be started"), "{error}");
    }
}
