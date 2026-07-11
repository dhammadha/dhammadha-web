// แปลงข้อความเป็นรูป PNG: shape ด้วย fontkit (ใช้ GSUB/GPOS ของฟอนต์ —
// ตำแหน่งวรรณยุกต์/สระไทยถูกต้องเมื่อฟอนต์มี anchor ครบ) → glyph path เป็น SVG
// → rasterize ด้วย resvg (wasm)
//
// ถ้าฟอนต์ไหน mark ลอย (ฟอนต์เก่าที่ไม่มีตาราง OpenType): จุดที่ต้องสลับ engine
// เป็น harfbuzz คือ shapeRun() ที่เดียว — ส่วนวาด SVG/raster ใช้ต่อได้เลย

import * as fontkitMod from "https://esm.sh/fontkit@2.0.4?target=denonext";
import { Buffer } from "node:buffer";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2?target=denonext";

// esm.sh แปลง CJS ของ fontkit — บางทีได้ default บางทีได้ named exports ล้วน
// deno-lint-ignore no-explicit-any
const fontkit: any = (fontkitMod as any).default ?? fontkitMod;

const RESVG_WASM_URL = "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const SCALE_FACTOR = 2; // render 2x สำหรับจอ retina (ฝั่งเว็บแสดงที่ naturalWidth/2)
const MAX_RASTER_W = 4096; // เพดานความกว้างรูป (device px)
const INK = "#2B1B3D"; // token navy ใน tailwind.config.ts

// โหลด wasm ครั้งเดียวต่อ instance (memoize ไว้ตอนเรียก render ครั้งแรก)
let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(fetch(RESVG_WASM_URL)).catch((e) => {
      wasmReady = null; // ให้ลองใหม่ครั้งหน้าถ้าโหลดพลาด
      throw e;
    });
  }
  return wasmReady;
}

// deno-lint-ignore no-explicit-any
export type ShapedFont = any; // fontkit ไม่มี type ใน Deno

export function parseFont(bytes: Uint8Array): ShapedFont {
  const f = fontkit.create(Buffer.from(bytes));
  // เผื่อไฟล์เป็น collection (ttc) — ใช้ตัวแรก
  return "fonts" in f && Array.isArray((f as { fonts?: unknown[] }).fonts)
    ? (f as { fonts: ShapedFont[] }).fonts[0]
    : f;
}

type Positioned = {
  d: string; // SVG path data (หน่วย font unit, แกน y ขึ้น)
  x: number; // ตำแหน่งวาง (หน่วย font unit)
  y: number;
};

type ShapeResult = {
  glyphs: Positioned[];
  minX: number; maxX: number; minY: number; maxY: number; // ink bbox หน่วย font unit
};

function shapeRun(font: ShapedFont, text: string): ShapeResult {
  const run = font.layout(text);
  const glyphs: Positioned[] = [];
  let penX = 0;
  let minX = 0, maxX = 0;
  let minY = Math.min(0, font.descent ?? 0);
  let maxY = Math.max(0, font.ascent ?? 0);

  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i];
    const p = run.positions[i];
    const x = penX + (p.xOffset ?? 0);
    const y = p.yOffset ?? 0;

    let bb: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    try { bb = g.bbox; } catch { bb = null; }
    if (bb && isFinite(bb.minX) && bb.maxX > bb.minX) {
      minX = Math.min(minX, x + bb.minX);
      maxX = Math.max(maxX, x + bb.maxX);
      minY = Math.min(minY, y + bb.minY);
      maxY = Math.max(maxY, y + bb.maxY);
    }

    let d = "";
    try { d = g.path.toSVG(); } catch { d = ""; }
    if (d) glyphs.push({ d, x, y });

    penX += p.xAdvance ?? 0;
  }
  maxX = Math.max(maxX, penX);
  return { glyphs, minX, maxX, minY, maxY };
}

export async function renderPng(font: ShapedFont, text: string, sizePx: number): Promise<Uint8Array> {
  await ensureWasm();

  const upm: number = font.unitsPerEm || 1000;
  const shaped = shapeRun(font, text);
  let scale = (sizePx * SCALE_FACTOR) / upm;

  const pad = upm * 0.06; // ระยะหายใจกันขอบตัดสระบน/หางล่าง
  let w = Math.ceil((shaped.maxX - shaped.minX + pad * 2) * scale);
  if (w > MAX_RASTER_W) {
    scale *= MAX_RASTER_W / w;
    w = MAX_RASTER_W;
  }
  w = Math.max(w, 1);
  const h = Math.max(Math.ceil((shaped.maxY - shaped.minY + pad * 2) * scale), 1);
  const baselineY = (shaped.maxY + pad) * scale; // SVG แกน y ลง — วัดจากขอบบน

  // glyph path อยู่ในหน่วย font unit แกน y ขึ้น → translate ไปตำแหน่ง แล้ว scale(s, -s) พลิกแกน
  const paths = shaped.glyphs.map((g) => {
    const tx = (g.x - shaped.minX + pad) * scale;
    const ty = baselineY - g.y * scale;
    return `<path d="${g.d}" transform="translate(${tx} ${ty}) scale(${scale} ${-scale})"/>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g fill="${INK}">${paths}</g></svg>`;
  return new Resvg(svg).render().asPng();
}
