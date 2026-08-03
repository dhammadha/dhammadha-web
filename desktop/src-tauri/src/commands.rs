use crate::state::ViewModel;
use std::sync::Mutex;
use tauri::State;

// ─────────────────────────────────────────────────────────────────────────
// พื้นผิวทั้งหมดที่ฝั่ง JS แตะ Rust ได้ — ถ้าไม่มีในไฟล์นี้ JS ทำไม่ได้
//
// 🔴 สิ่งที่ห้ามข้ามเส้นนี้ขึ้นไปหา JS เด็ดขาด (ทุกข้อคือ "หลุดแล้วโมเดลพัง"):
//   - `device_key`            หลุด = เซ็นคำขอเองได้ ทำลายชั้นที่ C1b สร้างมาทั้งหมด
//   - refresh / access token  คือแผลเดิมที่ C1b ปิดไป (token ใน localStorage → ยิง endpoint ตรง)
//   - bytes ของไฟล์ฟอนต์      อยู่ใน JS heap = ดูดผ่าน devtools ได้
//   - path ของไฟล์ที่ถอดรหัสแล้ว  โชว์ path = ก๊อปได้ด้วยคำสั่งเดียว → แสดงแค่จำนวนไฟล์
//   - queue / timers / เวลา `at`  เป็นแหล่งที่มาของเงิน ต้องอยู่ที่เดียวกับที่มี durability
//
// webview ของ Tauri เปิด devtools ได้เหมือนเบราว์เซอร์ — อะไรที่ขึ้นมาถึง JS
// ถือว่าผู้ใช้อ่านได้ทั้งหมด ไม่มีข้อยกเว้น
// ─────────────────────────────────────────────────────────────────────────

pub struct AppHandleState(pub Mutex<ViewModel>);

#[tauri::command]
pub fn get_state(state: State<'_, AppHandleState>) -> ViewModel {
    state.0.lock().expect("state poisoned").clone()
}
