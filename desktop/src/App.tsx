import { useEffect, useState } from "react";
import { getState, onState } from "./lib/ipc";
import type { AppState } from "./lib/types";

// S1 = เปลือกเปล่า พิสูจน์ว่า หน้าต่าง + token + ฟอนต์ + สาย IPC ไป Rust ครบวง
// หน้าจริง (Login / Library / Settings) เข้ามาที่ `src/routes/` ตอน S8

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    // ต้องมี catch เสมอ — ถ้า IPC ล้มแล้วปล่อย promise เงียบ ผู้ใช้จะค้างที่ "กำลังเชื่อมต่อ…"
    // ตลอดไปโดยไม่มีอะไรบอกว่าเกิดอะไรขึ้น (เปิดในเบราว์เซอร์ธรรมดาก็เข้ากรณีนี้)
    getState().then(setState).catch(() => setFailed(true));
    onState(setState).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center bg-black px-5">
        {/* ⚠️ จุดเดียวในโปรเจกต์ที่ `font-heading` (typedee) ไปคู่กับ step ที่ไม่ใช่หัวข้อใหญ่
            — ตรงนี้เป็น "wordmark" ไม่ใช่ข้อความ UI ฝั่งเว็บใช้ไฟล์ SVG ของ wordmark
            (public/brand/typedee-wordmark-*.svg) แต่แอปยังเป็นเปลือก S1 จึงวางเป็นตัวหนังสือไปก่อน
            → desktop จึงต้อง bundle typedee **Bold 700** ไว้ด้วย ต่างจากเว็บที่ส่งแค่ Black
            เมื่อถึง S8 ที่วาง UI จริง ให้เปลี่ยนเป็น <img> ของ wordmark แล้วถอด Bold ออกได้ */}
        <span className="font-heading text-ui leading-none text-page">TYPEDEE</span>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="bg-surface px-8 py-6 text-center">
          {/* h2 = Plex Bold ตามเว็บ (รีแบรนด์เฟส 2 รอบ 2) — typedee สงวนไว้ให้หัวข้อใหญ่เท่านั้น */}
          <p className="font-ui text-h2 text-black">
            {failed ? "เชื่อมต่อกับตัวแอปไม่ได้" : state ? `หน้าจอ: ${state.screen}` : "กำลังเชื่อมต่อ…"}
          </p>
          <p className="mt-2 text-body-sm text-grey-600">
            {failed
              ? "หน้านี้ถูกเปิดนอกแอป Typedee"
              : state
                ? `เวอร์ชัน ${state.version}`
                : "รอ Rust ตอบกลับ"}
          </p>
        </div>
      </main>
    </div>
  );
}
