// Shared Stripe checkout logic — used by both the Cloudflare Pages Functions
// (functions/api/checkout.ts + functions/api/stripe-webhook.ts, production)
// and the Next.js route handlers (src/app/api/*, dev only). Must stay
// framework-free: fetch + WebCrypto + plain objects only.
//
// Flow:
//   POST /api/checkout        → คำนวณราคาฝั่ง server → สร้าง Stripe Checkout
//                               Session (PromptPay/บัตร, THB) → คืน url
//   POST /api/stripe-webhook  → ตรวจลายเซ็น Stripe → RPC create_checkout_order
//                               (service_role, idempotent) → อีเมล delivery

import { handleEmailRequest } from "./email-service";
import { effectiveSale } from "./sale";

export interface CheckoutEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RESEND_API_KEY?: string;
  ADMIN_EMAIL?: string;
  /** override origin ของ success/cancel URL (ถ้าไม่ตั้ง ใช้ origin ของ request) */
  PUBLIC_SITE_URL?: string;
}

export interface CheckoutResult {
  status: number;
  body: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// กัน open redirect: path ภายในเว็บเท่านั้น (ห้ามขึ้นต้น // หรือมี scheme)
const SAFE_PATH_RE = /^\/(?!\/)[\w\-./%?=&]*$/;

/**
 * ข้อความข้างช่องติ๊กยอมรับสัญญาบนหน้าจ่ายเงินของ Stripe
 * (`custom_text[terms_of_service_acceptance][message]` — เพดาน 1200 ตัวอักษร)
 *
 * ทำไมต้องเขียนทับ: default ของ Stripe ที่ `locale:"th"` คือ "ยอมรับข้อกำหนดใน
 * การให้บริการ" ซึ่งอ่านแล้วเหมือนข้อกำหนดการใช้เว็บ ทั้งที่ลิงก์ชี้ไป `/agreement/`
 * (สัญญาอนุญาตใช้งานฟอนต์) เพราะ "Terms of service URL" ใน Stripe Dashboard
 * ตั้งได้ **ค่าเดียวทั้งบัญชี** override ต่อ session ไม่ได้
 *
 * 🔴 ทดสอบจริงบนหน้าจ่ายเงินแล้ว (1 ส.ค. 2026 — เอกสาร Stripe ไม่ได้ระบุทั้งสองข้อ):
 *   1. **รองรับลิงก์ markdown** `[ข้อความ](URL)` → เรนเดอร์เป็น `<a href>` จริง
 *   2. **การตั้ง custom_text ลบข้อความ default ทิ้งทั้งก้อน รวมลิงก์ ToS ที่ Stripe
 *      ใส่ให้เองด้วย** → ถ้าไม่ใส่ลิงก์ในข้อความนี้ หน้าจ่ายเงินจะ**ไม่มีทางเข้าถึง
 *      สัญญาอนุญาตเลย** (ช่องติ๊กเหลือแต่กล่องเปล่า) ลิงก์ข้างล่างจึงห้ามถอด
 *
 * ⚠️ ห้ามใส่ชื่อแบรนด์/โดเมนตายตัว — ใช้ `site` ที่มาจาก origin ของ request
 *    จะได้ไม่ต้องกลับมาแก้ตอนเปลี่ยนชื่อแพลตฟอร์ม/ย้ายโดเมน
 * ⚠️ ห้ามเขียนว่า "สัญญาของดีไซน์เนอร์รายนี้" — 1 ใบซื้อข้ามร้านได้ (ตะกร้าหลายฟอนต์)
 *    และ ToS URL เป็นค่าเดียวทั้งบัญชี ถ้อยคำจึงต้องเป็นกลางระหว่างดีไซน์เนอร์
 */
function tosAcceptanceMessage(site: string): string {
  return (
    `ข้าพเจ้าได้อ่านและยอมรับ [สัญญาอนุญาตใช้งานฟอนต์](${site}/agreement/) ` +
    "และเข้าใจว่าการซื้อครั้งนี้เป็นการได้รับสิทธิ์การใช้งาน มิใช่การโอนลิขสิทธิ์ในฟอนต์"
  );
}

// ── Price — ต้องให้ผลตรงกับที่ FontDetail แสดง ─────────────────────────────

export interface PurchasableFont {
  id: string;
  slug: string;
  name: string | null;
  name_th: string | null;
  price: number | null;
  sale_price: number | null;
  sale_end: string | null;
  is_sale: boolean;
  is_free: boolean;
  owner_id: string | null;
  discount_percent?: number | null;
  sale_label?: string | null;
  shop_discount_percent?: number | null;
  shop_sale_end?: string | null;
}

export function computePersonalPrice(
  font: PurchasableFont,
  now: number = Date.now()
): number | null {
  if (font.is_free || !font.price || font.price <= 0) return null;
  const eff = effectiveSale(font, now);
  if (eff.active && eff.salePrice > 0) return eff.salePrice;
  return font.price;
}

// ── Supabase REST helpers ───────────────────────────────────────────────────

async function supabaseGet<T>(env: CheckoutEnv, pathAndQuery: string): Promise<T[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as T[];
}

async function getAuthUser(
  env: CheckoutEnv,
  accessToken: string
): Promise<{ id: string; email: string | null } | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string | null };
  return user?.id ? { id: user.id, email: user.email ?? null } : null;
}

// ── 1. สร้าง Checkout Session ───────────────────────────────────────────────

export interface CheckoutRequestContext {
  body: unknown;
  /** Supabase access token (ลูกค้าที่ login — optional) */
  authToken?: string | null;
  /** origin ของ request เช่น https://example.com — มาจาก header จริง ไม่ได้ hardcode โดเมน */
  origin?: string | null;
}

/** จำนวนฟอนต์สูงสุดต่อการจ่าย 1 ครั้ง — กัน payload บวมและกันยิงถล่ม Stripe */
export const MAX_CART_ITEMS = 20;

export async function handleCheckoutRequest(
  ctx: CheckoutRequestContext,
  env: CheckoutEnv
): Promise<CheckoutResult> {
  if (!env.STRIPE_SECRET_KEY) {
    return { status: 500, body: { ok: false, error: "stripe_not_configured" } };
  }

  const raw = (ctx.body ?? {}) as Record<string, unknown>;
  // รับได้ทั้งแบบตะกร้า (font_ids[]) และแบบซื้อฟอนต์เดียว (font_id — ของเดิม)
  const rawIds = Array.isArray(raw.font_ids)
    ? raw.font_ids
    : typeof raw.font_id === "string"
      ? [raw.font_id]
      : [];
  const fontIds = Array.from(
    new Set(rawIds.filter((v): v is string => typeof v === "string").map((v) => v.trim()))
  );
  if (!fontIds.length || fontIds.length > MAX_CART_ITEMS || !fontIds.every((id) => UUID_RE.test(id))) {
    return { status: 400, body: { ok: false, error: "invalid_font" } };
  }

  const site = (env.PUBLIC_SITE_URL || ctx.origin || "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(site)) {
    return { status: 400, body: { ok: false, error: "invalid_origin" } };
  }
  const cancelPath =
    typeof raw.cancel_path === "string" && SAFE_PATH_RE.test(raw.cancel_path)
      ? raw.cancel_path
      : "/fonts/";

  // ราคาคำนวณจาก DB ฝั่ง server เสมอ — ไม่รับราคาจาก client
  const fonts = await supabaseGet<PurchasableFont>(
    env,
    `fonts?id=in.(${fontIds.join(",")})&is_active=eq.true&published_at=not.is.null` +
      `&select=id,slug,name,name_th,price,sale_price,sale_end,is_sale,is_free,owner_id,discount_percent,sale_label`
  );
  if (!fonts || fonts.length !== fontIds.length) {
    return { status: 404, body: { ok: false, error: "font_not_found" } };
  }

  // โปรร้าน (layer แยกจาก sale_* รายฟอนต์) — fetch fail = คิดราคาแบบไม่มีโปรร้าน
  // (fail ทางราคาเต็ม ตาม philosophy เดิม) · ดึงทีเดียวสำหรับทุกร้านในตะกร้า
  const ownerIds = Array.from(new Set(fonts.map((f) => f.owner_id).filter((v): v is string => !!v)));
  if (ownerIds.length) {
    const promos = await supabaseGet<{ designer_id: string; discount_percent: number; sale_end: string }>(
      env,
      `designer_promotions?designer_id=in.(${ownerIds.join(",")})&select=designer_id,discount_percent,sale_end`
    );
    for (const font of fonts) {
      const promo = promos?.find((p) => p.designer_id === font.owner_id);
      if (promo) {
        font.shop_discount_percent = promo.discount_percent;
        font.shop_sale_end = promo.sale_end;
      }
    }
  }

  // เรียงตามลำดับที่ client ส่งมา เพื่อให้รายการบนหน้าจ่ายเงินตรงกับตะกร้า
  const ordered = fontIds.map((id) => fonts.find((f) => f.id === id)!);
  const priced: { font: PurchasableFont; price: number }[] = [];
  for (const font of ordered) {
    const price = computePersonalPrice(font);
    if (!price) return { status: 400, body: { ok: false, error: "not_purchasable" } };
    priced.push({ font, price });
  }

  const user = ctx.authToken ? await getAuthUser(env, ctx.authToken) : null;

  const form = new URLSearchParams({
    mode: "payment",
    locale: "th",
    "payment_method_types[0]": "promptpay",
    "payment_method_types[1]": "card",
    success_url: `${site}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}${cancelPath}`,
    // บังคับติ๊กยอมรับสัญญาอนุญาตก่อนจ่าย — Stripe เก็บผลไว้ที่ session.consent
    // เป็นหลักฐานว่าลูกค้ายอมรับ (ทำฝั่ง Stripe ไม่ใช่ฝั่งเรา ลูกค้าจะข้ามไม่ได้)
    // ⚠️ ลิงก์ที่ติ๊กชี้ไปตาม "Terms of service URL" ใน Stripe Dashboard →
    // ต้องตั้งเป็น <โดเมน>/agreement/ ให้ครบ **ทั้งโหมด test และ live**
    // ถ้าไม่ตั้ง Stripe จะปฏิเสธการสร้าง session ทันที (ปุ่มซื้อพัง)
    "consent_collection[terms_of_service]": "required",
    // เขียนทับข้อความ default ของ Stripe ให้ตรงกับปลายทางของลิงก์ (สัญญาอนุญาต
    // ไม่ใช่ข้อกำหนดการใช้เว็บ) — เหตุผลเต็ม + ผลทดสอบ ดู tosAcceptanceMessage()
    "custom_text[terms_of_service_acceptance][message]": tosAcceptanceMessage(site),
    "metadata[license_type]": "personal",
  });

  // แต่ละบรรทัดพก font_id ไว้ที่ product metadata — webhook อ่านกลับมาเพื่อรู้ว่า
  // เงินก้อนไหนเป็นของฟอนต์ไหน (metadata ระดับ session เก็บได้จำกัด 500 ตัวอักษร
  // ต่อค่า ใส่ทั้งตะกร้าไม่พอ และ line_items คือยอดที่ Stripe เก็บได้จริง)
  priced.forEach(({ font, price }, i) => {
    const fontName = font.name || font.name_th || font.slug;
    form.set(`line_items[${i}][quantity]`, "1");
    form.set(`line_items[${i}][price_data][currency]`, "thb");
    form.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(price * 100)));
    // ใช้ถ้อยคำเดียวกับ LICENSE_LABEL.personal / /agreement — ลูกค้าเห็นคำเดียวกัน
    // ตลอดเส้นทาง ตะกร้า → หน้าจ่ายเงิน → อีเมล → เอกสาร
    form.set(
      `line_items[${i}][price_data][product_data][name]`,
      `ฟอนต์ ${fontName} — สิทธิการใช้งานส่วนบุคคล`
    );
    form.set(`line_items[${i}][price_data][product_data][metadata][font_id]`, font.id);
  });
  // ซื้อฟอนต์เดียว: คง metadata[font_id] ไว้เป็นทางถอยของ webhook (session เก่า
  // ที่สร้างก่อน deploy รอบนี้ยังไม่มี product metadata)
  if (priced.length === 1) form.set("metadata[font_id]", priced[0].font.id);
  if (user?.id) form.set("metadata[user_id]", user.id);
  if (user?.email) form.set("customer_email", user.email);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const session = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !session.url) {
    return { status: 502, body: { ok: false, error: "stripe_error", detail: session.error?.message } };
  }
  return { status: 200, body: { ok: true, url: session.url } };
}

// ── 2. Webhook — ตรวจลายเซ็นแล้วสร้าง order ─────────────────────────────────

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** ตรวจ Stripe-Signature header: "t=<unix>,v1=<hmac>[,v1=...]" */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
  now: number = Date.now()
): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  return sigs.some((s) => s && timingSafeEqual(s, expected));
}

interface StripeCheckoutSession {
  id?: string;
  mode?: string;
  payment_status?: string;
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  metadata?: Record<string, string | undefined> | null;
}

export interface CheckoutItem {
  font_id: string;
  license_type: string;
  price: number;
}

/**
 * รายการในคำสั่งซื้อจาก line_items ของ session — font_id ฝังไว้ที่ product metadata
 * ตอนสร้าง session · คืน [] เมื่ออ่านไม่ได้/ไม่มี metadata (session เก่า) ให้ผู้เรียก
 * ไปใช้ทางถอย ไม่ throw เพราะ webhook ต้องตอบ Stripe เสมอ
 */
async function fetchSessionItems(
  env: CheckoutEnv,
  sessionId: string,
  licenseType: string
): Promise<CheckoutItem[]> {
  if (!env.STRIPE_SECRET_KEY) return [];
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items` +
      `?limit=100&expand[]=data.price.product`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  if (!res.ok) return [];
  const body = (await res.json()) as {
    data?: {
      amount_total?: number;
      price?: { product?: { metadata?: Record<string, string> } | string };
    }[];
  };
  const items: CheckoutItem[] = [];
  for (const line of body.data ?? []) {
    const product = line.price?.product;
    const fontId = typeof product === "object" ? product?.metadata?.font_id : undefined;
    if (!fontId || !UUID_RE.test(fontId)) continue;
    items.push({
      font_id: fontId,
      license_type: licenseType,
      price: (line.amount_total ?? 0) / 100,
    });
  }
  return items;
}

export interface WebhookRequestContext {
  /** body ดิบตามที่ Stripe ส่ง — ห้าม parse ก่อน ไม่งั้นลายเซ็นไม่ตรง */
  rawBody: string;
  /** ค่า header Stripe-Signature */
  signature: string | null;
}

export async function handleStripeWebhookRequest(
  ctx: WebhookRequestContext,
  env: CheckoutEnv
): Promise<CheckoutResult> {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 500, body: { ok: false, error: "not_configured" } };
  }
  if (!(await verifyStripeSignature(ctx.rawBody, ctx.signature, env.STRIPE_WEBHOOK_SECRET))) {
    return { status: 400, body: { ok: false, error: "bad_signature" } };
  }

  let event: { type?: string; data?: { object?: StripeCheckoutSession } };
  try {
    event = JSON.parse(ctx.rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: "invalid_json" } };
  }

  // PromptPay/บัตรจ่ายสำเร็จทันที → completed (payment_status=paid)
  // ช่องทาง async → completed มาก่อนแบบ unpaid แล้วตามด้วย async_payment_succeeded
  const relevant =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";
  const session = event.data?.object;
  if (!relevant || !session || session.mode !== "payment") {
    return { status: 200, body: { received: true, ignored: true } };
  }
  if (session.payment_status !== "paid") {
    return { status: 200, body: { received: true, awaiting_payment: true } };
  }

  const email = session.customer_details?.email || session.customer_email || "";
  if (!session.id || !email) {
    return { status: 400, body: { ok: false, error: "missing_fields" } };
  }
  const licenseType = session.metadata?.license_type || "personal";

  // รายการที่จ่ายจริง — อ่านจาก line_items ของ Stripe เพราะเป็นยอดที่เก็บเงินได้จริง
  // และแต่ละบรรทัดพก font_id มาที่ product metadata (ดูตอนสร้าง session)
  let items = await fetchSessionItems(env, session.id, licenseType);
  if (!items.length) {
    // ทางถอย: session ที่สร้างก่อนมีตะกร้า (ไม่มี product metadata) — ใช้ font เดียว
    // จาก metadata ระดับ session ตามของเดิม
    const fontId = session.metadata?.font_id ?? "";
    if (UUID_RE.test(fontId)) {
      items = [{ font_id: fontId, license_type: licenseType, price: (session.amount_total ?? 0) / 100 }];
    }
  }
  if (!items.length) {
    return { status: 400, body: { ok: false, error: "missing_fields" } };
  }

  const userId = session.metadata?.user_id;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // RPC เรียกด้วย service_role เท่านั้น (grant ไว้ใน migration 0069) — idempotent
  const rpcRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/create_checkout_order_multi`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_session_id: session.id,
      p_payment_intent: paymentIntent,
      p_items: items,
      p_email: email,
      p_customer_name: session.customer_details?.name ?? null,
      p_amount: (session.amount_total ?? 0) / 100,
      p_user_id: userId && UUID_RE.test(userId) ? userId : null,
    }),
  });
  if (!rpcRes.ok) {
    // 500 → Stripe retry เอง — RPC idempotent จึงยิงซ้ำได้ปลอดภัย
    return { status: 500, body: { ok: false, error: "order_failed" } };
  }
  const order = (await rpcRes.json()) as { id?: string };
  if (!order?.id) return { status: 500, body: { ok: false, error: "order_failed" } };

  // อีเมล delivery — ใช้ logic เดิมของ Phase 2 (service role อ่าน order ข้าม RLS)
  const emailResult = await handleEmailRequest(
    { body: { type: "delivery", payload: { order_id: order.id } }, authToken: env.SUPABASE_SERVICE_ROLE_KEY },
    {
      RESEND_API_KEY: env.RESEND_API_KEY,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      ADMIN_EMAIL: env.ADMIN_EMAIL,
    }
  );
  if (emailResult.status !== 200) {
    // order สร้างแล้วแต่อีเมลไม่ออก → ให้ Stripe retry (RPC จะคืน order เดิม
    // แล้วมาลองส่งอีเมลใหม่) — ลูกค้าที่ login ยังเห็นไฟล์ใน "ดาวน์โหลดของฉัน" ทันที
    //
    // ⚠️ ต้องพ่วงสาเหตุชั้นในออกไปด้วยเสมอ — เดิมคืนแค่ `email_failed` ทำให้
    // delivery log ของ Stripe (ที่เดียวที่เห็น response ของ production) บอกอะไรไม่ได้เลย
    return {
      status: 500,
      body: {
        ok: false,
        error: "email_failed",
        email_status: emailResult.status,
        email_error: (emailResult.body as { error?: string }).error,
        email_detail: (emailResult.body as { detail?: string }).detail,
      },
    };
  }

  return { status: 200, body: { received: true, order_id: order.id } };
}
