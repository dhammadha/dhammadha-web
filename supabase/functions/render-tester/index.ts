// Supabase Edge Function: render-tester — type tester แบบรูป (ไฟล์ฟอนต์จริงไม่ออกจาก server)
//
// POST { action: "info",   font_id }                       → { name, weights: [{id,label,css}] }
// POST { action: "render", font_id, weight, text?, size? } → image/png (2x retina)
//
// - ไม่ต้องล็อกอิน (deploy แบบ verify_jwt ปิด — ผู้เยี่ยมชมทั่วไปใช้ tester ได้)
// - อ่านไฟล์จริงจาก private bucket fonts-full (ผ่าน font_files_private) ด้วย service role
//   ฟอนต์ฟรีที่ไม่มี row ใช้ free_font_files (public URL) แทน
// - รูปที่ render แล้ว upload เข้า bucket public "tester-cache" — ฝั่งเว็บลอง CDN URL
//   ก่อนเรียก function (cache key ต้องตรงกับ TypeTester.tsx แบบ byte-to-byte)
//
// Deploy: supabase functions deploy render-tester --no-verify-jwt (หรือ MCP deploy_edge_function)

import { createClient } from "npm:@supabase/supabase-js@2";
import { parseWeightId, weightLabel, weightCss } from "./weights.ts";
import { parseFont, renderPng, type ShapedFont } from "./render.ts";

const DEFAULT_TEXT = "พิมพ์ทดสอบตรงนี้";
const MAX_TEXT = 80;
const MIN_SIZE = 12;
const MAX_SIZE = 120;
const CACHE_BUCKET = "tester-cache";
const CACHE_VERSION = "v1"; // ขยับเมื่อเปลี่ยน logic การ render เพื่อล้าง cache ทั้งหมด
const RATE_LIMIT_PER_MIN = 120; // ต่อ IP ต่อ instance — กันยิงถล่มแบบหลวม ๆ

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── cache ระดับ instance (อยู่ข้าม request ตอน warm) ──
const fontCache = new Map<string, ShapedFont>(); // key: fontId|weight
const FONT_CACHE_MAX = 8; // ฟอนต์ละหลาย MB — จำกัดกัน memory

const rateMap = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = rateMap.get(ip);
  if (!cur || now - cur.t > 60_000) {
    rateMap.set(ip, { n: 1, t: now });
    return false;
  }
  cur.n++;
  return cur.n > RATE_LIMIT_PER_MIN;
}

// normalize ข้อความ — ต้องตรงกับ normalizeTesterText ใน TypeTester.tsx ทุกตัวอักษร
function normalizeTesterText(raw: unknown): string {
  let t = String(raw ?? "").normalize("NFC").replace(/[\x00-\x1f\x7f]/g, "").slice(0, MAX_TEXT);
  if (!t.trim()) t = DEFAULT_TEXT;
  return t;
}

async function sha256Hex40(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

type FontSource = { weight: string; kind: "storage" | "url"; ref: string };

// เรียงชอบ ttf/otf ก่อน (fontkit อ่านตรง ๆ) แล้วค่อย woff/woff2
function extPreference(ref: string): number {
  const ext = ref.toLowerCase().split("?")[0].split(".").pop() ?? "";
  return ext === "ttf" || ext === "otf" ? 0 : ext === "woff" ? 1 : ext === "woff2" ? 2 : 3;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { action?: string; font_id?: string; weight?: string; text?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const fontId = String(body.font_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(fontId)) return json({ error: "invalid_font_id" }, 400);
  if (body.action !== "info" && body.action !== "render") return json({ error: "unknown_action" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── ฟอนต์ต้องเผยแพร่อยู่จริง (endpoint สาธารณะ — ห้าม render ฟอนต์ที่ยังไม่ปล่อย) ──
  const [{ data: font }, { data: priv }] = await Promise.all([
    admin.from("fonts")
      .select("id, name, name_th, is_free, is_active, published_at, free_font_files")
      .eq("id", fontId).maybeSingle(),
    admin.from("font_files_private")
      .select("full_font_files").eq("font_id", fontId).maybeSingle(),
  ]);
  if (!font || !font.is_active || !font.published_at) return json({ error: "not_found" }, 404);

  // ── รายการไฟล์ต่อ weight: ไฟล์เต็ม (private) เป็นหลัก, ฟอนต์ฟรี fallback ไฟล์ public ──
  const notZip = (s: string) => !s.toLowerCase().split("?")[0].endsWith(".zip");
  let sources: FontSource[] = [];
  if (priv?.full_font_files?.length) {
    sources = (priv.full_font_files as string[]).filter(notZip)
      .map((p) => ({ weight: parseWeightId(p), kind: "storage" as const, ref: p }));
  } else if (font.is_free && font.free_font_files?.length) {
    sources = (font.free_font_files as string[]).filter(notZip)
      .map((u) => ({ weight: parseWeightId(u), kind: "url" as const, ref: u }));
  }
  const byWeight = new Map<string, FontSource>();
  for (const s of [...sources].sort((a, b) => extPreference(a.ref) - extPreference(b.ref))) {
    if (!byWeight.has(s.weight)) byWeight.set(s.weight, s);
  }
  if (!byWeight.size) return json({ error: "no_files" }, 404);

  if (body.action === "info") {
    const weights = [...byWeight.keys()]
      .map((id) => ({ id, label: weightLabel(id), css: weightCss(id) }))
      .sort((a, b) => a.css - b.css || a.label.localeCompare(b.label));
    return json({ name: font.name || font.name_th || "", weights });
  }

  // ── action: render ──
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return json({ error: "rate_limited" }, 429);

  const weightId = String(body.weight ?? "").toLowerCase();
  const src = byWeight.get(weightId);
  if (!src) return json({ error: "invalid_weight" }, 400);

  const text = normalizeTesterText(body.text);
  const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(Number(body.size) || 48)));

  // ── โหลด + parse ฟอนต์ (cache ต่อ instance) ──
  const cacheId = `${fontId}|${weightId}`;
  let fk = fontCache.get(cacheId);
  if (!fk) {
    let bytes: Uint8Array;
    try {
      if (src.kind === "storage") {
        const { data: blob, error } = await admin.storage.from("fonts-full").download(src.ref);
        if (error || !blob) return json({ error: "file_not_found" }, 404);
        bytes = new Uint8Array(await blob.arrayBuffer());
      } else {
        const res = await fetch(src.ref);
        if (!res.ok) return json({ error: "file_not_found" }, 404);
        bytes = new Uint8Array(await res.arrayBuffer());
      }
      fk = parseFont(bytes);
    } catch (e) {
      console.error("font_parse_failed", fontId, weightId, e instanceof Error ? e.message : e);
      return json({ error: "font_parse_failed" }, 500);
    }
    if (fontCache.size >= FONT_CACHE_MAX) {
      const oldest = fontCache.keys().next().value;
      if (oldest) fontCache.delete(oldest);
    }
    fontCache.set(cacheId, fk);
  }

  let png: Uint8Array;
  try {
    png = await renderPng(fk, text, size);
  } catch (e) {
    console.error("render_failed", fontId, weightId, e instanceof Error ? e.message : e);
    return json({ error: "render_failed" }, 500);
  }

  // ── อัด cache ให้คนถัดไป (พลาดได้ ไม่ถือเป็น error — ครั้งหน้า render ใหม่เอง) ──
  const key = `${CACHE_VERSION}/${fontId}/${weightId}/${size}/${await sha256Hex40(text)}.png`;
  const { error: upErr } = await admin.storage.from(CACHE_BUCKET)
    .upload(key, png, { contentType: "image/png", upsert: true, cacheControl: "31536000" });
  if (upErr) console.error("cache_upload_failed", key, upErr.message);

  return new Response(png, {
    headers: {
      ...CORS,
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Cache-Key": key,
    },
  });
});
