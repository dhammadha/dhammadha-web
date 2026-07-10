// Shared email logic — used by both the Cloudflare Pages Function
// (functions/api/send-email.ts, production) and the Next.js route handler
// (src/app/api/send-email/route.ts, dev only). Must stay framework-free:
// fetch + plain objects only, no Next.js or Node-specific imports.

const FROM = "DHAMMADHA STUDIO <noreply@dhammadha.com>";

export interface EmailEnv {
  RESEND_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ADMIN_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface EmailRequestContext {
  body: unknown;
  /** Supabase access token from the Authorization header (promote only) */
  authToken?: string | null;
  /** Client IP for Turnstile verification */
  ip?: string | null;
}

export interface EmailResult {
  status: number;
  body: { ok: boolean; error?: string };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function str(value: unknown, maxLen = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maxLen) : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sendResendEmail(
  apiKey: string,
  msg: { to: string; subject: string; html: string }
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, ...msg }),
  });
  return res.ok;
}

async function supabaseSelect<T>(
  env: EmailEnv,
  pathAndQuery: string,
  accessToken?: string
): Promise<T[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken ?? env.SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as T[];
}

async function verifyTurnstile(env: EmailEnv, token: string, ip?: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured (dev) — skip
  if (!token) return false;
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) form.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

// ── Email HTML builders ─────────────────────────────────────────────────────

const STUDIO_CONTACT_EMAIL = "info@dhammadha.com";

const STUDIO_FOOTER = `
<br>
<p style="color:#888;font-size:13px;border-top:1px solid #eee;padding-top:12px;margin-top:16px">
  ธรรมดาสตูดิโอ<br>
  <a href="https://www.dhammadha.com" style="color:#888">www.dhammadha.com</a><br>
  Mobile: 09-2929-9882<br>
  Line: @dhammadha
</p>
`;

interface QuoteFields {
  contact_name: string;
  company_name: string;
  email: string;
  tax_id: string;
  address: string;
  license_type: string;
  fonts: string;
  note: string;
}

interface DesignerInfo {
  email: string;
  name: string;
  brand: string;
  phone: string;
}

function quoteNotifyHtml(d: QuoteFields): string {
  return `
<p>คุณได้รับคำขอใบเสนอราคาใหม่</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 0;color:#888;width:160px">ชื่อผู้ติดต่อ</td><td style="padding:6px 0">${escapeHtml(d.contact_name)}</td></tr>
  <tr><td style="padding:6px 0;color:#888">บริษัท</td><td style="padding:6px 0">${escapeHtml(d.company_name) || "—"}</td></tr>
  <tr><td style="padding:6px 0;color:#888">อีเมล</td><td style="padding:6px 0">${escapeHtml(d.email)}</td></tr>
  <tr><td style="padding:6px 0;color:#888">เลขประจำตัวผู้เสียภาษี</td><td style="padding:6px 0">${escapeHtml(d.tax_id) || "—"}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ที่อยู่</td><td style="padding:6px 0">${escapeHtml(d.address) || "—"}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ประเภทสิทธิ์</td><td style="padding:6px 0">${escapeHtml(d.license_type)}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ฟอนต์ที่ต้องการ</td><td style="padding:6px 0">${escapeHtml(d.fonts)}</td></tr>
  ${d.note && d.note !== "—" ? `<tr><td style="padding:6px 0;color:#888">หมายเหตุ</td><td style="padding:6px 0">${escapeHtml(d.note)}</td></tr>` : ""}
</table>
<br>
<p><a href="https://dhammadha.com/designer" style="background:#0a8a84;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">จัดการใบเสนอราคา →</a></p>
${STUDIO_FOOTER}
`;
}

function quoteConfirmHtml(d: QuoteFields, designer: DesignerInfo): string {
  const designerFooter = `
<br>
<p style="color:#888;font-size:13px;border-top:1px solid #eee;padding-top:12px;margin-top:16px">
  ${escapeHtml(designer.brand)}<br>
  ${designer.email ? `<a href="mailto:${escapeHtml(designer.email)}" style="color:#888">${escapeHtml(designer.email)}</a><br>` : ""}
  ${designer.phone ? `Mobile: ${escapeHtml(designer.phone)}` : ""}
</p>
`;
  return `
<p>เรียน คุณ ${escapeHtml(d.contact_name)}</p>
<p>เราได้รับคำขอใบเสนอราคาของคุณแล้ว และจะติดต่อกลับภายใน 1-2 วันทำการ</p>
<p><strong>รายละเอียดคำขอ:</strong></p>
<p>
  - ฟอนต์: ${escapeHtml(d.fonts)}<br>
  - ประเภทสิทธิ์: ${escapeHtml(d.license_type)}<br>
  ${d.note && d.note !== "—" ? `- หมายเหตุ: ${escapeHtml(d.note)}` : ""}
</p>
<p>หากมีคำถามเพิ่มเติม ติดต่อได้ที่ <a href="mailto:${escapeHtml(designer.email)}">${escapeHtml(designer.email)}</a></p>
<p>ขอบคุณมากครับ</p>
${designerFooter}
`;
}

function promoteHtml(designerName: string, adminEmail: string): string {
  const contactEmail = adminEmail || STUDIO_CONTACT_EMAIL;
  return `
<p>สวัสดี คุณ ${escapeHtml(designerName)},</p>
<p>ทีมงาน DHAMMADHA STUDIO ได้ตรวจสอบผลงานของคุณแล้ว และยินดีต้อนรับคุณเป็นส่วนหนึ่งของครอบครัวนักออกแบบฟอนต์ของเรา</p>
<p><strong>ขั้นตอนต่อไป:</strong><br>
• เข้าสู่ระบบที่ <a href="https://dhammadha.com">dhammadha.com</a><br>
• ไปที่ Dashboard → อัปโหลดฟอนต์ได้เลย<br>
• ตั้งราคาและรายละเอียดฟอนต์ของคุณ</p>
<p>หากมีคำถามสามารถติดต่อทีมงานได้ที่ <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a></p>
<p>ขอบคุณที่เลือก DHAMMADHA STUDIO</p>
${STUDIO_FOOTER}
`;
}

// ── Handlers ────────────────────────────────────────────────────────────────

type UserRow = {
  email: string | null;
  name: string | null;
  business_name: string | null;
  phone: string | null;
};

async function handleQuote(
  raw: Record<string, unknown>,
  turnstileToken: string,
  ip: string | null | undefined,
  env: EmailEnv
): Promise<EmailResult> {
  if (!(await verifyTurnstile(env, turnstileToken, ip))) {
    return { status: 403, body: { ok: false, error: "turnstile_failed" } };
  }

  const d: QuoteFields = {
    contact_name: str(raw.contact_name, 200),
    company_name: str(raw.company_name, 300),
    email: str(raw.email, 254),
    tax_id: str(raw.tax_id, 20),
    address: str(raw.address, 1000),
    license_type: str(raw.license_type, 200),
    fonts: str(raw.fonts, 1000),
    note: str(raw.note, 2000),
  };
  if (!d.contact_name || !d.license_type || !d.fonts || !EMAIL_RE.test(d.email)) {
    return { status: 400, body: { ok: false, error: "invalid_payload" } };
  }

  // Recipient is looked up server-side from designer_id — never trusted from the client.
  const adminEmail = env.ADMIN_EMAIL ?? "";
  let designer: DesignerInfo = { email: adminEmail, name: "DHAMMADHA STUDIO", brand: "DHAMMADHA STUDIO", phone: "" };
  const designerId = str(raw.designer_id, 40);
  if (designerId && UUID_RE.test(designerId)) {
    const rows = await supabaseSelect<UserRow>(env, `users?id=eq.${designerId}&select=email,name,business_name,phone`);
    const row = rows?.[0];
    if (row?.email) {
      designer = {
        email: row.email,
        name: row.name ?? row.business_name ?? "",
        brand: row.business_name ?? row.name ?? "",
        phone: row.phone ?? "",
      };
    }
  }
  if (!designer.email) return { status: 500, body: { ok: false, error: "no_recipient" } };
  if (!env.RESEND_API_KEY) return { status: 500, body: { ok: false, error: "email_not_configured" } };

  const results = await Promise.all([
    sendResendEmail(env.RESEND_API_KEY, {
      to: designer.email,
      subject: `คำขอใบเสนอราคาใหม่ — ฟอนต์ ${d.fonts.slice(0, 120)}`,
      html: quoteNotifyHtml(d),
    }),
    sendResendEmail(env.RESEND_API_KEY, {
      to: d.email,
      subject: `ได้รับคำขอใบเสนอราคาของคุณแล้ว — ${d.company_name || "DHAMMADHA STUDIO"}`,
      html: quoteConfirmHtml(d, designer),
    }),
  ]);
  if (results.some((ok) => !ok)) return { status: 502, body: { ok: false, error: "send_failed" } };
  return { status: 200, body: { ok: true } };
}

async function handlePromote(
  raw: Record<string, unknown>,
  authToken: string | null | undefined,
  env: EmailEnv
): Promise<EmailResult> {
  if (!authToken) return { status: 401, body: { ok: false, error: "unauthorized" } };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { status: 500, body: { ok: false, error: "not_configured" } };
  }

  // Caller must be an admin — verified against the DB, not the client.
  const roleRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_my_role`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!roleRes.ok || (await roleRes.json()) !== "admin") {
    return { status: 403, body: { ok: false, error: "forbidden" } };
  }

  const userId = str(raw.user_id, 40);
  if (!UUID_RE.test(userId)) return { status: 400, body: { ok: false, error: "invalid_payload" } };

  const rows = await supabaseSelect<UserRow>(env, `users?id=eq.${userId}&select=email,name,business_name,phone`, authToken);
  const target = rows?.[0];
  if (!target?.email) return { status: 404, body: { ok: false, error: "user_not_found" } };
  if (!env.RESEND_API_KEY) return { status: 500, body: { ok: false, error: "email_not_configured" } };

  const ok = await sendResendEmail(env.RESEND_API_KEY, {
    to: target.email,
    subject: "ยินดีด้วย! บัญชี Designer ของคุณได้รับการอนุมัติแล้ว",
    html: promoteHtml(target.name ?? target.email, env.ADMIN_EMAIL ?? ""),
  });
  if (!ok) return { status: 502, body: { ok: false, error: "send_failed" } };
  return { status: 200, body: { ok: true } };
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function handleEmailRequest(ctx: EmailRequestContext, env: EmailEnv): Promise<EmailResult> {
  const body = ctx.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return { status: 400, body: { ok: false, error: "invalid_body" } };
  }
  const payload = (body.payload ?? {}) as Record<string, unknown>;

  try {
    if (body.type === "quote") {
      return await handleQuote(payload, str(body.turnstile_token, 3000), ctx.ip, env);
    }
    if (body.type === "promote") {
      return await handlePromote(payload, ctx.authToken, env);
    }
    return { status: 400, body: { ok: false, error: "unknown_type" } };
  } catch {
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}
