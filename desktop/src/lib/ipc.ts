import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AppState } from "./types";

// **ไฟล์เดียวในโปรเจกต์ที่เรียก invoke() / listen() ได้**
//
// ทำไมถึงบังคับให้ผ่านที่นี่: พื้นผิวที่ JS แตะ Rust ได้ต้องนับได้ในหน้าเดียว
// ถ้ากระจาย invoke() ตาม component การตอบคำถาม "JS ทำอะไรได้บ้าง" จะต้อง grep ทั้งโปรเจกต์
// ซึ่งเป็นคำถามที่ต้องตอบได้ทุกครั้งที่ทบทวนความปลอดภัย

export function getState(): Promise<AppState> {
  return invoke<AppState>("get_state");
}

/** Rust push state ขึ้นมาเองทุกครั้งที่เปลี่ยน — ฝั่ง JS ไม่ poll และไม่มี timer ของตัวเอง */
export function onState(cb: (s: AppState) => void): Promise<() => void> {
  return listen<AppState>("state", (e) => cb(e.payload));
}
