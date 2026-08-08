import { useEffect, useState } from "react";
import { getState, onState } from "./lib/ipc";
import type { AppState } from "./lib/types";
// สำเนาจาก /public/brand ของเว็บ — ไฟล์ถูก crop viewBox ชิดตัวอักษรแล้ว (อัตราส่วน 4.195:1)
// **ตัวสว่าง** เพราะแถบหัวแอปเป็นพื้นดำ · ต้นฉบับที่ Illustrator export มาเว้นขอบเปล่าไว้มาก
// ห้ามเอาไฟล์ใน docs/ มาใช้ตรง ๆ จะได้ตัวอักษรเตี้ยกว่าที่สั่งราวครึ่งหนึ่ง
import wordmark from "./brand/typedee-wordmark-light.svg";

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
        {/* wordmark เป็นภาพเหมือนฝั่งเว็บ ไม่ใช่ตัวหนังสือ — ตัวอักษรอยู่ในเส้น path ล้วน
            จึงไม่ต้องพึ่งไฟล์ฟอนต์ และได้รูปเดียวกับ Nav บนเว็บเป๊ะ
            20 สูง × 84 กว้าง = 4.195:1 ตาม viewBox หลัง crop (แถบสูง 56 · เว็บใช้ 24 บนแถบ 70)
            ⚠️ CSP ของแอปเป็น `default-src 'self'` แต่ `img-src 'self' data:` เปิดไว้แล้ว
               → ปลอดภัยทั้งกรณี Vite inline เป็น data: URI (ไฟล์ 1.9KB < ขีด 4KB) และกรณีแยกไฟล์ */}
        <img src={wordmark} alt={"typedee"} width={84} height={20} />
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="bg-surface px-8 py-6 text-center">
          {/* h2 = Plex Bold ตามเว็บ (รีแบรนด์เฟส 2 รอบ 2) — typedee สงวนไว้ให้หัวข้อใหญ่เท่านั้น */}
          <p className="font-ui text-h2 text-black">
            {failed ? "เชื่อมต่อกับตัวแอปไม่ได้" : state ? `หน้าจอ: ${state.screen}` : "กำลังเชื่อมต่อ…"}
          </p>
          <p className="mt-2 text-body-sm text-grey-600">
            {failed
              ? "หน้านี้ถูกเปิดนอกแอป typedee"
              : state
                ? `เวอร์ชัน ${state.version}`
                : "รอ Rust ตอบกลับ"}
          </p>
        </div>
      </main>
    </div>
  );
}
