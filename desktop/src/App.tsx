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
        <span className="font-heading text-ui leading-none text-white">TYPEDEE</span>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="bg-surface px-8 py-6 text-center">
          <p className="font-heading text-h2 text-black">
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
