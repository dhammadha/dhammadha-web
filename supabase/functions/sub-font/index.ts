// Supabase Edge Function: sub-font — ท่อส่งไฟล์ฟอนต์เข้า vault ของ desktop app
//
// POST { action: "status" }                        → สิทธิ์ปัจจุบัน + เครื่องนี้ถือสิทธิ์อยู่ไหม
// POST { action: "register_device", name, platform } → ลงทะเบียนเครื่อง คืน device_key ครั้งเดียว
// POST { action: "devices" }                       → รายการเครื่องของผู้ใช้ (ไม่มี key)
// POST { action: "revoke_device", device_id }      → ถอนเครื่อง (ใช้ต่อไม่ได้ทันที)
// POST { action: "claim_activation" }              → ยึดสิทธิ์ใช้งานมาที่เครื่องนี้ (เตะเครื่องอื่น)
// POST { action: "list" }                          → ฟอนต์ที่ opt-in + ไฟล์ + favourites
// POST { action: "download", font_id, file_index } → bytes ที่ stamp แล้ว **เข้ารหัสถึงเครื่อง**
// POST { action: "heartbeat", font_ids: [...] }    → บันทึก font-days ของวันนี้
//
// **โมเดล: สมาชิกไม่ได้ "ไฟล์ฟอนต์" — ได้สิทธิ์ให้เครื่องเรียกใช้ระหว่างเป็นสมาชิกเท่านั้น**
// แอปรับ bytes จาก `download` แล้วเก็บเข้า vault ที่เข้ารหัส ถอดเฉพาะตอน activate เพื่อ
// ลงทะเบียนกับระบบฟอนต์ของ OS และลบทิ้งตอน deactivate/ปิดแอป/หมดอายุ
// เงื่อนไขที่ผูกพันสมาชิกอยู่ใน `/agreement` หัวข้อ "การใช้งานผ่านสมาชิก (Subscription)"
// (อ้างชื่อหัวข้อไม่ใช่เลขข้อ เลขเลื่อนได้)
//
// ── ใช้งานได้ทีละเครื่อง (C1c) ──────────────────────────────────────────────
// ลงทะเบียนได้ 2 เครื่อง แต่ **activate ได้ทีละเครื่อง** (รูปแบบเดียวกับ Adobe CC)
// เครื่องที่ `activated_at` ใหม่ที่สุดในบรรดาที่ยังไม่ถูกถอน = เครื่องที่ถือสิทธิ์
// เปิดแอปที่ B → B เรียก `claim_activation` → A รู้ตัวตอน poll ถัดไปแล้วดับฟอนต์ทิ้ง
// **vault ยังอยู่ครบทั้งสองเครื่อง สลับกลับไม่ต้องโหลดใหม่** — คือเหตุผลที่ไม่เลือก
// "1 เครื่องแล้วเตะ" ซึ่งจะทำให้ทุกครั้งที่สลับต้องดึงไฟล์ใหม่ทั้งชุด
// **เตะที่ระดับ activate ไม่ใช่ระดับ login** — เครื่องที่ถูกเตะยังเรียก `list` ดูไลบรารีได้
//
// ── ชั้นสิทธิ์ (C1b, 3 ส.ค. 2569) ───────────────────────────────────────────
// JWT อย่างเดียว **ไม่พอ** สำหรับ action ที่แตะไฟล์ เพราะ `src/lib/supabase.ts` เก็บ
// session ลง localStorage → ก๊อป access token จาก devtools แล้วยิงตรงได้ทันที
// action `list`/`download`/`heartbeat` จึงต้องมีลายเซ็น HMAC จาก device key ที่อยู่ใน
// OS keychain ของเครื่องที่ลงทะเบียนไว้ และ body ของ `download` ถูกเข้ารหัสถึงเครื่องนั้น
//
// ⚠️ ยังไม่ได้ทำให้เป็นไปไม่ได้ — เจ้าของเครื่องงัด key ออกจาก keychain ได้เสมอ
// ที่ได้คือยกระดับจาก "ใครก็ได้ที่มีบัญชี 5 นาที" เป็น "ต้องตั้งใจงัด" + **ระบุตัวได้
// และตัดสิทธิ์เป็นรายเครื่องได้** · แนวป้องกันจริงยังเป็นสัญญา + stamp ในไฟล์
//
// Deploy: supabase functions deploy sub-font (หรือ Supabase MCP deploy_edge_function)

import { createClient } from "npm:@supabase/supabase-js@2";
import { stampFont } from "../_shared/stamp.ts";
import { pickStreamFiles } from "../_shared/font-files.ts";
import {
  ENC_VERSION,
  encryptForDevice,
  newDeviceKey,
  verifyDeviceSignature,
} from "../_shared/device-crypto.ts";

const MAX_DEVICES_PER_USER = 2; // เจ้าของเคาะ 3 ส.ค. 2569 — ต้องตรงกับ /agreement
const MAX_HEARTBEAT_IDS = 500;

// เพดานสามชั้น — คิดบนฐาน 144 ไฟล์ (หลังกติกา OTF) ไม่ใช่ 284
// ฟอนต์หนักสุดหลังกรองเหลือ 14 ไฟล์ → 60/วัน = activate เต็ม ๆ ได้ 4 ตัว
// ตัวที่กันการดูดคลังจริงคือ MAX_FONTS_PER_DAY: ดูดครบ 22 ตัวต้องใช้ 3 วัน
// นานพอให้สัญญาณ "โหลดแต่ไม่มี heartbeat" จับได้ก่อน
//
// 🔴 **นับด้วย `user_id` ไม่ใช่ `device_id`** (แก้จาก C1b ที่นับรายเครื่อง)
// เดิมถอนอุปกรณ์แล้วลงทะเบียนใหม่ = ตัวนับทั้งสามชั้นรีเซ็ตเป็น 0 ทันที
// ซึ่งทำให้ MAX_FONTS_PER_DAY ที่เป็นตัวกันดูดคลังจริงถูกข้ามได้ฟรี
// (`sub_download_logs.device_id` ยังเก็บต่อ — เลิกใช้เป็น key ของเพดาน
//  แต่ยังต้องใช้สอบย้อนหลังว่าเครื่องไหนดึงอะไร)
//
// **ทบทวนตัวเลขอีกครั้งตอน C2 เห็นพฤติกรรม fetch จริง**
const MAX_FILES_PER_DAY = 60;
const MAX_FONTS_PER_DAY = 10;
const MAX_REFETCH_PER_FILE = 3; // ต่อ 30 วัน — แอปเก็บ vault ไว้ ไม่ควรดึงไฟล์เดิมซ้ำ

// ⚠️ สำเนาของ `src/lib/brand.ts` — Deno รันคนละ runtime และ deploy แยกจากเว็บ
// จึง import ข้ามมาไม่ได้ **เปลี่ยนชื่อ/โดเมนแบรนด์ต้องแก้ทั้งสองที่ แล้ว redeploy
// function นี้ด้วย** ไม่งั้นไฟล์ฟอนต์ที่ส่งให้สมาชิกจะยังถูกประทับโดเมนเก่าไว้ในตัวไฟล์
// ซึ่งแก้ย้อนหลังไม่ได้ · **`download-font` มีสำเนาชุดของตัวเองอีกชุด — redeploy ทั้งคู่**
const BRAND_DOMAIN = "dhammadha.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-id, x-timestamp, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // ต้องประกาศ expose ไม่งั้น JS ใน webview อ่าน header ชุด X-* ไม่เห็นเลย (CORS ซ่อนให้)
  "Access-Control-Expose-Headers": "X-Font-Type, X-Font-File, X-Stamped, X-Enc",
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

// Postgres คืน bytea เป็นสตริง hex ขึ้นต้น \x ผ่าน PostgREST
function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("\\x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * เครื่องที่ถือสิทธิ์ใช้งานอยู่ = `activated_at` ใหม่ที่สุดในบรรดาที่ยังไม่ถูกถอน
 * คืน null เมื่อยังไม่มีเครื่องไหนกดใช้งานเลย (ทุกแถว activated_at เป็น null)
 *
 * ไม่มีคอลัมน์ "ใครคือเครื่อง active" แยกต่างหากโดยตั้งใจ — ธงตัวที่สองมีโอกาส
 * ค่าเพี้ยนกันเองเมื่อมีเส้นทางเขียนหลายทาง (0080 อธิบายไว้)
 */
async function activeDevice(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ id: string; name: string | null } | null> {
  const { data } = await admin
    .from("sub_devices")
    .select("id, name, activated_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .not("activated_at", "is", null)
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id as string, name: (data.name as string | null) ?? null } : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ⚠️ ต้องอ่าน text ดิบก่อน parse — ลายเซ็นคิดจากสตริงดิบตัวนี้
  // parse แล้ว stringify ใหม่จะได้คนละ byte แล้วลายเซ็นไม่มีวันตรง
  // (กับดักเดียวกับที่ stripe-webhook.ts ต้องอ่าน request.text() ก่อนเสมอ)
  const rawBody = await req.text();
  let body: {
    action?: string;
    font_id?: string;
    file_index?: number;
    font_ids?: unknown;
    device_id?: string;
    name?: string;
    platform?: string;
  };
  try {
    body = JSON.parse(rawBody || "{}");
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
    // เรียกได้ตั้งแต่ยังไม่ลงทะเบียนเครื่อง (แอปเรียกตอน launch ก่อนทุกอย่าง)
    // จึงไม่บังคับลายเซ็น · ถ้าส่ง X-Device-Id มาด้วยจะบอกกลับว่าเครื่องนี้ถือสิทธิ์อยู่ไหม
    // **นี่คือสัญญาณที่แอปใช้ตัดสินใจ deactivate ฟอนต์เมื่อถูกเครื่องอื่นแย่งสิทธิ์ไป**
    const hdrDevice = req.headers.get("x-device-id") ?? "";
    const act = entitled ? await activeDevice(admin, user.id) : null;
    return json({
      active: entitled,
      role,
      provider: sub?.provider ?? (role === "admin" ? "admin" : null),
      current_period_end: sub?.current_period_end ?? null,
      max_devices: MAX_DEVICES_PER_USER,
      active_device_id: act?.id ?? null,
      active_device_name: act?.name ?? null,
      is_active_device: Boolean(act && UUID_RE.test(hdrDevice) && act.id === hdrDevice),
    });
  }

  if (!entitled) return json({ error: "no_subscription" }, 403);

  // ── จัดการอุปกรณ์ (ต้องใช้ JWT อย่างเดียว แอปยังไม่มี key ตอนลงทะเบียน) ──

  if (body.action === "devices") {
    const [{ data: rows }, act] = await Promise.all([
      admin
        .from("sub_devices")
        .select("id, name, platform, last_seen_at, activated_at, created_at")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .order("created_at"),
      activeDevice(admin, user.id),
    ]);
    return json({
      devices: (rows ?? []).map((d) => ({ ...d, is_active: d.id === act?.id })),
      max_devices: MAX_DEVICES_PER_USER,
      active_device_id: act?.id ?? null,
    });
  }

  if (body.action === "register_device") {
    // 🔴 จุดอ่อนที่ยอมรับ: คนที่ขโมย access token ไปก็ลงทะเบียนเครื่องตัวเองได้
    // การบังคับยืนยันนอกช่องทางทุกครั้งจะทำให้ onboard จริงลำบาก จึงเลือกทางกลาง —
    // เพดาน 2 เครื่องทำให้ขโมยต้องกินสล็อต + ผู้ใช้เห็นรายการเครื่องและถอนเองได้
    // (อีเมลแจ้งเตือนเครื่องใหม่อยู่ฝั่งเว็บ ไม่ได้ยิงจากที่นี่)
    const { count } = await admin
      .from("sub_devices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null);
    if ((count ?? 0) >= MAX_DEVICES_PER_USER) {
      return json(
        { error: "device_limit_reached", max_devices: MAX_DEVICES_PER_USER },
        409,
      );
    }

    const { data: dev, error: devErr } = await admin
      .from("sub_devices")
      .insert({
        user_id: user.id,
        name: typeof body.name === "string" ? body.name.slice(0, 80) : null,
        platform: typeof body.platform === "string" ? body.platform.slice(0, 20) : null,
        last_seen_at: new Date().toISOString(),
        // เครื่องที่เพิ่งลงทะเบียนยึดสิทธิ์ทันที — คนเพิ่งติดตั้งแอปที่เครื่องนี้
        // ย่อมตั้งใจจะใช้ที่เครื่องนี้ ถ้าไม่ตั้งให้ ผู้ใช้ใหม่จะเจอ 409 ตั้งแต่โหลดฟอนต์แรก
        activated_at: new Date().toISOString(),
      })
      .select("id, name, platform, created_at")
      .single();
    if (devErr || !dev) return json({ error: "device_create_failed" }, 500);

    const key = newDeviceKey();
    const { error: keyErr } = await admin
      .from("sub_device_keys")
      .insert({ device_id: dev.id, device_key: `\\x${bytesToHex(key)}` });
    if (keyErr) {
      // เก็บกวาดแถวกำพร้า ไม่งั้นจะกินสล็อตของผู้ใช้โดยที่ใช้งานไม่ได้
      await admin.from("sub_devices").delete().eq("id", dev.id);
      return json({ error: "device_key_failed" }, 500);
    }

    // **device_key คืนครั้งเดียวตรงนี้เท่านั้น** ไม่มี action ไหนอ่านคืนได้อีก
    return json({ device_id: dev.id, device_key: bytesToHex(key), name: dev.name });
  }

  if (body.action === "revoke_device") {
    const id = String(body.device_id ?? "");
    if (!UUID_RE.test(id)) return json({ error: "invalid_device_id" }, 400);
    const { error } = await admin
      .from("sub_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id) // กันถอนเครื่องของคนอื่น
      .is("revoked_at", null);
    if (error) return json({ error: "revoke_failed" }, 500);
    return json({ ok: true });
  }

  // ── ตั้งแต่นี้ไปต้องมีลายเซ็นจากเครื่องที่ลงทะเบียนแล้ว ──
  // นี่คือชั้นที่ปิดทาง "ก๊อป token จาก devtools แล้วยิงตรง"

  const deviceId = req.headers.get("x-device-id") ?? "";
  if (!UUID_RE.test(deviceId)) return json({ error: "device_required" }, 401);

  const { data: device } = await admin
    .from("sub_devices")
    .select("id, user_id, revoked_at")
    .eq("id", deviceId)
    .maybeSingle();
  // เครื่องของคนอื่น / ถูกถอนแล้ว → ตอบเหมือนกันหมด ไม่บอกว่าอันไหนผิด
  if (!device || device.user_id !== user.id || device.revoked_at) {
    return json({ error: "device_invalid" }, 401);
  }

  const { data: keyRow } = await admin
    .from("sub_device_keys")
    .select("device_key")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!keyRow?.device_key) return json({ error: "device_invalid" }, 401);
  const deviceKey = hexToBytes(String(keyRow.device_key));

  const sigOk = await verifyDeviceSignature(
    deviceKey,
    rawBody,
    req.headers.get("x-timestamp"),
    req.headers.get("x-signature"),
  );
  if (!sigOk) return json({ error: "bad_signature" }, 401);

  // await ทั้งที่เป็นข้อมูลประดับ เพราะ promise ที่ไม่ await ใน Edge Function
  // อาจถูกฆ่าทิ้งตอน response กลับ (ต้องใช้ EdgeRuntime.waitUntil ถึงจะรอด)
  // — ยอมจ่ายหนึ่ง round trip ดีกว่าเขียนโค้ดที่ทำงานบ้างไม่ทำงานบ้าง
  await admin
    .from("sub_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", deviceId);

  // ── ยึดสิทธิ์ใช้งานมาที่เครื่องนี้ ──
  // ไม่ต้องเป็นเครื่อง active อยู่ก่อน (นั่นคือจุดประสงค์ของ action นี้)
  // แค่ต้องเป็นเครื่องที่ลงทะเบียนไว้จริงและเซ็นถูก — การเตะเครื่องอื่นเป็นการ
  // เปลี่ยนสถานะ ปลอมไม่ได้
  if (body.action === "claim_activation") {
    const { error } = await admin
      .from("sub_devices")
      .update({ activated_at: new Date().toISOString() })
      .eq("id", deviceId);
    if (error) return json({ error: "claim_failed" }, 500);
    return json({ ok: true, active_device_id: deviceId });
  }

  // ── รายการฟอนต์ที่อยู่ใน subscription + ไฟล์ + favourites ──
  // **ไม่ต้องเป็นเครื่อง active** — เครื่องที่ถูกเตะยังดูไลบรารีได้ เห็นว่ามีฟอนต์อะไรบ้าง
  // และกด "ใช้งานที่เครื่องนี้" เพื่อยึดสิทธิ์กลับได้ ต่างจากการเตะระดับ login
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
    // pickStreamFiles ตัวเดียวกับที่ download ใช้ — index อ้างอิงผลลัพธ์ที่กรองแล้ว
    for (const row of files ?? []) filesByFont.set(row.font_id, pickStreamFiles(row.full_font_files));

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

  // ── ตั้งแต่นี้ไปต้องเป็นเครื่องที่ถือสิทธิ์ใช้งานอยู่ ──
  // `download`/`heartbeat` คือการใช้งานฟอนต์จริง จึงผูกกับ "เครื่องที่ activate อยู่"
  // เครื่องที่ถูกแย่งสิทธิ์ไปจะได้ 409 แล้วแอปเอาไปเป็นสัญญาณ deactivate
  if (body.action === "download" || body.action === "heartbeat") {
    const act = await activeDevice(admin, user.id);
    if (!act || act.id !== deviceId) {
      return json(
        {
          error: "not_active_device",
          active_device_name: act?.name ?? null,
          // แอปเรียก claim_activation เพื่อยึดกลับมาได้ ไม่ต้องโหลด vault ใหม่
          hint: "claim_activation",
        },
        409,
      );
    }
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
    if (!font || !font.is_subscription || !font.is_active) {
      return json({ error: "not_in_subscription" }, 403);
    }

    // 🔴 กรองด้วยฟังก์ชันเดียวกับ list — ถ้าอ่าน array ดิบตรงนี้ ผู้ใช้จะขอ index
    // ของไฟล์ .ttf ที่ถูกกรองออกไปได้ แล้วกติกา OTF จะกลายเป็นแค่คำแนะนำ
    const paths = pickStreamFiles(fileRow?.full_font_files);
    if (!paths.length) return json({ error: "no_files" }, 404);

    const idx = Number(body.file_index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= paths.length) {
      return json({ error: "invalid_file_index" }, 400);
    }
    const path = paths[idx];

    // ── เพดานสามชั้น (รายผู้ใช้ — ดูเหตุผลที่หัวไฟล์) ──
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [{ data: recent }, { count: refetch }] = await Promise.all([
      admin
        .from("sub_download_logs")
        .select("font_id")
        .eq("user_id", user.id)
        .gte("created_at", since),
      admin
        .from("sub_download_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("file_path", path)
        .gte("created_at", since30d),
    ]);
    const todayRows = recent ?? [];
    if (todayRows.length >= MAX_FILES_PER_DAY) {
      return json({ error: "download_limit_reached", limit: "files_per_day" }, 429);
    }
    // ตัวที่กันการดูดคลังจริง — นับ "ฟอนต์ที่ต่างกัน" ไม่ใช่จำนวนไฟล์
    const distinctFonts = new Set(todayRows.map((r) => r.font_id));
    if (!distinctFonts.has(fontId) && distinctFonts.size >= MAX_FONTS_PER_DAY) {
      return json({ error: "download_limit_reached", limit: "fonts_per_day" }, 429);
    }
    if ((refetch ?? 0) >= MAX_REFETCH_PER_FILE) {
      return json({ error: "download_limit_reached", limit: "refetch" }, 429);
    }

    const { data: blob, error: dlErr } = await admin.storage.from("fonts-full").download(path);
    if (dlErr || !blob) return json({ error: "file_not_found" }, 404);
    let bytes = new Uint8Array(await blob.arrayBuffer());

    // ── stamp name table (เฉพาะ ttf/otf) ──
    // ต่างจาก download-font: ไม่มี order_no/verify_token ให้อ้าง เพราะสิทธิ์มาจาก
    // การเป็นสมาชิก ไม่ใช่การซื้อขาด — stamp เป็น audit trail ระบุตัวสมาชิก ไม่ใช่ DRM
    const filename = path.split("/").pop() ?? "font.ttf";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    let stamped = false;
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

    // 🔴 เช็ค error ของ log ด้วย **แล้ว fail ถ้าเขียนไม่ลง** — ตัวนับ rate limit
    // อ่านจากตารางนี้เอง ปล่อยผ่านเมื่อ insert ล้ม = เพดานสูงขึ้นเงียบ ๆ
    // (บทเรียนเดียวกับ sendResendEmail/supabaseSelect ที่เคยกลืน error)
    const { error: logErr } = await admin.from("sub_download_logs").insert({
      user_id: user.id,
      device_id: deviceId,
      font_id: fontId,
      file_path: path,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    if (logErr) {
      console.error("sub_download_log_failed", logErr.message);
      return json({ error: "log_write_failed" }, 500);
    }

    // ── เข้ารหัสถึงเครื่องนี้ ──
    // ต่อให้หลุดทั้ง JWT และ device id ตัว body ก็ยังเปิดไม่ได้ถ้าไม่มี device key
    const payload = await encryptForDevice(deviceKey, bytes);

    // **ไม่มี `Content-Disposition: attachment` โดยตั้งใจ** — ต่างจาก `download-font`
    // ที่ปลายทางคือผู้ซื้อกดโหลดไฟล์เก็บไว้จริง ๆ · ปลายทางของ subscription คือ vault
    // ที่เข้ารหัสไว้ในแอป ไม่ใช่ไฟล์ที่สมาชิกถือครอง
    return new Response(payload, {
      headers: {
        ...CORS,
        // ต้องเป็น octet-stream เท่านั้น — supabase-js functions.invoke คืน Blob
        // เฉพาะ application/octet-stream กับ application/pdf นอกนั้นถอดเป็น text
        "Content-Type": "application/octet-stream",
        "X-Enc": ENC_VERSION,
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
    // stream_days เป็น (user_id, font_id, day) โดยเจตนา — ไม่ผูก device
    // เพราะสูตรแบ่งรายได้เป็น user-centric (สมาชิก 1 คน = น้ำหนัก 1)
    // ถ้านับรายเครื่อง คนมี 2 เครื่องจะได้น้ำหนักสองเท่า = ผิดกติกาในสัญญา designer
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
