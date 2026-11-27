//! Files copied in the file manager and pasted into the Composer, attached by their own paths.
//!
//! A paste hands the page the bytes of a copied file and its name, never where it is. An attachment
//! is a path the agent reads, so a pasted file would have to be copied somewhere first, as a pasted
//! image is (`pasted_image`). The clipboard does say where the files are: on Windows, as the list
//! Explorer puts there (`CF_HDROP`). This reads that list at the moment of the paste, keeps the
//! paths whose names are the ones the paste carried, and hands them to the attachment route as
//! dropped files are. Nothing is copied and nothing is written.
//!
//! Elsewhere the list is not read yet and the answer is no files, which leaves a paste as it was.

use std::path::PathBuf;

/// The list is a few hundred bytes for a handful of files; a block past this is not one.
const DROP_BLOCK_MAX_BYTES: usize = 4 * 1024 * 1024;

/// The paths in a `DROPFILES` block: a 20-byte header whose first field is the offset of the list
/// and whose last says whether it is wide, then the paths as NUL-terminated UTF-16, ended by an
/// empty one. A block that is not wide (no program of this century writes one) or is cut short
/// answers with what could be read whole, or nothing.
pub(crate) fn paths_in_drop_block(block: &[u8]) -> Vec<PathBuf> {
    const HEADER: usize = 20;
    if block.len() < HEADER || block.len() > DROP_BLOCK_MAX_BYTES {
        return Vec::new();
    }
    let field = |at: usize| u32::from_le_bytes([block[at], block[at + 1], block[at + 2], block[at + 3]]);
    let (offset, wide) = (field(0) as usize, field(16) != 0);
    if !wide || offset < HEADER || offset > block.len() {
        return Vec::new();
    }
    let units: Vec<u16> = block[offset..].chunks_exact(2).map(|pair| u16::from_le_bytes([pair[0], pair[1]])).collect();
    let mut paths = Vec::new();
    let mut start = 0;
    for (index, unit) in units.iter().enumerate() {
        if *unit != 0 {
            continue;
        }
        if index == start {
            return paths; // the empty string that ends the list
        }
        match String::from_utf16(&units[start..index]) {
            Ok(path) => paths.push(PathBuf::from(path)),
            Err(_) => return Vec::new(),
        }
        start = index + 1;
    }
    Vec::new() // the list never ended: the block was cut short
}

/// The clipboard's paths that the paste is about: every pasted name must be the name of exactly one
/// path, compared as the file system compares them here, or the answer is none. So a clipboard that
/// changed between the paste and this read attaches nothing by path.
pub(crate) fn paths_named(paths: &[PathBuf], pasted_names: &[String]) -> Vec<PathBuf> {
    if pasted_names.is_empty() || paths.len() != pasted_names.len() {
        return Vec::new();
    }
    let name_of = |path: &PathBuf| path.file_name().map(|name| name.to_string_lossy().to_lowercase());
    let mut left: Vec<&PathBuf> = paths.iter().collect();
    let mut kept = Vec::with_capacity(paths.len());
    for pasted in pasted_names {
        let wanted = pasted.to_lowercase();
        let Some(position) = left.iter().position(|path| name_of(path).as_deref() == Some(wanted.as_str())) else {
            return Vec::new();
        };
        kept.push(left.remove(position).clone());
    }
    kept
}

/// The file list on the clipboard, as its raw block, or nothing when the clipboard holds no files.
#[cfg(windows)]
fn clipboard_drop_block() -> Option<Vec<u8>> {
    use windows_sys::Win32::System::DataExchange::{CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard};
    use windows_sys::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};
    const CF_HDROP: u32 = 15;
    // SAFETY: plain Win32 calls. The clipboard is opened and closed here; the block is the
    // clipboard's own memory, read while locked and copied before it is unlocked, and its size is
    // the one the system reports for that handle.
    unsafe {
        if IsClipboardFormatAvailable(CF_HDROP) == 0 {
            return None;
        }
        // Another program may hold the clipboard for a moment, as the one that was just copied from.
        let mut opened = false;
        for _ in 0..10 {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        if !opened {
            return None;
        }
        let handle = GetClipboardData(CF_HDROP);
        let mut block = None;
        if !handle.is_null() {
            let size = GlobalSize(handle as _);
            if size > 0 && size <= DROP_BLOCK_MAX_BYTES {
                let data = GlobalLock(handle as _) as *const u8;
                if !data.is_null() {
                    block = Some(std::slice::from_raw_parts(data, size).to_vec());
                    GlobalUnlock(handle as _);
                }
            }
        }
        CloseClipboard();
        block
    }
}

#[cfg(not(windows))]
fn clipboard_drop_block() -> Option<Vec<u8>> {
    None
}

/// The files of a paste, by their own paths, inspected as dropped files are. `names` are the names
/// the paste event carried. No attachments when the clipboard holds no such files: the paste was
/// an image with no file, or this is not Windows.
#[tauri::command(async)]
pub(crate) fn inspect_clipboard_files(journey_id: String, names: Vec<String>) -> Result<crate::FileAttachmentResponse, String> {
    let _serialized = crate::native_command_serialization::acquire();
    let journey_id = crate::sanitize_journey_id(&journey_id)?;
    let paths = clipboard_drop_block().map(|block| paths_in_drop_block(&block)).unwrap_or_default();
    crate::inspect_file_attachments_at(&journey_id, &paths_named(&paths, &names))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A block as Explorer writes it: the header, then the paths in UTF-16 with their terminators.
    fn drop_block(paths: &[&str], wide: bool) -> Vec<u8> {
        let mut block = Vec::new();
        block.extend_from_slice(&20_u32.to_le_bytes()); // pFiles
        block.extend_from_slice(&[0; 8]); // pt
        block.extend_from_slice(&0_u32.to_le_bytes()); // fNC
        block.extend_from_slice(&u32::from(wide).to_le_bytes()); // fWide
        for path in paths {
            for unit in path.encode_utf16().chain(std::iter::once(0)) {
                block.extend_from_slice(&unit.to_le_bytes());
            }
        }
        block.extend_from_slice(&0_u16.to_le_bytes());
        block
    }

    #[test]
    fn reads_the_paths_explorer_puts_on_the_clipboard_accents_and_spaces_included() {
        let block = drop_block(&[r"C:\Users\João Çãõ Silva\Relatório final.pdf", r"D:\fotos\praia 01.png"], true);
        assert_eq!(paths_in_drop_block(&block), vec![PathBuf::from(r"C:\Users\João Çãõ Silva\Relatório final.pdf"), PathBuf::from(r"D:\fotos\praia 01.png")]);
        assert_eq!(paths_in_drop_block(&drop_block(&[r"C:\a.txt"], true)), vec![PathBuf::from(r"C:\a.txt")]);
        // The system may hand a block longer than the list: what follows the list's end is not read.
        let mut padded = drop_block(&[r"C:\a.txt"], true);
        padded.extend_from_slice(&[0x41, 0, 0x42, 0, 0, 0]);
        assert_eq!(paths_in_drop_block(&padded), vec![PathBuf::from(r"C:\a.txt")]);
    }

    #[test]
    fn answers_nothing_for_a_block_it_cannot_read_whole() {
        assert!(paths_in_drop_block(&[]).is_empty());
        assert!(paths_in_drop_block(&[0; 19]).is_empty());
        assert!(paths_in_drop_block(&drop_block(&[r"C:\a.txt"], false)).is_empty(), "a list that is not wide");
        let whole = drop_block(&[r"C:\a.txt", r"C:\b.txt"], true);
        assert!(paths_in_drop_block(&whole[..whole.len() - 6]).is_empty(), "a list cut before its end");
        let mut beyond = drop_block(&[r"C:\a.txt"], true);
        beyond[0..4].copy_from_slice(&9_999_u32.to_le_bytes());
        assert!(paths_in_drop_block(&beyond).is_empty(), "an offset past the block");
        let mut inside_header = drop_block(&[r"C:\a.txt"], true);
        inside_header[0..4].copy_from_slice(&4_u32.to_le_bytes());
        assert!(paths_in_drop_block(&inside_header).is_empty(), "an offset inside the header");
        let mut lone_surrogate = drop_block(&[], true);
        lone_surrogate.truncate(20);
        lone_surrogate.extend_from_slice(&[0x00, 0xD8, 0, 0, 0, 0]);
        assert!(paths_in_drop_block(&lone_surrogate).is_empty(), "text that is not UTF-16");
    }

    #[test]
    fn keeps_only_paths_the_paste_named_every_one_of_them_or_none() {
        // Forward slashes, so the names are found on every system these tests run on.
        let paths = vec![PathBuf::from("/docs/Relatório.PDF"), PathBuf::from("/docs/notas.txt")];
        let named = |names: &[&str]| paths_named(&paths, &names.iter().map(|name| name.to_string()).collect::<Vec<_>>());
        // In the order the paste named them, whatever the case of the names.
        assert_eq!(named(&["notas.txt", "relatório.pdf"]), vec![paths[1].clone(), paths[0].clone()]);
        assert!(named(&["notas.txt"]).is_empty(), "fewer names than files: the clipboard is not what was pasted");
        assert!(named(&["notas.txt", "outro.txt"]).is_empty(), "a name the clipboard does not hold");
        assert!(named(&["notas.txt", "notas.txt"]).is_empty(), "one file cannot answer for two names");
        assert!(named(&[]).is_empty());
        assert!(paths_named(&[], &["image.png".to_string()]).is_empty(), "a pasted image with no file");
    }

    #[test]
    fn two_files_of_the_same_name_in_different_folders_are_both_kept() {
        let paths = vec![PathBuf::from("/a/nota.txt"), PathBuf::from("/b/nota.txt")];
        assert_eq!(paths_named(&paths, &["nota.txt".to_string(), "nota.txt".to_string()]), paths);
    }
}
