"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Font } from "@/components/FontCard";

interface Weight {
  id: string;
  label: string;
  css: number;
}

const DEFAULT_TESTER_TEXT = "พิมพ์ทดสอบตรงนี้";

// ต้อง byte-match กับฝั่ง server (Edge Function render-tester) เป๊ะๆ
// ไม่งั้น hash ที่คำนวณจะไม่ตรงกับไฟล์ที่ cache ไว้ใน bucket tester-cache
function normalizeTesterText(raw: string): string {
  let t = String(raw ?? "").normalize("NFC").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 80);
  if (!t.trim()) t = DEFAULT_TESTER_TEXT;
  return t;
}

async function sha256Hex40(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

// เรียงน้ำหนักจากบางไปหนา (100→900) น้ำหนักเท่ากัน → upright ก่อน italic
// เช่น ชวนชิม: Light / Light Italic / Regular / Italic / Bold / Bold Italic
//
// ⚠️ ไม่พึ่ง `css` จาก Edge Function — มันคำนวณจาก id ทั้งก้อน ("lightitalic"/"bolditalic"
// ไม่มีในตาราง จึงตกเป็น 400 หมด ทำให้ italic ทุกตัวกองรวมที่ 400) เราถอด id เอง:
// ตัด italic/oblique ออก เหลือ base weight → เทียบกับตาราง
const WEIGHT_CSS: Record<string, number> = {
  thin: 100, extralight: 200, ultralight: 200, light: 300,
  regular: 400, normal: 400, medium: 500, semibold: 600,
  demibold: 600, bold: 700, extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900,
};

function weightRank(w: Weight): { css: number; italic: number } {
  const id = w.id.toLowerCase();
  const italic = /italic|oblique/.test(id) ? 1 : 0;
  const base = id.replace(/italic|oblique/g, "") || "regular";
  return { css: WEIGHT_CSS[base] ?? w.css ?? 400, italic };
}

function sortWeights(weights: Weight[]): Weight[] {
  return weights.slice().sort((a, b) => {
    const ra = weightRank(a), rb = weightRank(b);
    return ra.css - rb.css || ra.italic - rb.italic;
  });
}

function probeImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export default function TypeTester({ font }: { font: Font }) {
  const [weights, setWeights] = useState<Weight[]>([]);
  const [fontName, setFontName] = useState(font.name ?? "");
  const [weightId, setWeightId] = useState("");
  const [size, setSize] = useState(48);
  const [text, setText] = useState("");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgWidth, setImgWidth] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [infoError, setInfoError] = useState(false);

  const seqRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // โหลดข้อมูลฟอนต์ (ชื่อ + น้ำหนักที่ render ได้) จาก Edge Function
  // ครั้งเดียวตอน mount / เมื่อเปลี่ยนฟอนต์
  useEffect(() => {
    let cancelled = false;
    setInfoError(false);
    setWeights([]);
    setWeightId("");
    setImgSrc(null);
    setError("");

    async function loadInfo() {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("render-tester", {
          body: { action: "info", font_id: font.id },
        });
        if (cancelled) return;
        if (invokeError || !data || typeof data !== "object" || data instanceof Blob) {
          setInfoError(true);
          return;
        }
        const info = data as { name?: string; weights?: Weight[] };
        const w = sortWeights(info.weights ?? []);
        setWeights(w);
        setFontName(info.name || font.name || "");
        setWeightId(w[0]?.id ?? "");
      } catch {
        if (!cancelled) setInfoError(true);
      }
    }
    loadInfo();
    return () => { cancelled = true; };
  }, [font.id, font.name]);

  // Debounce ~400ms แล้วค่อย render — กันยิง request ถี่เกินไปตอนพิมพ์/ลากสไลเดอร์
  useEffect(() => {
    if (infoError || !weightId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runRender();
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, size, weightId, infoError, font.id]);

  // Revoke object URL ที่ค้างอยู่ตอน unmount เท่านั้น (ระหว่าง render
  // แต่ละครั้งภาพเก่ายังต้องค้างอยู่จนกว่าภาพใหม่จะมาแทน)
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function runRender() {
    const seq = ++seqRef.current;
    setRendering(true);
    try {
      const normalized = normalizeTesterText(text);
      const hash = await sha256Hex40(normalized);
      const key = `v1/${font.id}/${weightId}/${size}/${hash}.png`;
      const url = supabase.storage.from("tester-cache").getPublicUrl(key).data.publicUrl;

      const cached = await probeImage(url);
      if (seq !== seqRef.current) return;

      if (cached) {
        setImgSrc(url);
        setError("");
        return;
      }

      // เรียกผ่าน fetch ตรง — functions.invoke แปลงเป็น Blob เฉพาะ
      // application/octet-stream แต่ response ของเราเป็น image/png
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/render-tester`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "render", font_id: font.id, weight: weightId, text: normalized, size }),
        }
      );
      if (seq !== seqRef.current) return;

      if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
        setError("แสดงตัวอย่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      const blob = await res.blob();
      if (seq !== seqRef.current) return;

      const objectUrl = URL.createObjectURL(blob);
      if (seq !== seqRef.current) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = objectUrl;
      setImgSrc(objectUrl);
      setError("");
    } catch {
      if (seq === seqRef.current) {
        setError("แสดงตัวอย่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      if (seq === seqRef.current) setRendering(false);
    }
  }

  if (infoError) {
    return (
      <div>
        <h3 className="font-heading text-h2 text-black mb-3">ทดสอบฟอนต์</h3>
        <div className="bg-surface font-body text-body text-grey-600 text-center py-10">
          ระบบทดสอบฟอนต์ขัดข้องชั่วคราว
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="font-heading text-h2 text-black">ทดสอบฟอนต์</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Size slider — MyFonts style: เล็ก A ... ใหญ่ A */}
          <div className="flex items-center gap-2">
            <span className="font-heading text-body-sm text-grey-600 leading-none">A</span>
            <input
              type="range"
              min={16}
              max={120}
              step={1}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              aria-label="ขนาดตัวอักษร"
              className="accent-mint w-24 sm:w-32 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            />
            <span className="font-heading text-h2 text-grey-600 leading-none">A</span>
            <span className="font-body text-body-sm text-grey-600 w-12 text-right shrink-0">{size}px</span>
          </div>

          {weights.length > 0 && (
            <select
              value={weightId}
              onChange={(e) => setWeightId(e.target.value)}
              aria-label="น้ำหนักฟอนต์"
              className="font-body text-body-sm px-3 py-2 bg-surface text-black border-none outline-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              {weights.map((w) => (
                <option key={w.id} value={w.id}>
                  {fontName} {w.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={DEFAULT_TESTER_TEXT}
        maxLength={80}
        aria-label="ข้อความทดสอบ"
        className="w-full px-4 py-3 mb-px bg-surface font-body text-body-sm text-black border-none outline-none placeholder:text-grey-400 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black"
      />

      <div className="min-h-[140px] bg-surface px-4 py-3 overflow-x-auto flex items-center">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt="ตัวอย่างฟอนต์"
            draggable={false}
            onLoad={(e) => setImgWidth(e.currentTarget.naturalWidth / 2)}
            className={`select-none transition-opacity ${rendering ? "opacity-60" : "opacity-100"}`}
            style={{ width: imgWidth || undefined }}
          />
        ) : (
          <span className="font-body text-body text-grey-400">กำลังเตรียมตัวอย่าง...</span>
        )}
      </div>
      {error && <p className="font-body text-body-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
