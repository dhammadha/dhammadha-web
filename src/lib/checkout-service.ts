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

// ── Price — ต้องให้ผลตรงกับที่ FontDetail แสดง ─────────────────────────────

export interface PurchasableFont {
  id: string;
  slug: string;
  name: string | null;
  name_th: string | null;
  price: number | null;
  sale_price: number | null;
  is_sale: boolean;
  is_free: boolean;
}

export interface PromoSetting {
  active?: boolean;
  discount_percent?: number;
  sale_end?: string; // "dd/mm/yyyy"
}

export function computePersonalPrice(
  font: PurchasableFont,
  promo: PromoSetting | null,
  now: number = Date.now()
): number | null {
  if (font.is_free || !font.price || font.price <= 0) return null;
  if (font.is_sale && font.sale_price && font.sale_price > 0) return font.sale_price;

  if (promo?.active && promo.discount_percent) {
    let promoLive = true;
    if (promo.sale_end) {
      const [d, m, y] = promo.sale_end.split("/").map(Number);
      const end = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59);
      if (now > end.getTime()) promoLive = false;
    }
    if (promoLive) return Math.round(font.price * (1 - promo.discount_percent / 100));
  }
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
  /** origin ของ request เช่น https://dhammadha.com */
  origin?: string | null;
}

export async function handleCheckoutRequest(
  ctx: CheckoutRequestContext,
  env: CheckoutEnv
): Promise<CheckoutResult> {
  if (!env.STRIPE_SECRET_KEY) {
    return { status: 500, body: { ok: false, error: "stripe_not_configured" } };
  }

  const raw = (ctx.body ?? {}) as Record<string, unknown>;
  const fontId = typeof raw.font_id === "string" ? raw.font_id.trim() : "";
  if (!UUID_RE.test(fontId)) {
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
  const [fonts, settings] = await Promise.all([
    supabaseGet<PurchasableFont>(
      env,
      `fonts?id=eq.${fontId}&is_active=eq.true&published_at=not.is.null` +
        `&select=id,slug,name,name_th,price,sale_price,is_sale,is_free`
    ),
    supabaseGet<{ value: PromoSetting }>(env, "settings?key=eq.promotion&select=value"),
  ]);
  const font = fonts?.[0];
  if (!font) return { status: 404, body: { ok: false, error: "font_not_found" } };

  const price = computePersonalPrice(font, settings?.[0]?.value ?? null);
  if (!price) return { status: 400, body: { ok: false, error: "not_purchasable" } };

  const user = ctx.authToken ? await getAuthUser(env, ctx.authToken) : null;
  const fontName = font.name || font.name_th || font.slug;

  const form = new URLSearchParams({
    mode: "payment",
    locale: "th",
    "payment_method_types[0]": "promptpay",
    "payment_method_types[1]": "card",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "thb",
    "line_items[0][price_data][unit_amount]": String(Math.round(price * 100)),
    "line_items[0][price_data][product_data][name]": `ฟอนต์ ${fontName} — สิทธิ์บุคคลทั่วไป`,
    success_url: `${site}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}${cancelPath}`,
    "metadata[font_id]": font.id,
    "metadata[license_type]": "personal",
  });
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

  const fontId = session.metadata?.font_id ?? "";
  const email = session.customer_details?.email || session.customer_email || "";
  if (!session.id || !UUID_RE.test(fontId) || !email) {
    return { status: 400, body: { ok: false, error: "missing_fields" } };
  }
  const userId = session.metadata?.user_id;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // RPC เรียกด้วย service_role เท่านั้น (grant ไว้ใน migration 0033) — idempotent
  const rpcRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/create_checkout_order`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_session_id: session.id,
      p_payment_intent: paymentIntent,
      p_font_id: fontId,
      p_license_type: session.metadata?.license_type || "personal",
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
    return { status: 500, body: { ok: false, error: "email_failed" } };
  }

  return { status: 200, body: { received: true, order_id: order.id } };
}
