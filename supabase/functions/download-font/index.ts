// Supabase Edge Function: download-font — ทางเดียวที่ลูกค้าได้ไฟล์ฟอนต์เต็ม
//
// POST { action: "list", font_id }                → รายชื่อไฟล์ที่มีสิทธิ์โหลด
// POST { action: "download", font_id, file_index } → ไฟล์ที่ stamp license แล้ว (binary)
//
// ทุก request ต้องมี Authorization: Bearer <supabase access token> (verify_jwt เปิด)
// ขั้นตอน: auth → ตรวจ entitlements → จำกัดจำนวนโหลด/วัน → อ่านไฟล์จาก private
// bucket ด้วย service role → stamp name table (nameID 3/13/14) → log → ส่งไฟล์
//
// Deploy: supabase functions deploy download-font (หรือ Supabase MCP deploy_edge_function)

import { createClient } from "npm:@supabase/supabase-js@2";
import { stampFont } from "./stamp.ts";

const MAX_DOWNLOADS_PER_DAY = 30; // ต่อ entitlement ต่อ 24 ชม.

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

// escape สำหรับ PostgREST .or() filter (คั่นด้วย comma) และกัน wildcard ของ ilike
function safeEmail(email: string): string {
  return email.replace(/[,()%_\\]/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { action?: string; font_id?: string; file_index?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const fontId = String(body.font_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(fontId)) return json({ error: "invalid_font_id" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── ตัวตนผู้เรียกจาก JWT ──
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthorized" }, 401);
  const email = (user.email ?? "").toLowerCase();

  // ── ตรวจสิทธิ์: entitlement ของ user นี้ (หรืออีเมลนี้) กับฟอนต์นี้ + order ต้อง paid ──
  const { data: ents, error: entErr } = await admin
    .from("entitlements")
    .select("id, license_type, orders!inner(order_no, status, paid_at, customer_name, customer_email)")
    .eq("font_id", fontId)
    .is("revoked_at", null)
    .or(`user_id.eq.${user.id},email.ilike.${safeEmail(email)}`)
    .limit(1);
  if (entErr) return json({ error: "entitlement_lookup_failed" }, 500);
  const ent = ents?.[0] as
    | {
        id: string;
        license_type: string;
        orders: { order_no: string; status: string; paid_at: string | null; customer_name: string | null; customer_email: string };
      }
    | undefined;
  if (!ent || ent.orders.status !== "paid") return json({ error: "no_entitlement" }, 403);

  // ── ไฟล์ของฟอนต์นี้ ──
  const [{ data: files }, { data: font }] = await Promise.all([
    admin.from("font_files_private").select("full_font_files").eq("font_id", fontId).maybeSingle(),
    admin.from("fonts").select("name, name_th, slug").eq("id", fontId).maybeSingle(),
  ]);
  const paths: string[] = files?.full_font_files ?? [];
  if (!paths.length) return json({ error: "no_files" }, 404);

  if (body.action === "list") {
    return json({
      font: { name: font?.name ?? font?.name_th ?? "", slug: font?.slug ?? "" },
      license_type: ent.license_type,
      order_no: ent.orders.order_no,
      files: paths.map((p, i) => ({ index: i, name: p.split("/").pop() ?? p })),
    });
  }

  if (body.action !== "download") return json({ error: "unknown_action" }, 400);
  const idx = Number(body.file_index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= paths.length) {
    return json({ error: "invalid_file_index" }, 400);
  }

  // ── จำกัดจำนวนดาวน์โหลดต่อวัน ──
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("download_logs")
    .select("id", { count: "exact", head: true })
    .eq("entitlement_id", ent.id)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_DOWNLOADS_PER_DAY) return json({ error: "download_limit_reached" }, 429);

  // ── อ่านไฟล์จาก private bucket ──
  const path = paths[idx];
  const { data: blob, error: dlErr } = await admin.storage.from("fonts-full").download(path);
  if (dlErr || !blob) return json({ error: "file_not_found" }, 404);
  let bytes = new Uint8Array(await blob.arrayBuffer());

  // ── stamp name table (เฉพาะ ttf/otf — woff/อื่น ๆ ส่งตามต้นฉบับ) ──
  const filename = path.split("/").pop() ?? "font.ttf";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  let stamped = false;
  if (ext === "ttf" || ext === "otf") {
    try {
      const orderNo = ent.orders.order_no;
      const buyer = ent.orders.customer_name || ent.orders.customer_email;
      const date = (ent.orders.paid_at ?? new Date().toISOString()).slice(0, 10);
      bytes = stampFont(bytes, {
        uniqueId: `${orderNo} — dhammadha.com`,
        license: `Licensed to ${buyer} — Order ${orderNo} — ${date} — via dhammadha.com`,
        licenseUrl: `https://dhammadha.com/verify?order=${encodeURIComponent(orderNo)}`,
      });
      stamped = true;
    } catch (e) {
      // ไฟล์ผิดรูปแบบ/parse ไม่ได้ — ส่งต้นฉบับดีกว่าส่งไฟล์เสีย แต่บันทึกไว้
      console.error("stamp_failed", path, e instanceof Error ? e.message : e);
    }
  }

  // ── log ──
  await admin.from("download_logs").insert({
    entitlement_id: ent.id,
    user_id: user.id,
    font_id: fontId,
    file_path: path,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return new Response(bytes, {
    headers: {
      ...CORS,
      "Content-Type": ext === "otf" ? "font/otf" : "font/ttf",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\-]/g, "_")}"`,
      "X-Stamped": stamped ? "1" : "0",
    },
  });
});
