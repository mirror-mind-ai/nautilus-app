//! An image pasted into the Composer, kept in the Journey's folder and attached like any file.
//!
//! A screenshot or an image copied from another program has no file, and an attachment here is a
//! path the agent reads (`inspect_file_attachments`). So the pasted image becomes a file first: in
//! the Journey's own folder, under `pasted/`, where the person can see what was sent and the agent
//! can read it later. From there it follows the attachment route unchanged. A Journey's folder is
//! often a Git repository, some of them public, so the folder made for pasted images keeps them out
//! of it (`.gitignore`); a person who wants them committed deletes that file.
//!
//! The folder is the one the Journey's next turn works in, resolved here as the turn resolves it
//! (`resolved_journey_workspace`) and never taken from the caller: the folder the header shows after
//! "Working in". The name is made here, and an existing file is never replaced.

use std::fs::{self, OpenOptions};
use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chrono::{DateTime, Local};
use image::{ImageFormat, ImageReader};
use tauri::AppHandle;

/// The largest pasted image kept. A full-screen capture of a large display is a few megabytes.
pub(crate) const PASTED_IMAGE_MAX_BYTES: usize = 20 * 1024 * 1024;
pub(crate) const PASTED_IMAGE_FOLDER: &str = "pasted";

const TOO_LARGE: &str = "The pasted image is over the 20 MB limit for a pasted image.";
const NOT_AN_IMAGE: &str = "What was pasted is not an image this application can read (PNG, JPEG, GIF, WebP or BMP).";
const FOLDER_MISSING: &str = "This Journey's folder does not exist, so the pasted image was not kept.";
const PASTED_FOLDER_GITIGNORE: &str = "# Images pasted into the Composer, kept out of Git. Delete this file to commit them.\n*\n";

/// The extension the bytes themselves call for; the clipboard's own label is not trusted.
fn extension_of(bytes: &[u8]) -> Result<&'static str, String> {
    let format = image::guess_format(bytes).map_err(|_| NOT_AN_IMAGE.to_string())?;
    let extension = match format {
        ImageFormat::Png => "png",
        ImageFormat::Jpeg => "jpg",
        ImageFormat::Gif => "gif",
        ImageFormat::WebP => "webp",
        ImageFormat::Bmp => "bmp",
        _ => return Err(NOT_AN_IMAGE.to_string()),
    };
    // A header alone is not an image: the dimensions must read.
    ImageReader::with_format(Cursor::new(bytes), format).into_dimensions().map_err(|_| NOT_AN_IMAGE.to_string())?;
    Ok(extension)
}

/// Writes the pasted bytes as `pasted/pasted-YYYYMMDD-HHMMSS.<ext>` in the Journey's folder, with
/// `-2`, `-3`… when that moment already has a file. The Journey's folder itself is never created.
pub(crate) fn save_pasted_image_at(journey_root: &Path, bytes: &[u8], now: DateTime<Local>) -> Result<PathBuf, String> {
    if bytes.len() > PASTED_IMAGE_MAX_BYTES {
        return Err(TOO_LARGE.to_string());
    }
    let extension = extension_of(bytes)?;
    if !journey_root.is_dir() {
        return Err(FOLDER_MISSING.to_string());
    }
    let folder = journey_root.join(PASTED_IMAGE_FOLDER);
    match fs::symlink_metadata(&folder) {
        Ok(metadata) if metadata.is_dir() => {}
        Ok(_) => return Err(format!("\"{PASTED_IMAGE_FOLDER}\" in this Journey's folder is not a folder, so the pasted image was not kept.")),
        Err(_) => make_pasted_folder(&folder)?,
    }
    let stamp = now.format("%Y%m%d-%H%M%S");
    for attempt in 1..=999_u32 {
        let name = if attempt == 1 { format!("pasted-{stamp}.{extension}") } else { format!("pasted-{stamp}-{attempt}.{extension}") };
        let path = folder.join(name);
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                if let Err(error) = file.write_all(bytes).and_then(|()| file.sync_all()) {
                    drop(file);
                    let _ = fs::remove_file(&path);
                    return Err(format!("Could not write the pasted image: {error}"));
                }
                return Ok(path);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Could not write the pasted image: {error}")),
        }
    }
    Err("Could not name the pasted image: too many were pasted in the same second.".to_string())
}

/// The folder for pasted images, with the file that keeps them out of Git. Only a folder made here
/// gets one: a `pasted` folder the person made is theirs to configure. When that file cannot be
/// written the folder goes too, so the next paste makes both again.
fn make_pasted_folder(folder: &Path) -> Result<(), String> {
    fs::create_dir(folder).map_err(|error| format!("Could not create the folder for pasted images: {error}"))?;
    let ignore = folder.join(".gitignore");
    if let Err(error) = fs::write(&ignore, PASTED_FOLDER_GITIGNORE) {
        let _ = fs::remove_file(&ignore);
        let _ = fs::remove_dir(folder);
        return Err(format!("Could not create the folder for pasted images: {error}"));
    }
    Ok(())
}

/// The bytes of a pasted image, from the base64 the Composer sends. Refused by its length before it
/// is decoded, so an oversized paste costs nothing.
pub(crate) fn pasted_image_bytes(data_base64: &str) -> Result<Vec<u8>, String> {
    if data_base64.len() > PASTED_IMAGE_MAX_BYTES / 3 * 4 + 4 {
        return Err(TOO_LARGE.to_string());
    }
    BASE64_STANDARD.decode(data_base64).map_err(|_| NOT_AN_IMAGE.to_string())
}

#[tauri::command(async)]
pub(crate) fn save_pasted_image(app: AppHandle, journey_id: String, data_base64: String) -> Result<crate::FileAttachmentResponse, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let journey_id = crate::sanitize_journey_id(&journey_id)?;
    let bytes = pasted_image_bytes(&data_base64)?;
    // As a turn does: the Journey's registered folder, or the one made for it when it has none.
    let profile = crate::active_runtime_channel()?;
    let journey_root = crate::resolved_journey_workspace(&app, &journey_id, &profile, true)?.path;
    let saved = save_pasted_image_at(&journey_root, &bytes, Local::now())?;
    crate::inspect_file_attachments_at(&journey_id, &[saved])
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn journey_folder(label: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("nautilus-pasted-{}-{}", label, SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn encoded(format: ImageFormat) -> Vec<u8> {
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(48, 32, image::Rgb([12, 34, 56]))).write_to(&mut bytes, format).unwrap();
        bytes.into_inner()
    }

    fn at(second: u32) -> DateTime<Local> {
        Local.with_ymd_and_hms(2026, 11, 26, 14, 5, second).unwrap()
    }

    #[test]
    fn keeps_a_pasted_image_in_the_journeys_folder_under_pasted_named_by_its_moment() {
        let root = journey_folder("keeps");
        let png = encoded(ImageFormat::Png);
        let saved = save_pasted_image_at(&root, &png, at(9)).unwrap();
        assert_eq!(saved, root.join("pasted").join("pasted-20261126-140509.png"));
        assert_eq!(fs::read(&saved).unwrap(), png);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn never_replaces_a_file_two_pastes_in_one_second_are_two_files() {
        let root = journey_folder("twice");
        let first = save_pasted_image_at(&root, &encoded(ImageFormat::Png), at(9)).unwrap();
        let second = save_pasted_image_at(&root, &encoded(ImageFormat::Jpeg), at(9)).unwrap();
        let third = save_pasted_image_at(&root, &encoded(ImageFormat::Png), at(9)).unwrap();
        assert_eq!(first.file_name().unwrap(), "pasted-20261126-140509.png");
        assert_eq!(second.file_name().unwrap(), "pasted-20261126-140509.jpg");
        assert_eq!(third.file_name().unwrap(), "pasted-20261126-140509-2.png");
        let images = fs::read_dir(root.join("pasted")).unwrap().filter(|entry| entry.as_ref().unwrap().file_name().to_string_lossy().starts_with("pasted-")).count();
        assert_eq!(images, 3);
        fs::remove_dir_all(root).unwrap();
    }

    // A Journey's folder is often a Git repository, and some are public: a screenshot pasted into
    // the Composer was left there as an untracked file that `git add -A` would commit.
    #[test]
    fn the_folder_it_makes_is_kept_out_of_git_and_one_the_person_made_is_left_as_it_is() {
        let root = journey_folder("git");
        save_pasted_image_at(&root, &encoded(ImageFormat::Png), at(9)).unwrap();
        let ignore = fs::read_to_string(root.join("pasted").join(".gitignore")).unwrap();
        assert_eq!(ignore.lines().filter(|line| !line.starts_with('#')).collect::<Vec<_>>(), vec!["*"], "{ignore}");
        // A second paste finds the folder and leaves its file as it is.
        fs::write(root.join("pasted").join(".gitignore"), "edited by the person\n").unwrap();
        save_pasted_image_at(&root, &encoded(ImageFormat::Png), at(10)).unwrap();
        assert_eq!(fs::read_to_string(root.join("pasted").join(".gitignore")).unwrap(), "edited by the person\n");
        fs::remove_dir_all(root).unwrap();

        let own = journey_folder("own");
        fs::create_dir(own.join("pasted")).unwrap();
        save_pasted_image_at(&own, &encoded(ImageFormat::Png), at(9)).unwrap();
        assert!(!own.join("pasted").join(".gitignore").exists(), "a folder the person made is theirs to configure");
        fs::remove_dir_all(own).unwrap();
    }

    #[test]
    fn names_the_file_by_what_the_bytes_are() {
        let root = journey_folder("formats");
        for (format, extension) in [(ImageFormat::Jpeg, "jpg"), (ImageFormat::Gif, "gif"), (ImageFormat::WebP, "webp"), (ImageFormat::Bmp, "bmp")] {
            let saved = save_pasted_image_at(&root, &encoded(format), at(1)).unwrap();
            assert_eq!(saved.extension().unwrap(), extension);
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_what_is_not_an_image_and_writes_nothing() {
        let root = journey_folder("refuses");
        let png = encoded(ImageFormat::Png);
        for bytes in [&b""[..], &b"not an image"[..], &b"%PDF-1.7 a document"[..], &png[..12]] {
            assert_eq!(save_pasted_image_at(&root, bytes, at(1)).unwrap_err(), NOT_AN_IMAGE);
        }
        assert!(!root.join("pasted").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_an_image_over_the_limit_in_words_that_say_the_limit() {
        let root = journey_folder("limit");
        let mut large = encoded(ImageFormat::Png);
        large.resize(PASTED_IMAGE_MAX_BYTES + 1, 0);
        let refusal = save_pasted_image_at(&root, &large, at(1)).unwrap_err();
        assert!(refusal.contains("20 MB limit"), "{refusal}");
        assert!(!root.join("pasted").exists());
        // The Composer's base64 is refused by its length, before any decoding.
        assert_eq!(pasted_image_bytes(&"A".repeat(PASTED_IMAGE_MAX_BYTES / 3 * 4 + 8)).unwrap_err(), TOO_LARGE);
        assert_eq!(pasted_image_bytes("not base64 !").unwrap_err(), NOT_AN_IMAGE);
        assert_eq!(pasted_image_bytes(&BASE64_STANDARD.encode(b"abc")).unwrap(), b"abc");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn does_not_create_the_journeys_folder_and_does_not_write_over_a_file_called_pasted() {
        let root = journey_folder("missing");
        let absent = root.join("gone");
        assert_eq!(save_pasted_image_at(&absent, &encoded(ImageFormat::Png), at(1)).unwrap_err(), FOLDER_MISSING);
        assert!(!absent.exists());
        fs::write(root.join("pasted"), b"a file, not a folder").unwrap();
        let refusal = save_pasted_image_at(&root, &encoded(ImageFormat::Png), at(1)).unwrap_err();
        assert!(refusal.contains("is not a folder"), "{refusal}");
        assert_eq!(fs::read(root.join("pasted")).unwrap(), b"a file, not a folder");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_kept_image_is_attached_like_any_selected_image() {
        let root = journey_folder("attached");
        let saved = save_pasted_image_at(&root, &encoded(ImageFormat::Png), at(9)).unwrap();
        let response = crate::inspect_file_attachments_at("journey-a", &[saved.clone()]).unwrap();
        let attachment = &response.attachments[0];
        assert_eq!(attachment.kind, "image");
        assert_eq!(attachment.display_name, "pasted-20261126-140509.png");
        assert_eq!(Path::new(&attachment.absolute_path).file_name(), saved.file_name());
        assert!(attachment.thumbnail.is_some());
        fs::remove_dir_all(root).unwrap();
    }
}
