// Shared email logic — used by both the Cloudflare Pages Function
// (functions/api/send-email.ts, production) and the Next.js route handler
// (src/app/api/send-email/route.ts, dev only). Must stay framework-free:
// fetch + plain objects only, no Next.js or Node-specific imports.

import { licenseLabel } from "./license";

const FROM = "DHAMMADHA STUDIO <noreply@dhammadha.com>";

export interface EmailEnv {
  RESEND_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  /**
   * ใช้เฉพาะการค้นอีเมล designer ตอนส่งแจ้งเตือน quote — ฟอร์ม quote เป็นสาธารณะ
   * ไม่มี JWT ของใครให้ใช้ และตั้งแต่ 0054 anon อ่านตาราง users ไม่ได้แล้ว
   * (bank/tax_id/phone อยู่ในนั้น) ค่านี้อยู่ฝั่ง server เท่านั้น ห้ามมี NEXT_PUBLIC_ นำหน้า
   */
  SUPABASE_SERVICE_ROLE_KEY?: string;
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
// basename ปลอดภัย: ตัวอักษร/ตัวเลข/จุด/ขีด เท่านั้น ลงท้าย .pdf — กัน path traversal และอักขระควบคุม
const PDF_FILENAME_RE = /^[A-Za-z0-9._-]{1,150}\.pdf$/i;
// base64 คร่าวๆ (ไม่ตรวจ padding เป๊ะ) — พอกันไฟล์ที่ไม่ใช่ base64 หลุดเข้ามา
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
// ~4,000,000 ตัวอักษร base64 ≈ 3MB ไฟล์จริง — เผื่อ headroom ใต้ลิมิตของ Resend
const PDF_BASE64_MAX_LEN = 4_000_000;

async function sendResendEmail(
  apiKey: string,
  msg: {
    to: string;
    subject: string;
    html: string;
    attachments?: { filename: string; content: string }[];
  }
): Promise<boolean> {
  const { attachments, ...rest } = msg;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      ...rest,
      ...(attachments && attachments.length ? { attachments } : {}),
    }),
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

/**
 * อ่านด้วยสิทธิ์ service role — ข้าม RLS ทั้งหมด
 * ใช้ได้เฉพาะฝั่ง server และเฉพาะกรณีที่ไม่มี JWT ของผู้ใช้ให้ยืมสิทธิ์
 * (ตอนนี้มีที่เดียวคือค้นอีเมล designer จากฟอร์ม quote สาธารณะ)
 * คืน null ถ้าไม่ได้ตั้ง key ไว้ — ผู้เรียกต้องจัดการกรณีนี้เอง ห้ามเงียบ
 */
async function supabaseSelectAsService<T>(
  env: EmailEnv,
  pathAndQuery: string
): Promise<T[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  // ส่งเฉพาะ header apikey — ห้ามส่ง Authorization: Bearer
  //
  // รองรับ key ได้ทั้ง 2 รูปแบบ:
  //  - service_role แบบเดิม (JWT `eyJ...`) → gateway อ่าน apikey แล้วผ่านลง PostgREST ปกติ
  //  - secret key แบบใหม่ (`sb_secret_...`) → ไม่ใช่ JWT ถ้าใส่ใน Authorization
  //    PostgREST จะปฏิเสธเพราะถอดรหัสไม่ได้ แต่ถ้าไม่ส่ง Authorization มาเลย
  //    gateway จะ synthesize ให้เองจาก apikey (ดู docs "New API keys" → Authorization synthesis)
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY },
  });
  if (!res.ok) return null;
  return (await res.json()) as T[];
}

async function verifyTurnstile(env: EmailEnv, token: string, ip?: string | null): Promise<boolean> {
  // Fail-closed: ถ้าตั้ง TURNSTILE_SECRET_KEY ไว้แล้ว (production ต้องตั้งเสมอ)
  // ไม่มี token หรือ token ว่าง ต้องถือว่า "ไม่ผ่าน" — ป้องกัน client ที่ไม่ส่ง
  // token มา (หรือแก้โค้ดฝั่ง client เอง) สแปมอีเมลผ่าน quote endpoint ได้
  if (env.TURNSTILE_SECRET_KEY && !token) return false;
  // Escape hatch เดียวที่เหลือ: ไม่ตั้ง TURNSTILE_SECRET_KEY เลย (เช่นตอน
  // `npm run dev` ในเครื่องที่ไม่มี secret) — ข้ามการตรวจเพื่อให้ dev ทำงานได้
  // *** production ต้องตั้ง TURNSTILE_SECRET_KEY เสมอ ไม่งั้นช่องโหว่นี้จะเปิดอยู่ ***
  if (!env.TURNSTILE_SECRET_KEY) return true;
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

interface OrderRow {
  order_no: string;
  customer_email: string;
  customer_name: string | null;
  designer_id: string | null;
  items: Array<{ name?: string; license_type?: string; price?: number }>;
  total_amount: number;
  discount: number;
  paid_at: string | null;
}

function deliveryHtml(
  order: OrderRow,
  designerBrand: string,
  licensePdfUrl: string | null,
  receiptNo: string | null = null
): string {
  const rows = order.items
    .map(
      (i) => `<tr>
  <td style="padding:6px 0">${escapeHtml(i.name ?? "")}<br><span style="color:#888;font-size:12px">สิทธิ์ใช้งาน: ${escapeHtml(licenseLabel(i.license_type))}</span></td>
  <td style="padding:6px 0;text-align:right;white-space:nowrap">฿${Number(i.price ?? 0).toLocaleString()}</td>
</tr>`
    )
    .join("");
  const discountRow =
    Number(order.discount) > 0
      ? `<tr><td style="padding:6px 0;color:#888">ส่วนลด</td><td style="padding:6px 0;text-align:right;white-space:nowrap;color:#c0392b">-฿${Number(order.discount).toLocaleString()}</td></tr>`
      : "";
  return `
<p>เรียน คุณ ${escapeHtml(order.customer_name ?? "")}</p>
<p>ขอบคุณสำหรับการสั่งซื้อ — เราได้รับการยืนยันการชำระเงินของคุณแล้ว (เลขที่คำสั่งซื้อ <strong>${escapeHtml(order.order_no)}</strong>)</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  ${rows}
  ${discountRow}
  <tr><td style="padding:8px 0;border-top:1px solid #eee;font-weight:bold">รวม</td><td style="padding:8px 0;border-top:1px solid #eee;text-align:right;font-weight:bold">฿${Number(order.total_amount).toLocaleString()}</td></tr>
</table>
<p><strong>ดาวน์โหลดไฟล์ฟอนต์:</strong><br>
เข้าสู่ระบบที่ dhammadha.com ด้วยอีเมลนี้ (${escapeHtml(order.customer_email)}) <br>แล้วไปที่หน้า "บัญชีของฉัน" โดยไฟล์ทั้งหมดอยู่ในส่วน "ดาวน์โหลดของฉัน" และดาวน์โหลดซ้ำได้ตลอด</p>
<p>หากยังไม่มีบัญชี สมัครสมาชิกด้วยอีเมลนี้ ระบบจะผูกสิทธิ์ให้อัตโนมัติ</p>
<p><br><a href="https://dhammadha.com/account" style="background:#0a8a84;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">ไปที่หน้าดาวน์โหลด →</a><br><br></p>
${receiptNo ? `<p style="color:#555;font-size:13px">แนบใบเสร็จรับเงินเลขที่ <strong>${escapeHtml(receiptNo)}</strong> มาพร้อมอีเมลฉบับนี้แล้ว</p>` : ""}
${licensePdfUrl ? `<p>เอกสารข้อตกลงสิทธิ์การใช้งาน (License): <a href="${escapeHtml(licensePdfUrl)}">ดาวน์โหลด PDF</a></p>` : ""}
<p style="color:#888;font-size:13px">ไฟล์ฟอนต์ของคุณถูกประทับข้อมูลการซื้อ (เลขคำสั่งซื้อ) ไว้ในไฟล์ ตรวจสอบได้ที่ dhammadha.com/verify</p>
<br>
<p style="color:#888;font-size:13px;border-top:1px solid #eee;padding-top:12px;margin-top:16px">${escapeHtml(designerBrand)}<br>via dhammadha.com</p>
`;
}

interface DocumentQuoteFields {
  contact_name: string;
  company_name: string;
}

function documentHtml(d: DocumentQuoteFields, docType: "quotation" | "receipt", docNo: string): string {
  const greetingName = d.contact_name || d.company_name || "";
  const body =
    docType === "quotation"
      ? `<p>แนบใบเสนอราคาเลขที่ <strong>${escapeHtml(docNo)}</strong> ตามที่ท่านสอบถามเข้ามา กรุณาตรวจสอบรายละเอียดในไฟล์ที่แนบมาพร้อมนี้</p>
<p>หากมีข้อสงสัยหรือต้องการแก้ไขรายการ ติดต่อได้ที่ <a href="mailto:${escapeHtml(STUDIO_CONTACT_EMAIL)}">${escapeHtml(STUDIO_CONTACT_EMAIL)}</a></p>`
      : `<p>ขอบคุณสำหรับการชำระเงิน แนบใบเสร็จรับเงินเลขที่ <strong>${escapeHtml(docNo)}</strong> ตามไฟล์ที่แนบมาพร้อมนี้</p>
<p>หากมีข้อสงสัยเกี่ยวกับใบเสร็จ ติดต่อได้ที่ <a href="mailto:${escapeHtml(STUDIO_CONTACT_EMAIL)}">${escapeHtml(STUDIO_CONTACT_EMAIL)}</a></p>`;
  return `
<p>เรียน คุณ ${escapeHtml(greetingName)}</p>
${body}
<p>ขอบคุณมากครับ</p>
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
  //
  // ต้องใช้ service role: ฟอร์ม quote เป็นสาธารณะ ไม่มี JWT ของใครให้ยืมสิทธิ์ และตั้งแต่
  // migration 0054 anon อ่านตาราง users ไม่ได้แล้ว (bank/tax_id/phone อยู่ในนั้น)
  // ถ้ายิงด้วย anon key จะได้ null เงียบ ๆ แล้วตกไปใช้ ADMIN_EMAIL — designer ไม่ได้รับแจ้ง
  // และไม่มีใครรู้ตัว จึงต้องดังตั้งแต่ตอนไม่ได้ตั้ง key
  const adminEmail = env.ADMIN_EMAIL ?? "";
  let designer: DesignerInfo = { email: adminEmail, name: "DHAMMADHA STUDIO", brand: "DHAMMADHA STUDIO", phone: "" };
  const designerId = str(raw.designer_id, 40);
  if (designerId && UUID_RE.test(designerId)) {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      return { status: 500, body: { ok: false, error: "service_role_not_configured" } };
    }
    const rows = await supabaseSelectAsService<UserRow>(
      env,
      `users?id=eq.${designerId}&select=email,name,business_name,phone`
    );
    const row = rows?.[0];
    if (!row?.email) return { status: 500, body: { ok: false, error: "designer_not_found" } };
    designer = {
      email: row.email,
      name: row.name ?? row.business_name ?? "",
      brand: row.business_name ?? row.name ?? "",
      phone: row.phone ?? "",
    };
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

async function handleDelivery(
  raw: Record<string, unknown>,
  authToken: string | null | undefined,
  env: EmailEnv
): Promise<EmailResult> {
  if (!authToken) return { status: 401, body: { ok: false, error: "unauthorized" } };
  const orderId = str(raw.order_id, 40);
  if (!UUID_RE.test(orderId)) return { status: 400, body: { ok: false, error: "invalid_payload" } };

  // ไฟล์แนบใบเสร็จ (ถ้ามี) — ออปชันนัล ไม่มีก็ยังส่งอีเมลได้ตามปกติ
  const pdfBase64 = typeof raw.pdf_base64 === "string" ? raw.pdf_base64.trim() : "";
  const filename = str(raw.filename, 200);
  const receiptNo = str(raw.receipt_no, 40);

  let attachments: { filename: string; content: string }[] | undefined;
  if (pdfBase64) {
    if (
      !PDF_FILENAME_RE.test(filename) ||
      pdfBase64.length > PDF_BASE64_MAX_LEN ||
      !BASE64_RE.test(pdfBase64)
    ) {
      return { status: 400, body: { ok: false, error: "invalid_attachment" } };
    }
    attachments = [{ filename, content: pdfBase64 }];
  }

  // อ่าน order ด้วย token ของผู้เรียก — RLS บังคับให้เห็นเฉพาะ order ของตัวเอง
  // (designer เจ้าของ / admin) จึงยิงอีเมลแทน order คนอื่นไม่ได้
  const orders = await supabaseSelect<OrderRow>(
    env,
    `orders?id=eq.${orderId}&select=order_no,customer_email,customer_name,designer_id,items,total_amount,discount,paid_at`,
    authToken
  );
  const order = orders?.[0];
  if (!order?.customer_email) return { status: 404, body: { ok: false, error: "order_not_found" } };
  if (!env.RESEND_API_KEY) return { status: 500, body: { ok: false, error: "email_not_configured" } };

  let brand = "DHAMMADHA STUDIO";
  let licensePdfUrl: string | null = null;
  if (order.designer_id) {
    const [users, configs] = await Promise.all([
      supabaseSelect<UserRow>(env, `users?id=eq.${order.designer_id}&select=email,name,business_name,phone`, authToken),
      supabaseSelect<{ license_pdf_url: string | null }>(
        env,
        `designer_license_config?designer_id=eq.${order.designer_id}&select=license_pdf_url`,
        authToken
      ),
    ]);
    const u = users?.[0];
    if (u) brand = u.business_name ?? u.name ?? brand;
    licensePdfUrl = configs?.[0]?.license_pdf_url ?? null;
  }

  const ok = await sendResendEmail(env.RESEND_API_KEY, {
    to: order.customer_email,
    subject: `คำสั่งซื้อ ${order.order_no} สำเร็จ — ดาวน์โหลดฟอนต์ของคุณได้แล้ว`,
    html: deliveryHtml(order, brand, licensePdfUrl, receiptNo || null),
    ...(attachments ? { attachments } : {}),
  });
  if (!ok) return { status: 502, body: { ok: false, error: "send_failed" } };
  return { status: 200, body: { ok: true } };
}

type QuoteRow = {
  email: string | null;
  contact_name: string | null;
  company_name: string | null;
  quote_no: string | null;
  receipt_no: string | null;
};

async function handleDocument(
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

  const quoteId = str(raw.quote_id, 40);
  const docTypeRaw = str(raw.doc_type, 20);
  const filename = str(raw.filename, 200);
  const pdfBase64 = typeof raw.pdf_base64 === "string" ? raw.pdf_base64.trim() : "";

  if (!UUID_RE.test(quoteId)) return { status: 400, body: { ok: false, error: "invalid_payload" } };
  if (docTypeRaw !== "quotation" && docTypeRaw !== "receipt") {
    return { status: 400, body: { ok: false, error: "invalid_payload" } };
  }
  const docType = docTypeRaw as "quotation" | "receipt";
  if (!PDF_FILENAME_RE.test(filename)) return { status: 400, body: { ok: false, error: "invalid_filename" } };
  if (!pdfBase64) return { status: 400, body: { ok: false, error: "invalid_payload" } };
  if (pdfBase64.length > PDF_BASE64_MAX_LEN) return { status: 400, body: { ok: false, error: "file_too_large" } };
  if (!BASE64_RE.test(pdfBase64)) return { status: 400, body: { ok: false, error: "invalid_payload" } };

  // อ่าน quote ด้วย token ของผู้เรียก — RLS ฝั่ง admin อนุญาตให้เห็นทุกใบ (เหมือน handleDelivery)
  const quotes = await supabaseSelect<QuoteRow>(
    env,
    `quotes?id=eq.${quoteId}&select=email,contact_name,company_name,quote_no,receipt_no`,
    authToken
  );
  const quote = quotes?.[0];
  if (!quote?.email) return { status: 404, body: { ok: false, error: "quote_not_found" } };

  // เอกสารต้องออกเลขที่แล้วก่อนถึงจะส่งได้
  const docNo = docType === "quotation" ? quote.quote_no : quote.receipt_no;
  if (!docNo) return { status: 400, body: { ok: false, error: "doc_not_issued" } };

  if (!env.RESEND_API_KEY) return { status: 500, body: { ok: false, error: "email_not_configured" } };

  const subject =
    docType === "quotation"
      ? `ใบเสนอราคา ${docNo} — DHAMMADHA STUDIO`
      : `ใบเสร็จรับเงิน ${docNo} — DHAMMADHA STUDIO`;

  const ok = await sendResendEmail(env.RESEND_API_KEY, {
    to: quote.email,
    subject,
    html: documentHtml(
      { contact_name: quote.contact_name ?? "", company_name: quote.company_name ?? "" },
      docType,
      docNo
    ),
    attachments: [{ filename, content: pdfBase64 }],
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
    if (body.type === "delivery") {
      return await handleDelivery(payload, ctx.authToken, env);
    }
    if (body.type === "document") {
      return await handleDocument(payload, ctx.authToken, env);
    }
    return { status: 400, body: { ok: false, error: "unknown_type" } };
  } catch {
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}
