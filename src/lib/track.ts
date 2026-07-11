// Phase 4.3 — client-side analytics tracking (font_events)
//
// สถิติล้วน ๆ ห้ามทำ UX พัง: ทุกฟังก์ชัน fire-and-forget, catch เงียบ, ไม่ throw
// และไม่ block การ render ใด ๆ ทั้งสิ้น (ดู supabase/migrations/0038_font_events.sql)

import { supabase } from "@/lib/supabase";

const SESSION_KEY_STORAGE = "dh_session_key";

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// session_key แบบสุ่ม ผูกอยู่กับเบราว์เซอร์ (localStorage) ใช้เป็น dedupe key ฝั่ง client
function getSessionKey(): string {
  try {
    let key = localStorage.getItem(SESSION_KEY_STORAGE);
    if (!key) {
      key = genId();
      localStorage.setItem(SESSION_KEY_STORAGE, key);
    }
    return key;
  } catch {
    // localStorage ปิดอยู่ (private mode / เบราว์เซอร์บล็อก) — ใช้ key ชั่วคราวไม่ persist
    return genId();
  }
}

function todayKey(): string {
  // ใช้วันที่ local (ไม่ใช่ toISOString ที่เป็น UTC) ให้ขอบเขต "1 ครั้ง/วัน"
  // ตัดตอนเที่ยงคืนเวลาไทย ตรงกับการจัดกลุ่มรายเดือนฝั่งหน้า analytics
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * นับ 1 ครั้ง/ฟอนต์/วัน ต่อเบราว์เซอร์ — dedupe ด้วย localStorage key
 * "fv:<fontId>:<YYYY-MM-DD>" กันนับซ้ำตอน user เปิดหน้าเดิมซ้ำ ๆ ในวันเดียวกัน
 * fire-and-forget: ไม่ throw, ไม่ await โดยผู้เรียก
 */
export function trackFontView(fontId: string): void {
  if (typeof window === "undefined") return;

  try {
    const dedupeKey = `fv:${fontId}:${todayKey()}`;
    if (localStorage.getItem(dedupeKey)) return;
    localStorage.setItem(dedupeKey, "1");
  } catch {
    // localStorage ใช้ไม่ได้ — ยอมให้นับซ้ำได้ (สถิติ ไม่ใช่ตัวเงิน) แล้วทำต่อ
  }

  const session_key = getSessionKey();

  void (async () => {
    try {
      const user_id = await getCurrentUserId();
      await supabase.from("font_events").insert({
        font_id: fontId,
        kind: "view",
        user_id,
        session_key,
      });
    } catch {
      // เงียบ — ห้ามพัง UX
    }
  })();
}

/**
 * log ทุกครั้งที่กดปุ่มโหลดฟรี (ไม่ dedupe — ยอดโหลดจริง)
 * ปุ่มนี้เห็นเฉพาะคน login อยู่แล้ว จึงใส่ user_id จาก session ปัจจุบันเสมอ
 * fire-and-forget: ไม่ throw, ไม่ await โดยผู้เรียก
 */
export function trackFreeDownload(fontId: string): void {
  if (typeof window === "undefined") return;

  const session_key = getSessionKey();

  void (async () => {
    try {
      const user_id = await getCurrentUserId();
      await supabase.from("font_events").insert({
        font_id: fontId,
        kind: "free_download",
        user_id,
        session_key,
      });
    } catch {
      // เงียบ — ห้ามพัง UX
    }
  })();
}
