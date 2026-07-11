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
        const w = info.weights ?? [];
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
      <div className="bg-white border border-[0.5px] border-border rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <span className="text-[15px] font-semibold text-navy">ทดสอบฟอนต์</span>
        </div>
        <div className="text-[13px] text-[#aaa] text-center py-8">
          ระบบทดสอบฟอนต์ขัดข้องชั่วคราว
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[0.5px] border-border rounded-xl p-5 mb-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <span className="text-[15px] font-semibold text-navy">ทดสอบฟอนต์</span>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Size slider — MyFonts style: เล็ก A ... ใหญ่ A */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#aaa]">A</span>
            <input
              type="range"
              min={16}
              max={120}
              step={1}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="accent-navy w-24 sm:w-32"
            />
            <span className="text-[18px] text-[#aaa] leading-none">A</span>
            <span className="text-[12px] text-[#aaa] w-[38px] text-right shrink-0">{size}px</span>
          </div>

          {weights.length > 0 && (
            <select
              value={weightId}
              onChange={(e) => setWeightId(e.target.value)}
              className="text-[13px] px-3 py-1.5 border border-[0.5px] border-[#ddd] rounded-[8px] bg-white text-navy outline-none cursor-pointer"
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
        className="w-full px-4 py-3 mb-3 border border-border rounded-xl bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]"
      />

      <div className="min-h-[140px] bg-bg rounded-lg border border-[0.5px] border-border px-4 py-3 overflow-x-auto flex items-center">
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
          <span className="text-[13px] text-[#bbb]">กำลังเตรียมตัวอย่าง...</span>
        )}
      </div>
      {error && <p className="text-[12px] text-[#c0392b] mt-1.5">{error}</p>}
    </div>
  );
}
