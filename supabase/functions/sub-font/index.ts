// Supabase Edge Function: sub-font — ท่อส่งไฟล์ฟอนต์เข้า vault ของ desktop app
//
// POST { action: "status" }                        → สิทธิ์ปัจจุบันของผู้เรียก
// POST { action: "list" }                          → ฟอนต์ที่ opt-in + ไฟล์ + favourites (round-trip เดียว)
// POST { action: "download", font_id, file_index } → bytes ที่ stamp แล้ว ส่งเข้า vault
// POST { action: "heartbeat", font_ids: [...] }    → บันทึก font-days ของวันนี้
//
// **โมเดล: สมาชิกไม่ได้ "ไฟล์ฟอนต์" — ได้สิทธิ์ให้เครื่องเรียกใช้ระหว่างเป็นสมาชิกเท่านั้น**
// แอปรับ bytes จาก action `download` แล้วเก็บเข้า vault ที่เข้ารหัสไว้ ถอดรหัสเฉพาะตอน
// activate เพื่อลงทะเบียนกับระบบฟอนต์ของ OS และลบทิ้งตอน deactivate/ปิดแอป/หมดอายุ
// ปลายทางจึงไม่ใช่ไฟล์ที่สมาชิกถือครอง — เงื่อนไขที่ผูกพันสมาชิกอยู่ใน `/agreement`
// หัวข้อ "การใช้งานผ่านสมาชิก (Subscription)" (ห้ามสกัดไฟล์ออกจากแอป / ห้ามหลบเลี่ยง
// มาตรการทางเทคนิค / สิทธิ์สิ้นสุดพร้อมความเป็นสมาชิก) — อ้างชื่อหัวข้อไม่ใช่เลขข้อ เลขเลื่อนได้
// ⚠️ endpoint นี้คืน bytes ดิบให้ผู้ถือ JWT ที่มี subscription active — vault กันการคัดลอก
// โดยผู้ใช้ทั่วไป ไม่ได้กันคนที่ยิง API ตรง (ข้อจำกัดเดียวกับบริการลักษณะนี้ทั่วไป)
// แนวป้องกันที่แท้จริงของกรณีนั้นคือสัญญา + stamp ที่ระบุตัวสมาชิกไว้ในไฟล์
//
// ทุก request ต้องมี Authorization: Bearer <supabase access token> (verify_jwt เปิด)
// เกณฑ์สิทธิ์ต่างจาก download-font: อันนั้นดู entitlements ของการซื้อรายฟอนต์
// อันนี้ดู subscription ที่ active — "active" คำนวณสดเสมอ ไม่มี cron คอย flip status
//
// Deploy: supabase functions deploy sub-font (หรือ Supabase MCP deploy_edge_function)

import { createClient } from "npm:@supabase/supabase-js@2";
import { stampFont } from "../_shared/stamp.ts";

const MAX_DOWNLOADS_PER_DAY = 300; // ต่อ user ต่อ 24 ชม. (แอปโหลดทีละหลายน้ำหนัก)
const MAX_HEARTBEAT_IDS = 500;

// ⚠️ สำเนาของ `src/lib/brand.ts` — Deno รันคนละ runtime และ deploy แยกจากเว็บ
// จึง import ข้ามมาไม่ได้ **เปลี่ยนชื่อ/โดเมนแบรนด์ต้องแก้ทั้งสองที่ แล้ว redeploy
// function นี้ด้วย** (`supabase functions deploy sub-font`) ไม่งั้นไฟล์ฟอนต์ที่ส่งให้
// สมาชิกจะยังถูกประทับโดเมนเก่าไว้ในตัวไฟล์ ซึ่งแก้ย้อนหลังไม่ได้
// **`download-font` มีสำเนาชุดของตัวเองอีกชุด — ต้อง redeploy ทั้งคู่**
const BRAND_DOMAIN = "dhammadha.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // ต้องประกาศ expose ไม่งั้น JS ใน webview อ่าน header ชุด X-* ไม่เห็นเลย (CORS ซ่อนให้)
  // — แอปต้องอ่าน `X-Font-File` เพื่อตั้งชื่อไฟล์ใน vault
  "Access-Control-Expose-Headers": "X-Font-Type, X-Font-File, X-Stamped",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

// วันตามเวลาไทย — stream_days.day ต้องเป็นวันของ Asia/Bangkok ไม่ใช่ UTC
// ไม่งั้น font-day คลาดกัน 7 ชม. (ช่วง 00:00–07:00 น. ไทยจะถูกนับเป็นเมื่อวาน)
function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { action?: string; font_id?: string; file_index?: number; font_ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── ตัวตนผู้เรียกจาก JWT ──
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  // ── role + subscription ที่ active ──
  // get_my_role() ใช้ไม่ได้ตรงนี้ (security definer อ่าน auth.uid() ซึ่ง service role เป็น null)
  const [{ data: profile }, { data: subs }] = await Promise.all([
    admin.from("users").select("role, name").eq("id", user.id).maybeSingle(),
    admin
      .from("subscriptions")
      .select("provider, current_period_end")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .limit(1),
  ]);
  const role = profile?.role ?? "customer";
  const sub = subs?.[0] as { provider: string; current_period_end: string } | undefined;
  // admin ใช้แอปได้โดยไม่ต้องสมัคร (QA) — font-days ของบัญชี admin ถูกกรองออก
  // ตอนคำนวณเงินที่ RPC subscription_month_data (0048/0057) ไม่ใช่ตรงนี้
  const entitled = Boolean(sub) || role === "admin";

  if (body.action === "status") {
    return json({
      active: entitled,
      role,
      provider: sub?.provider ?? (role === "admin" ? "admin" : null),
      current_period_end: sub?.current_period_end ?? null,
    });
  }

  if (!entitled) return json({ error: "no_subscription" }, 403);

  // ── รายการฟอนต์ที่อยู่ใน subscription + ไฟล์ + favourites ──
  if (body.action === "list") {
    const { data: fonts, error: fontErr } = await admin
      .from("fonts")
      .select("id, name, name_th, slug, designer_name, category, cover_image_url")
      .eq("is_subscription", true)
      .eq("is_active", true)
      .order("name");
    if (fontErr) return json({ error: "font_lookup_failed" }, 500);

    const ids = (fonts ?? []).map((f) => f.id);
    const [{ data: files }, { data: favs }] = await Promise.all([
      ids.length
        ? admin.from("font_files_private").select("font_id, full_font_files").in("font_id", ids)
        : Promise.resolve({ data: [] as { font_id: string; full_font_files: string[] | null }[] }),
      admin.from("favourites").select("font_id").eq("user_id", user.id),
    ]);

    const filesByFont = new Map<string, string[]>();
    for (const row of files ?? []) filesByFont.set(row.font_id, row.full_font_files ?? []);

    return json({
      fonts: (fonts ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        name_th: f.name_th,
        slug: f.slug,
        designer_name: f.designer_name,
        category: f.category,
        cover_image_url: f.cover_image_url,
        files: (filesByFont.get(f.id) ?? []).map((p, i) => ({
          index: i,
          name: p.split("/").pop() ?? p,
        })),
      })),
      favourites: (favs ?? []).map((f) => f.font_id),
    });
  }

  if (body.action === "download") {
    const fontId = String(body.font_id ?? "");
    if (!UUID_RE.test(fontId)) return json({ error: "invalid_font_id" }, 400);

    const [{ data: font }, { data: fileRow }] = await Promise.all([
      admin
        .from("fonts")
        .select("name, name_th, is_subscription, is_active")
        .eq("id", fontId)
        .maybeSingle(),
      admin.from("font_files_private").select("full_font_files").eq("font_id", fontId).maybeSingle(),
    ]);
    if (!font || !font.is_subscription || !font.is_active) return json({ error: "not_in_subscription" }, 403);

    const paths: string[] = fileRow?.full_font_files ?? [];
    if (!paths.length) return json({ error: "no_files" }, 404);

    const idx = Number(body.file_index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= paths.length) {
      return json({ error: "invalid_file_index" }, 400);
    }

    // ── จำกัดจำนวนดาวน์โหลดต่อวัน (ต่อ user ไม่ใช่ต่อฟอนต์ — แอปโหลดทั้งไลบรารีได้) ──
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin
      .from("sub_download_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_DOWNLOADS_PER_DAY) return json({ error: "download_limit_reached" }, 429);

    const path = paths[idx];
    const { data: blob, error: dlErr } = await admin.storage.from("fonts-full").download(path);
    if (dlErr || !blob) return json({ error: "file_not_found" }, 404);
    let bytes = new Uint8Array(await blob.arrayBuffer());

    // ── stamp name table (เฉพาะ ttf/otf) ──
    // ต่างจาก download-font: ไม่มี order_no/verify_token ให้อ้าง เพราะสิทธิ์มาจาก
    // การเป็นสมาชิก ไม่ใช่การซื้อขาด — stamp เป็น audit trail ระบุตัวสมาชิก ไม่ใช่ DRM
    // (ไฟล์ที่ถอดรหัสอยู่บนเครื่องระหว่าง activate ยัง copy ได้ เหมือน Adobe Fonts)
    const filename = path.split("/").pop() ?? "font.ttf";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    let stamped = false;
    if (ext === "ttf" || ext === "otf") {
      try {
        const who = profile?.name || user.email || user.id;
        bytes = stampFont(bytes, {
          uniqueId: `Subscription ${user.id} — ${BRAND_DOMAIN}`,
          license: `Subscription — licensed to ${who} — via ${BRAND_DOMAIN}`,
          licenseUrl: `https://${BRAND_DOMAIN}/subscribe`,
        });
        stamped = true;
      } catch (e) {
        // ไฟล์ผิดรูปแบบ/parse ไม่ได้ — ส่งต้นฉบับดีกว่าส่งไฟล์เสีย แต่บันทึกไว้
        console.error("stamp_failed", path, e instanceof Error ? e.message : e);
      }
    }

    await admin.from("sub_download_logs").insert({
      user_id: user.id,
      font_id: fontId,
      file_path: path,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    // **ไม่มี `Content-Disposition: attachment` โดยตั้งใจ** — ต่างจาก `download-font`
    // ที่ปลายทางคือผู้ซื้อกดโหลดไฟล์เก็บไว้จริง ๆ · ปลายทางของ subscription คือ vault
    // ที่เข้ารหัสไว้ในแอป ไม่ใช่ไฟล์ที่สมาชิกถือครอง การใส่ header นี้เป็น affordance
    // ของการ "บันทึกไฟล์" ซึ่งขัดกับโมเดลตรง ๆ · ชื่อไฟล์จริงส่งไปทาง `X-Font-File`
    // ให้แอปใช้ตั้งชื่อภายใน vault เอง
    return new Response(bytes, {
      headers: {
        ...CORS,
        // ต้องเป็น octet-stream เท่านั้น — supabase-js functions.invoke คืน Blob
        // เฉพาะ application/octet-stream กับ application/pdf นอกนั้นถอดเป็น text
        "Content-Type": "application/octet-stream",
        "X-Font-Type": ext === "otf" ? "font/otf" : "font/ttf",
        "X-Font-File": filename.replace(/[^\w.\-]/g, "_"),
        "X-Stamped": stamped ? "1" : "0",
      },
    });
  }

  if (body.action === "heartbeat") {
    const raw = Array.isArray(body.font_ids) ? body.font_ids : [];
    const wanted = [...new Set(raw.map(String).filter((id) => UUID_RE.test(id)))].slice(
      0,
      MAX_HEARTBEAT_IDS,
    );
    if (!wanted.length) return json({ recorded: 0, day: bangkokToday() });

    // กรองเหลือเฉพาะฟอนต์ที่ opt-in จริง — แอปส่งอะไรมาก็ได้ ห้ามเชื่อ
    const { data: valid, error: vErr } = await admin
      .from("fonts")
      .select("id")
      .in("id", wanted)
      .eq("is_subscription", true)
      .eq("is_active", true);
    if (vErr) return json({ error: "font_lookup_failed" }, 500);

    const day = bangkokToday();
    const rows = (valid ?? []).map((f) => ({ user_id: user.id, font_id: f.id, day }));
    if (rows.length) {
      const { error: insErr } = await admin
        .from("stream_days")
        .upsert(rows, { onConflict: "user_id,font_id,day", ignoreDuplicates: true });
      if (insErr) return json({ error: "heartbeat_failed" }, 500);
    }
    return json({ recorded: rows.length, day });
  }

  return json({ error: "unknown_action" }, 400);
});
