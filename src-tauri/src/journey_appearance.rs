use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::{imageops::FilterType, GenericImageView, ImageFormat};
use std::fs::{self, OpenOptions};
use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MAX_SOURCE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_NORMALIZED_BYTES: usize = 2 * 1024 * 1024;
const MAX_CUSTOM_IMAGES: usize = 32;
const IMAGE_SIZE: u32 = 512;
const APPEARANCE_DIRECTORY: &str = "journey-appearance";
const USER_AVATAR_DIRECTORY: &str = "user-avatar";
const USER_AVATAR_FILE: &str = "avatar.png";
/// CR218: a persona's image, kept per home like a Journey's, by persona id.
const PERSONA_APPEARANCE_DIRECTORY: &str = "persona-appearance";
const MAX_PERSONA_IMAGES: usize = 64;

fn sanitize_journey_id(value: &str) -> Result<&str, String> {
    let bytes = value.as_bytes();
    let valid = !bytes.is_empty()
        && bytes.len() <= 80
        && bytes.first().is_some_and(u8::is_ascii_alphanumeric)
        && bytes.last().is_some_and(u8::is_ascii_alphanumeric)
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'-');
    if valid {
        Ok(value)
    } else {
        Err("Journey appearance requires a valid canonical Journey ID.".to_string())
    }
}

fn appearance_image_path(app_data_dir: &Path, journey_id: &str) -> Result<PathBuf, String> {
    let directory = app_data_dir.join(APPEARANCE_DIRECTORY);
    if fs::symlink_metadata(&directory).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err("Journey appearance storage must not be a symbolic link.".to_string());
    }
    Ok(directory.join(format!("{}.png", sanitize_journey_id(journey_id)?)))
}

fn normalized_png(source: &Path) -> Result<Vec<u8>, String> {
    let metadata = fs::metadata(source)
        .map_err(|error| format!("Could not inspect the selected image: {error}"))?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_SOURCE_BYTES {
        return Err("Choose a PNG, JPEG, or WebP image no larger than 5 MiB.".to_string());
    }
    let bytes =
        fs::read(source).map_err(|error| format!("Could not read the selected image: {error}"))?;
    let format = image::guess_format(&bytes)
        .map_err(|_| "The selected file is not a supported image.".to_string())?;
    if !matches!(
        format,
        ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP
    ) {
        return Err("Only PNG, JPEG, and WebP images are supported.".to_string());
    }
    let decoded = image::load_from_memory_with_format(&bytes, format)
        .map_err(|_| "The selected image could not be safely decoded.".to_string())?;
    let (width, height) = decoded.dimensions();
    if width == 0 || height == 0 || width > 16_384 || height > 16_384 {
        return Err("The selected image dimensions are invalid or too large.".to_string());
    }
    let normalized = decoded.resize_to_fill(IMAGE_SIZE, IMAGE_SIZE, FilterType::Lanczos3);
    let mut output = Cursor::new(Vec::new());
    normalized
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|error| format!("Could not normalize the selected image: {error}"))?;
    let output = output.into_inner();
    if output.len() > MAX_NORMALIZED_BYTES {
        return Err("The normalized image exceeds the local storage limit.".to_string());
    }
    Ok(output)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Local image storage has no parent directory.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not prepare local image storage: {error}"))?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "System clock cannot stage a local image.".to_string())?
        .as_nanos();
    let staged = parent.join(format!(
        ".{}.{}.{}.tmp",
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("image"),
        std::process::id(),
        nonce,
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&staged)
            .map_err(|error| format!("Could not stage local image: {error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("Could not write local image: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Could not sync local image: {error}"))?;
        fs::rename(&staged, path)
            .map_err(|error| format!("Could not publish local image: {error}"))?;
        crate::platform::sync_directory(parent)
            .map_err(|error| format!("Could not sync local image directory: {error}"))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(staged);
    }
    result
}

fn data_url(bytes: &[u8]) -> String {
    format!("data:image/png;base64,{}", BASE64_STANDARD.encode(bytes))
}

fn import_at(app_data_dir: &Path, journey_id: &str, source: &Path) -> Result<String, String> {
    let target = appearance_image_path(app_data_dir, journey_id)?;
    if !target.exists() {
        let image_count = target
            .parent()
            .filter(|directory| directory.exists())
            .map(|directory| {
                fs::read_dir(directory)
                    .map_err(|error| {
                        format!("Could not inspect Journey appearance storage: {error}")
                    })
                    .map(|entries| {
                        entries
                            .filter_map(Result::ok)
                            .filter(|entry| {
                                entry
                                    .path()
                                    .extension()
                                    .and_then(|extension| extension.to_str())
                                    == Some("png")
                                    && entry.file_type().is_ok_and(|kind| kind.is_file())
                            })
                            .count()
                    })
            })
            .transpose()?
            .unwrap_or(0);
        if image_count >= MAX_CUSTOM_IMAGES {
            return Err("At most 32 Journeys can use custom images on this device.".to_string());
        }
    }
    let bytes = normalized_png(source)?;
    atomic_write(&target, &bytes)?;
    Ok(data_url(&bytes))
}

#[tauri::command(async)]
pub fn import_journey_custom_image(
    app: AppHandle,
    journey_id: String,
) -> Result<Option<String>, String> {
    let _serialized = crate::native_command_serialization::acquire();
    sanitize_journey_id(&journey_id)?;
    let source = rfd::FileDialog::new()
        .set_title("Choose Journey image")
        .add_filter("Journey images", &["png", "jpg", "jpeg", "webp"])
        .pick_file();
    let Some(source) = source else {
        return Ok(None);
    };
    let app_data_dir = crate::home_state::home_state_dir(&app)
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;
    import_at(&app_data_dir, &journey_id, &source).map(Some)
}

#[tauri::command(async)]
pub fn load_journey_custom_image(
    app: AppHandle,
    journey_id: String,
) -> Result<Option<String>, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let app_data_dir = crate::home_state::home_state_dir(&app)
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;
    let path = appearance_image_path(&app_data_dir, &journey_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Could not inspect Journey appearance: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Stored Journey appearance is not a regular app-controlled file.".to_string());
    }
    let bytes =
        fs::read(&path).map_err(|error| format!("Could not read Journey appearance: {error}"))?;
    if bytes.len() > MAX_NORMALIZED_BYTES
        || image::guess_format(&bytes).ok() != Some(ImageFormat::Png)
    {
        return Err("Stored Journey appearance is invalid.".to_string());
    }
    let decoded = image::load_from_memory_with_format(&bytes, ImageFormat::Png)
        .map_err(|_| "Stored Journey appearance could not be decoded.".to_string())?;
    if decoded.dimensions() != (IMAGE_SIZE, IMAGE_SIZE) {
        return Err("Stored Journey appearance has invalid dimensions.".to_string());
    }
    Ok(Some(data_url(&bytes)))
}

#[tauri::command(async)]
pub fn remove_journey_custom_image(app: AppHandle, journey_id: String) -> Result<(), String> {
    let _serialized = crate::native_command_serialization::acquire();
    let app_data_dir = crate::home_state::home_state_dir(&app)
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;
    let path = appearance_image_path(&app_data_dir, &journey_id)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove Journey appearance: {error}")),
    }
}

fn user_avatar_path(app_data_dir: &Path) -> Result<PathBuf, String> {
    let directory = app_data_dir.join(USER_AVATAR_DIRECTORY);
    if fs::symlink_metadata(&directory).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err("User avatar storage must not be a symbolic link.".to_string());
    }
    let path = directory.join(USER_AVATAR_FILE);
    if fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err("Stored user avatar must not be a symbolic link.".to_string());
    }
    Ok(path)
}

fn import_user_avatar_at(app_data_dir: &Path, source: &Path) -> Result<String, String> {
    let source_metadata = fs::symlink_metadata(source)
        .map_err(|error| format!("Could not inspect the selected avatar: {error}"))?;
    if source_metadata.file_type().is_symlink() {
        return Err("Choose an avatar source that is not a symbolic link.".to_string());
    }
    let bytes = normalized_png(source)?;
    let target = user_avatar_path(app_data_dir)?;
    atomic_write(&target, &bytes)?;
    Ok(data_url(&bytes))
}

fn load_user_avatar_at(app_data_dir: &Path) -> Result<Option<String>, String> {
    let path = user_avatar_path(app_data_dir)?;
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Could not inspect stored user avatar: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Stored user avatar is not a regular app-controlled file.".to_string());
    }
    let bytes = fs::read(&path)
        .map_err(|error| format!("Could not read stored user avatar: {error}"))?;
    if bytes.len() > MAX_NORMALIZED_BYTES
        || image::guess_format(&bytes).ok() != Some(ImageFormat::Png)
    {
        return Err("Stored user avatar is invalid.".to_string());
    }
    let decoded = image::load_from_memory_with_format(&bytes, ImageFormat::Png)
        .map_err(|_| "Stored user avatar could not be decoded.".to_string())?;
    if decoded.dimensions() != (IMAGE_SIZE, IMAGE_SIZE) {
        return Err("Stored user avatar has invalid dimensions.".to_string());
    }
    Ok(Some(data_url(&bytes)))
}

fn remove_user_avatar_at(app_data_dir: &Path) -> Result<(), String> {
    let path = user_avatar_path(app_data_dir)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove user avatar: {error}")),
    }
}

#[tauri::command(async)]
pub fn import_user_avatar(app: AppHandle) -> Result<Option<String>, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let source = rfd::FileDialog::new()
        .set_title("Choose user avatar")
        .add_filter("Avatar images", &["png", "jpg", "jpeg", "webp"])
        .pick_file();
    let Some(source) = source else {
        return Ok(None);
    };
    let app_data_dir = app.path().app_data_dir()
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;
    import_user_avatar_at(&app_data_dir, &source).map(Some)
}

#[tauri::command(async)]
pub fn load_user_avatar(app: AppHandle) -> Result<Option<String>, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let app_data_dir = app.path().app_data_dir()
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;
    load_user_avatar_at(&app_data_dir)
}

#[tauri::command(async)]
pub fn remove_user_avatar(app: AppHandle) -> Result<(), String> {
    let _serialized = crate::native_command_serialization::acquire();
    let app_data_dir = app.path().app_data_dir()
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;
    remove_user_avatar_at(&app_data_dir)
}

/// A persona id, the Journey id's rule: lowercase letters, digits and inner hyphens, at most 80.
fn is_persona_image_id(value: &str) -> bool {
    sanitize_journey_id(value).is_ok()
}

fn persona_appearance_directory(home_state_dir: &Path) -> Result<PathBuf, String> {
    let directory = home_state_dir.join(PERSONA_APPEARANCE_DIRECTORY);
    if fs::symlink_metadata(&directory).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err("Persona appearance storage must not be a symbolic link.".to_string());
    }
    Ok(directory)
}

fn persona_image_path(home_state_dir: &Path, persona: &str) -> Result<PathBuf, String> {
    if !is_persona_image_id(persona) {
        return Err("A persona image requires a valid persona id.".to_string());
    }
    Ok(persona_appearance_directory(home_state_dir)?.join(format!("{persona}.png")))
}

/// The data URL of a PNG Nautilus normalized, or nothing when the file is not one.
fn stored_png(path: &Path) -> Option<String> {
    let metadata = fs::symlink_metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_NORMALIZED_BYTES as u64 {
        return None;
    }
    let bytes = fs::read(path).ok()?;
    if image::guess_format(&bytes).ok() != Some(ImageFormat::Png) {
        return None;
    }
    let decoded = image::load_from_memory_with_format(&bytes, ImageFormat::Png).ok()?;
    (decoded.dimensions() == (IMAGE_SIZE, IMAGE_SIZE)).then(|| data_url(&bytes))
}

fn persona_image_files(directory: &Path) -> Result<Vec<(String, PathBuf)>, String> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(directory).map_err(|error| format!("Could not inspect persona appearance storage: {error}"))?;
    let mut files: Vec<(String, PathBuf)> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        .filter_map(|entry| {
            let path = entry.path();
            let persona = path.file_name()?.to_str()?.strip_suffix(".png")?.to_string();
            is_persona_image_id(&persona).then_some((persona, path))
        })
        .collect();
    files.sort();
    Ok(files)
}

fn import_persona_image_at(home_state_dir: &Path, persona: &str, source: &Path) -> Result<String, String> {
    let target = persona_image_path(home_state_dir, persona)?;
    let source_metadata = fs::symlink_metadata(source).map_err(|error| format!("Could not inspect the selected image: {error}"))?;
    if source_metadata.file_type().is_symlink() {
        return Err("Choose an image that is not a symbolic link.".to_string());
    }
    if !target.exists() && persona_image_files(&persona_appearance_directory(home_state_dir)?)?.len() >= MAX_PERSONA_IMAGES {
        return Err(format!("At most {MAX_PERSONA_IMAGES} personas can have an image on this device."));
    }
    let bytes = normalized_png(source)?;
    atomic_write(&target, &bytes)?;
    Ok(data_url(&bytes))
}

/// Every persona image kept for the home, by id; a file that is not one Nautilus wrote is skipped.
fn load_persona_images_at(home_state_dir: &Path) -> Result<std::collections::BTreeMap<String, String>, String> {
    let directory = persona_appearance_directory(home_state_dir)?;
    Ok(persona_image_files(&directory)?
        .into_iter()
        .filter_map(|(persona, path)| Some((persona, stored_png(&path)?)))
        .take(MAX_PERSONA_IMAGES)
        .collect())
}

fn remove_persona_image_at(home_state_dir: &Path, persona: &str) -> Result<(), String> {
    match fs::remove_file(persona_image_path(home_state_dir, persona)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove the persona image: {error}")),
    }
}

/// CR218: choose an image for `persona` through the file dialog; `None` when none was chosen.
#[tauri::command(async)]
pub fn import_persona_image(app: AppHandle, persona: String) -> Result<Option<String>, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let home_state_dir = crate::home_state::home_state_dir(&app)?;
    persona_image_path(&home_state_dir, &persona)?;
    let source = rfd::FileDialog::new()
        .set_title("Choose persona image")
        .add_filter("Persona images", &["png", "jpg", "jpeg", "webp"])
        .pick_file();
    let Some(source) = source else {
        return Ok(None);
    };
    import_persona_image_at(&home_state_dir, &persona, &source).map(Some)
}

/// CR218: the images of this home's personas, for every bubble.
#[tauri::command(async)]
pub fn load_persona_images(app: AppHandle) -> Result<std::collections::BTreeMap<String, String>, String> {
    let _serialized = crate::native_command_serialization::acquire();
    load_persona_images_at(&crate::home_state::home_state_dir(&app)?)
}

#[tauri::command(async)]
pub fn remove_persona_image(app: AppHandle, persona: String) -> Result<(), String> {
    let _serialized = crate::native_command_serialization::acquire();
    remove_persona_image_at(&crate::home_state::home_state_dir(&app)?, &persona)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, Rgb, RgbImage};
    fn temp_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("nautilus-appearance-{label}-{nonce}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn normalizes_and_stores_only_a_square_png_under_app_data() {
        let root = temp_dir("normalize");
        let source = root.join("wide.jpg");
        let mut wide = RgbImage::from_pixel(1024, 512, Rgb([220, 20, 20]));
        for x in 512..1024 {
            for y in 0..512 {
                wide.put_pixel(x, y, Rgb([20, 20, 220]));
            }
        }
        DynamicImage::ImageRgb8(wide)
            .save_with_format(&source, ImageFormat::Jpeg)
            .unwrap();
        let url = import_at(&root, "journey-one", &source).unwrap();
        let target = appearance_image_path(&root, "journey-one").unwrap();
        let stored = image::open(&target).unwrap();
        assert_eq!(stored.dimensions(), (512, 512));
        assert!(stored.get_pixel(0, 256).0[0] > stored.get_pixel(0, 256).0[2]);
        assert!(stored.get_pixel(511, 256).0[2] > stored.get_pixel(511, 256).0[0]);
        assert!(url.starts_with("data:image/png;base64,"));
        assert!(target.starts_with(root.join(APPEARANCE_DIRECTORY)));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn imports_loads_and_removes_one_channel_local_user_avatar() {
        let root = temp_dir("user-avatar");
        let source = root.join("portrait.webp");
        DynamicImage::ImageRgb8(RgbImage::from_pixel(800, 1200, Rgb([32, 64, 128])))
            .save_with_format(&source, ImageFormat::WebP)
            .unwrap();

        let imported = import_user_avatar_at(&root, &source).unwrap();
        let target = user_avatar_path(&root).unwrap();
        assert!(imported.starts_with("data:image/png;base64,"));
        assert_eq!(image::open(&target).unwrap().dimensions(), (512, 512));
        assert_eq!(load_user_avatar_at(&root).unwrap().as_deref(), Some(imported.as_str()));
        remove_user_avatar_at(&root).unwrap();
        assert_eq!(load_user_avatar_at(&root).unwrap(), None);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn failed_user_avatar_import_preserves_the_previous_valid_image() {
        let root = temp_dir("user-avatar-preserve");
        let source = root.join("portrait.png");
        DynamicImage::ImageRgb8(RgbImage::from_pixel(32, 32, Rgb([10, 20, 30])))
            .save_with_format(&source, ImageFormat::Png)
            .unwrap();
        let previous = import_user_avatar_at(&root, &source).unwrap();
        let invalid = root.join("invalid.svg");
        fs::write(&invalid, "<svg><script>unsafe</script></svg>").unwrap();

        assert!(import_user_avatar_at(&root, &invalid).is_err());
        assert_eq!(load_user_avatar_at(&root).unwrap().as_deref(), Some(previous.as_str()));

        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_user_avatar_source_and_storage_symlinks() {
        use std::os::unix::fs::symlink;
        let root = temp_dir("user-avatar-symlink");
        let outside = temp_dir("user-avatar-symlink-outside");
        let source = outside.join("portrait.png");
        DynamicImage::ImageRgb8(RgbImage::from_pixel(32, 32, Rgb([10, 20, 30])))
            .save_with_format(&source, ImageFormat::Png)
            .unwrap();
        let linked_source = root.join("portrait.png");
        symlink(&source, &linked_source).unwrap();
        assert!(import_user_avatar_at(&root, &linked_source).unwrap_err().contains("symbolic link"));

        symlink(&outside, root.join(USER_AVATAR_DIRECTORY)).unwrap();
        assert!(user_avatar_path(&root).unwrap_err().contains("symbolic link"));

        let _ = fs::remove_file(linked_source);
        let _ = fs::remove_file(root.join(USER_AVATAR_DIRECTORY));
        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
    }

    fn png_source(root: &Path, name: &str, colour: [u8; 3]) -> PathBuf {
        let source = root.join(name);
        DynamicImage::ImageRgb8(RgbImage::from_pixel(64, 48, Rgb(colour)))
            .save_with_format(&source, ImageFormat::Png)
            .unwrap();
        source
    }

    #[test]
    fn cr218_a_persona_image_is_kept_per_home_loaded_with_the_others_and_removed() {
        let root = temp_dir("persona");
        let first = import_persona_image_at(&root, "analista-sql", &png_source(&root, "a.png", [200, 10, 10])).unwrap();
        let second = import_persona_image_at(&root, "mentora", &png_source(&root, "b.png", [10, 10, 200])).unwrap();
        assert!(first.starts_with("data:image/png;base64,"));
        let stored = root.join(PERSONA_APPEARANCE_DIRECTORY).join("analista-sql.png");
        assert_eq!(image::open(&stored).unwrap().dimensions(), (512, 512));
        let loaded = load_persona_images_at(&root).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded["analista-sql"], first);
        assert_eq!(loaded["mentora"], second);
        remove_persona_image_at(&root, "analista-sql").unwrap();
        remove_persona_image_at(&root, "analista-sql").unwrap();
        assert_eq!(load_persona_images_at(&root).unwrap().keys().collect::<Vec<_>>(), vec!["mentora"]);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cr218_a_home_without_images_has_none_and_a_failed_import_keeps_the_previous() {
        let root = temp_dir("persona-none");
        assert!(load_persona_images_at(&root).unwrap().is_empty());
        let previous = import_persona_image_at(&root, "mentora", &png_source(&root, "a.png", [1, 2, 3])).unwrap();
        let invalid = root.join("invalid.svg");
        fs::write(&invalid, "<svg/>").unwrap();
        assert!(import_persona_image_at(&root, "mentora", &invalid).is_err());
        assert_eq!(load_persona_images_at(&root).unwrap()["mentora"], previous);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cr218_only_files_nautilus_wrote_are_loaded() {
        let root = temp_dir("persona-skip");
        let kept = import_persona_image_at(&root, "mentora", &png_source(&root, "a.png", [1, 2, 3])).unwrap();
        let directory = root.join(PERSONA_APPEARANCE_DIRECTORY);
        // Not an id, not a PNG, not 512 px, not a file: each skipped, the rest still loaded.
        fs::copy(directory.join("mentora.png"), directory.join("Bad_Id.png")).unwrap();
        fs::write(directory.join("broken.png"), b"not a png").unwrap();
        png_source(&directory, "small.png", [9, 9, 9]);
        fs::create_dir(directory.join("folder.png")).unwrap();
        fs::write(directory.join("notes.txt"), b"x").unwrap();
        #[cfg(unix)]
        {
            let outside = temp_dir("persona-skip-outside");
            fs::copy(directory.join("mentora.png"), outside.join("valid.png")).unwrap();
            std::os::unix::fs::symlink(outside.join("valid.png"), directory.join("linked.png")).unwrap();
        }
        let loaded = load_persona_images_at(&root).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded["mentora"], kept);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cr218_refuses_bad_ids_links_and_more_than_the_cap() {
        let root = temp_dir("persona-refuse");
        let source = png_source(&root, "a.png", [1, 2, 3]);
        for persona in ["", "../escape", "Mentora", "a b", "a/b", &"a".repeat(81)] {
            assert!(persona_image_path(&root, persona).is_err(), "{persona}");
            assert!(remove_persona_image_at(&root, persona).is_err(), "{persona}");
        }
        #[cfg(unix)]
        {
            let linked = root.join("linked.png");
            std::os::unix::fs::symlink(&source, &linked).unwrap();
            assert!(import_persona_image_at(&root, "mentora", &linked).unwrap_err().contains("symbolic link"));
            let outside = temp_dir("persona-outside");
            std::os::unix::fs::symlink(&outside, root.join(PERSONA_APPEARANCE_DIRECTORY)).unwrap();
            assert!(persona_image_path(&root, "mentora").unwrap_err().contains("symbolic link"));
            assert!(load_persona_images_at(&root).unwrap_err().contains("symbolic link"));
            let _ = fs::remove_file(root.join(PERSONA_APPEARANCE_DIRECTORY));
            let _ = fs::remove_dir_all(outside);
        }
        let directory = root.join(PERSONA_APPEARANCE_DIRECTORY);
        fs::create_dir_all(&directory).unwrap();
        let normalized = import_persona_image_at(&root, "p0", &source).map(|_| directory.join("p0.png")).unwrap();
        for index in 1..MAX_PERSONA_IMAGES {
            fs::copy(&normalized, directory.join(format!("p{index}.png"))).unwrap();
        }
        assert!(import_persona_image_at(&root, "one-more", &source).unwrap_err().contains("64"));
        // Replacing an image already kept is not one more.
        import_persona_image_at(&root, "p3", &source).unwrap();
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_unsafe_ids_unsupported_formats_and_oversized_sources() {
        let root = temp_dir("reject");
        let gif = root.join("animated.gif");
        DynamicImage::ImageRgb8(RgbImage::from_pixel(2, 2, Rgb([1, 2, 3])))
            .save_with_format(&gif, ImageFormat::Gif)
            .unwrap();
        assert!(appearance_image_path(&root, "../escape").is_err());
        assert!(import_at(&root, "journey-one", &gif)
            .unwrap_err()
            .contains("Only PNG"));
        let large = root.join("large.png");
        let file = fs::File::create(&large).unwrap();
        file.set_len(MAX_SOURCE_BYTES + 1).unwrap();
        assert!(import_at(&root, "journey-one", &large)
            .unwrap_err()
            .contains("5 MiB"));
        #[cfg(unix)]
        {
            let outside = temp_dir("outside");
            std::os::unix::fs::symlink(&outside, root.join(APPEARANCE_DIRECTORY)).unwrap();
            assert!(appearance_image_path(&root, "journey-one")
                .unwrap_err()
                .contains("symbolic link"));
            let _ = fs::remove_file(root.join(APPEARANCE_DIRECTORY));
            let _ = fs::remove_dir_all(outside);
        }
        let _ = fs::remove_dir_all(root);
    }
}
