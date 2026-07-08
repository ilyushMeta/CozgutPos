// Çözgüt POS desktop shell — thin Tauri wrapper around the built React client
// (apps/client/dist). See apps/client/src-tauri/README.md for build/scoping notes.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Çözgüt POS");
}
