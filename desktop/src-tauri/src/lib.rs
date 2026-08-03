mod commands;
mod state;

// `pub` เพราะยังไม่มีใครในแอปเรียก (ผู้ใช้จริงคือ `api.rs`/`vault.rs` ที่จะมาใน S4/S5)
// ถ้าเป็น private จะโดน dead_code เตือนทั้งโมดูล
pub mod crypto;

use commands::AppHandleState;
use state::{Screen, ViewModel};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ต้องเป็น plugin ตัวแรก — ตัวที่สองต้องตายก่อนที่จะทันทำอะไรกับดิสก์
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .manage(AppHandleState(Mutex::new(ViewModel::initial())))
        .invoke_handler(tauri::generate_handler![commands::get_state])
        .setup(|app| {
            // S1: ยังไม่มี auth/vault — ตั้งเป็นหน้า Login ไว้พิสูจน์ว่า push state ขึ้น JS ได้จริง
            // S3 จะแทนที่ด้วยลำดับ launch ตัวจริง (sweep → refresh token → status → …)
            let handle = app.handle().clone();
            let vm = {
                let st = app.state::<AppHandleState>();
                let mut vm = st.0.lock().expect("state poisoned");
                vm.screen = Screen::Login;
                vm.clone()
            };
            handle.emit("state", vm)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
