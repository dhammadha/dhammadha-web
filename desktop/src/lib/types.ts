// mirror ของ struct ฝั่ง Rust (`src-tauri/src/state.rs`)
//
// ⚠️ ทุกอย่างในไฟล์นี้คือ **view model** — สิ่งที่ปลอดภัยจะให้ JS เห็น
// ห้ามเพิ่มฟิลด์ที่เป็น token / device_key / path ของไฟล์ฟอนต์ที่ถอดรหัสแล้ว
// (เหตุผลเต็มอยู่ในหัวไฟล์ `src-tauri/src/commands.rs`)

/** สถานะรวมของแอปที่ Rust push ขึ้นมาผ่าน event "state" */
export type AppState = {
  /** หน้าจอที่ควรแสดง — Rust เป็นคนตัดสิน ไม่ใช่ router ฝั่ง JS */
  screen: "loading" | "login" | "library" | "no_subscription" | "expired";
  version: string;
  email: string | null;
};
