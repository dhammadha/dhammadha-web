"use client";

import { useEffect, useState } from "react";
import FontCard, { Font } from "@/components/FontCard";
import AdBanner from "@/components/AdBanner";

/**
 * FontGrid — กริดฟอนต์ + ad คั่นเป็นระยะ (docs/design/DESIGN.md §14)
 *
 * ใช้ซ้ำที่ /fonts และหน้า designer storefront เพื่อให้กริดกับจังหวะ ad ตรงกันทั้งสองที่
 *
 * **กฎที่เจ้าของสั่ง (2026-07-18) นับเป็น "แถว" ไม่ใช่ "จำนวนใบ"**
 *   เดสก์ท็อป ทุก 3 แถว · มือถือ ทุก 4 แถว
 *
 * กริดเป็น grid-cols-2 sm:3 md:4 → จำนวนใบต่อก้อนจึงต่างกันตามจอ:
 *   < 640   2 คอลัมน์ × 4 แถว = 8
 *   640+    3 คอลัมน์ × 4 แถว = 12
 *   768+    4 คอลัมน์ × 3 แถว = 12
 * → เหลือแค่ 2 ค่า (8 กับ 12) เส้นแบ่งเดียวคือ 640px = breakpoint `sm`
 */

const CHUNK_NARROW = 8; // < 640px : 2 คอลัมน์ × 4 แถว
const CHUNK_WIDE = 12; // ≥ 640px : 3×4 หรือ 4×3

const GRID = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3";

// AdBanner มี max-w-site mx-auto ของตัวเองอยู่ข้างใน → ออกแบบมาให้ทะลุขอบ Container
// -mx-* จึงต้องล้อกับ padding ของ Container (px-4 md:px-6 lg:px-8 · §5.3)
const AD_CLASS = "my-4 -mx-4 md:-mx-6 lg:-mx-8";

function chunkBy<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function FontGrid({ fonts }: { fonts: Font[] }) {
  // ค่าเริ่มต้น = จอกว้าง เพราะ output:"export" ต้อง render HTML ออกมาก่อนรู้ขนาดจอ
  // แล้วแก้ให้ถูกตอน mount (มือถือได้ค่าถูกก่อน ad จะโหลดเสร็จ)
  //
  // ตั้งใจ "ไม่" render ad ทั้งสองชุดแล้วซ่อนด้วย hidden/sm:block —
  // AdSense ไม่เติมโฆษณาลงกล่องที่ display:none ตอน push จะได้ช่องว่างเปล่าแทน ad
  const [chunk, setChunk] = useState(CHUNK_WIDE);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setChunk(mq.matches ? CHUNK_WIDE : CHUNK_NARROW);
    update();
    // ฟังทั้ง matchMedia change และ window resize — `change` ไม่ยิงในบางสภาพแวดล้อม
    // (เช่น viewport emulation ของ devtools ที่ set metrics ตรง ๆ ไม่ได้ resize จริง)
    // แพตเทิร์นเดียวกับ CoverCarousel ที่ฟังทั้ง ResizeObserver + resize
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const chunks = chunkBy(fonts, chunk);

  return (
    <>
      {chunks.map((group, i) => (
        <div key={i}>
          <div className={GRID}>
            {group.map((f) => (
              <FontCard key={f.id} font={f} />
            ))}
          </div>
          {/* ไม่แทรก ad ท้ายก้อนสุดท้าย — ad ต้อง "คั่น" ไม่ใช่ปิดท้ายกริด */}
          {i < chunks.length - 1 && <AdBanner slot="1401819374" className={AD_CLASS} />}
        </div>
      ))}
    </>
  );
}
