// Shared email logic — used by both the Cloudflare Pages Function
// (functions/api/send-email.ts, production) and the Next.js route handler
// (src/app/api/send-email/route.ts, dev only). Must stay framework-free:
// fetch + plain objects only, no Next.js or Node-specific imports.

import { licenseLabel, designerLicensePdf } from "./license";
import { NAME as BRAND, DOMAIN, URL as SITE_URL, CONTACT_EMAIL, FROM_EMAIL, LEGAL_ENTITY } from "./brand";

const FROM = FROM_EMAIL;

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
  /** `detail` = สาเหตุดิบจากปลายทาง (เช่น body ที่ Resend ตอบกลับ) มีเฉพาะตอนพัง */
  body: { ok: boolean; error?: string; detail?: string };
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

/**
 * บรรทัดทักทายหัวอีเมล — กันเคส "เรียน คุณ " ห้อยลอยเมื่อไม่รู้ชื่อผู้รับ
 *
 * ⚠️ ไม่ใช่เคสหายาก: **PromptPay ไม่เก็บชื่อผู้จ่าย** (`customer_details.name` ของ
 * Stripe เป็น null) ลูกค้าที่จ่ายด้วย PromptPay ทุกคนจึงเข้าทางนี้
 * — ใบบัตรถึงจะมีชื่อ เพราะกรอกชื่อบนบัตร (เจอจริงตอนทดสอบขั้นที่ 2, 1 ส.ค. 2026)
 */
function greetingLine(name: string | null | undefined): string {
  const n = typeof name === "string" ? name.trim() : "";
  return n ? `เรียน คุณ ${escapeHtml(n)}` : "สวัสดีครับ";
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
/** อีเมล delivery แนบได้มากสุด 2 ใบ = ใบเสร็จ + ใบแจ้งหนี้ */
const MAX_ATTACHMENTS = 2;

/**
 * ส่งอีเมลผ่าน Resend — คืน `null` เมื่อสำเร็จ, คืน**ข้อความสาเหตุ**เมื่อพัง
 *
 * ⚠️ เดิมฟังก์ชันนี้คืนแค่ `res.ok` แล้วทิ้ง error body ของ Resend ทั้งก้อน
 * ผลคือตอนอีเมลไม่ออกบน production ไม่มีใครรู้สาเหตุเลย (เจอจริงตอนทดสอบ
 * Stripe ขั้นที่ 2 — 1 ส.ค. 2026: delivery log ของ Stripe โชว์แค่ `email_failed`
 * ซึ่งเป็น error ชั้นนอก ไล่ต่อไม่ได้) จึงต้องส่งสาเหตุกลับขึ้นไปให้ถึง response
 *
 * สาเหตุจาก Resend เป็นข้อความอธิบายปัญหา config (เช่น "domain is not verified",
 * "API key is invalid") ไม่มีการสะท้อนค่า key กลับมา จึงใส่ใน response ได้
 * — endpoint ที่เรียกเส้นทางนี้ต้องผ่านลายเซ็น Stripe หรือ token อยู่แล้ว
 */
async function sendResendEmail(
  apiKey: string,
  msg: {
    to: string;
    subject: string;
    html: string;
    attachments?: { filename: string; content: string }[];
  }
): Promise<string | null> {
  const { attachments, ...rest } = msg;
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
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
  } catch (e) {
    // fetch พังเอง (เครือข่าย/DNS) — ไม่มี response ให้อ่าน
    return `fetch_failed: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (res.ok) return null;
  // อ่าน body ให้ได้เท่าที่อ่านได้ แล้วตัดความยาวกัน response บวม
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 500);
  } catch {
    /* อ่านไม่ได้ก็ปล่อยว่าง — อย่างน้อยยังได้ status */
  }
  return `resend_${res.status}: ${detail}`;
}

/**
 * อ่านผ่าน PostgREST — คืน `null` เมื่ออ่านไม่ได้ (env ไม่ครบ / HTTP ไม่ ok / throw)
 *
 * ⚠️ `null` กลืนสาเหตุทิ้งเหมือนที่ `sendResendEmail` เคยทำ ผู้เรียกจึงแยกไม่ออกว่า
 * "ไม่มีสิทธิ์" กับ "ไม่มีข้อมูล" ต่างกันยังไง — ส่ง `diag` เข้ามาเพื่อรับสาเหตุกลับไปได้
 * (ใช้ตอนไล่บั๊กอีเมล delivery ไม่ออกบน production — 1 ส.ค. 2026)
 */
async function supabaseSelect<T>(
  env: EmailEnv,
  pathAndQuery: string,
  accessToken?: string,
  diag?: { detail?: string }
): Promise<T[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    // ระบุให้ชัดว่าตัวไหนหาย — บน Cloudflare Pages ทั้งคู่มาจาก NEXT_PUBLIC_*
    if (diag)
      diag.detail = `env_missing: url=${env.SUPABASE_URL ? "ok" : "MISSING"} anon=${env.SUPABASE_ANON_KEY ? "ok" : "MISSING"} token=${accessToken ? "ok" : "MISSING"}`;
    return null;
  }
  // 🔴 เลือก header ตาม**ชนิดของ token** ไม่ใช่ใส่ anon ใน apikey ตายตัว
  //
  // Supabase มี key สองรูปแบบ:
  //  - JWT (3 ส่วนคั่นด้วยจุด) = token ของผู้ใช้จริง → apikey=anon + Bearer=<jwt>
  //    ต้องเป็นแบบนี้เท่านั้น RLS จึงบังคับตามสิทธิ์ของผู้ใช้คนนั้น
  //  - ไม่ใช่ JWT = secret key แบบใหม่ (`sb_secret_...`) → ใส่ key ลง**ทั้งสอง** header
  //    เหมือนที่ `create_checkout_order_multi` ทำใน checkout-service.ts
  //
  // ⚠️ ห้ามใส่ secret key แบบใหม่ไว้ใน Bearer ขณะที่ apikey เป็น anon —
  //    gateway จะยึด role จาก apikey (=anon) แล้วส่ง Bearer ต่อให้ PostgREST
  //    ซึ่ง parse เป็น JWT ไม่ได้ → `PGRST301 Expected 3 parts in JWT; got 1`
  // ⚠️ และห้ามส่ง apikey อย่างเดียวเป็นสูตรกลาง — ใช้ได้กับ key แบบใหม่ แต่ key
  //    แบบเก่าจะตกไปเป็น role anon แล้วได้ `42501 permission denied`
  //
  // กับดักนี้ซ่อนตัวได้นานเพราะ `.env.local` เป็น key แบบเก่า แต่ Cloudflare Pages
  // เป็นแบบใหม่ → ทำงานได้ที่เครื่อง พังเฉพาะบน production (เจอจริง 1 ส.ค. 2026
  // ตอนอีเมล delivery ไม่ออก · RPC รอดเพราะบังเอิญใส่ key ไว้ทั้งสอง header อยู่แล้ว)
  const isJwt = !!accessToken && accessToken.split(".").length === 3;
  const headers: Record<string, string> =
    accessToken && !isJwt
      ? { apikey: accessToken, Authorization: `Bearer ${accessToken}` }
      : { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken ?? env.SUPABASE_ANON_KEY}` };

  let res: Response;
  try {
    res = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers });
  } catch (e) {
    if (diag) diag.detail = `fetch_failed: ${e instanceof Error ? e.message : String(e)}`;
    return null;
  }
  if (!res.ok) {
    if (diag) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
        /* อ่านไม่ได้ก็ยังได้ status */
      }
      diag.detail = `pgrst_${res.status}: ${body}`;
    }
    return null;
  }
  return (await res.json()) as T[];
}

/**
 * อ่านด้วยสิทธิ์ service role — ข้าม RLS ทั้งหมด
 * ใช้ได้เฉพาะฝั่ง server และเฉพาะกรณีที่ไม่มี JWT ของผู้ใช้ให้ยืมสิทธิ์
 * (ตอนนี้มีที่เดียวคือค้นอีเมล designer จากฟอร์ม quote สาธารณะ)
 * คืน null ถ้าไม่ได้ตั้ง key ไว้ — ผู้เรียกต้องจัดการกรณีนี้เอง ห้ามเงียบ
 *
 * ⚠️ เหมือน `supabaseSelect` — `null` กลืนสาเหตุทิ้ง ส่ง `diag` เข้ามาเพื่อรับสาเหตุจริงกลับไป
 */
async function supabaseSelectAsService<T>(
  env: EmailEnv,
  pathAndQuery: string,
  diag?: { detail?: string }
): Promise<T[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    if (diag)
      diag.detail = `env_missing: url=${env.SUPABASE_URL ? "ok" : "MISSING"} service_key=${env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "MISSING"}`;
    return null;
  }
  // 🔴 ใส่ key ลง**ทั้งสอง** header — สูตรเดียวกับ `supabaseSelect` (กรณี non-JWT) และ
  //    `create_checkout_order_multi` ใน checkout-service.ts · ใช้ได้กับ key ทั้งสองแบบ
  //
  // เดิมส่งเฉพาะ `apikey` โดยอ้างว่า gateway จะ synthesize Authorization ให้เอง —
  // **ผลทดสอบจริง (1 ส.ค. 2026) บอกว่าใช้ได้เฉพาะ secret key แบบใหม่ (`sb_secret_...`)**
  // ส่วน service_role แบบเดิมที่เป็น JWT จะตกไปเป็น role anon → `42501 permission denied`
  // ซึ่งแปลว่าเส้นทางนี้พังเงียบ ๆ ที่เครื่อง (`.env.local` เป็น key แบบเก่า) มาตลอด
  //
  // กติกาของ header: `apikey` → gateway อ่าน รับได้ทั้งสองแบบ ·
  //                  `Authorization: Bearer` → PostgREST อ่าน **รับ JWT เท่านั้น**
  // จึงต้องใส่ key เดียวกันทั้งคู่ ไม่ใช่ปน anon กับ service key คนละ header
  let res: Response;
  try {
    res = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
  } catch (e) {
    if (diag) diag.detail = `fetch_failed: ${e instanceof Error ? e.message : String(e)}`;
    return null;
  }
  if (!res.ok) {
    if (diag) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
        /* อ่านไม่ได้ก็ยังได้ status */
      }
      diag.detail = `pgrst_${res.status}: ${body}`;
    }
    return null;
  }
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

const STUDIO_CONTACT_EMAIL = CONTACT_EMAIL;

const STUDIO_FOOTER = `
<br>
<p style="color:#888;font-size:13px;border-top:1px solid #eee;padding-top:12px;margin-top:16px">
  ${LEGAL_ENTITY}<br>
  <a href="${SITE_URL}" style="color:#888">${SITE_URL.replace("https://", "")}</a><br>
  Mobile: 09-2929-9882<br>
  Email: <a href="mailto:${CONTACT_EMAIL}" style="color:#888">${CONTACT_EMAIL}</a>
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
<p><a href="${SITE_URL}/designer" style="background:#0a8a84;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">จัดการใบเสนอราคา →</a></p>
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
<p>ทีมงาน ${BRAND} ได้ตรวจสอบผลงานของคุณแล้ว และยินดีต้อนรับคุณเป็นส่วนหนึ่งของครอบครัวนักออกแบบฟอนต์ของเรา</p>
<p><strong>ขั้นตอนต่อไป:</strong><br>
• เข้าสู่ระบบที่ <a href="${SITE_URL}">${DOMAIN}</a><br>
• ไปที่ Dashboard → อัปโหลดฟอนต์ได้เลย<br>
• ตั้งราคาและรายละเอียดฟอนต์ของคุณ</p>
<p>หากมีคำถามสามารถติดต่อทีมงานได้ที่ <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a></p>
<p>ขอบคุณที่เลือก ${BRAND}</p>
${STUDIO_FOOTER}
`;
}

interface OrderRow {
  order_no: string;
  /** เลขที่ใบเสร็จของการขายรายชุด — ออกอัตโนมัติด้วยทริกเกอร์ใน 0075 · null สำหรับออเดอร์ที่มาจากใบเสนอราคา (เลขอยู่บน quotes) */
  receipt_no: string | null;
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
  receiptNo: string | null = null,
  /** null = ลูกค้าไม่ได้ขอใบแจ้งหนี้ → ห้ามเอ่ยถึงเลยทั้งฉบับ */
  invoiceNo: string | null = null
): string {
  const rows = order.items
    .map(
      (i) => `<tr>
  <td style="padding:6px 0">${escapeHtml(i.name ?? "")}<br><span style="color:#888;font-size:12px">สิทธิการใช้งาน : ${escapeHtml(licenseLabel(i.license_type))}</span></td>
  <td style="padding:6px 0;text-align:right;white-space:nowrap">฿${Number(i.price ?? 0).toLocaleString()}</td>
</tr>`
    )
    .join("");
  const discountRow =
    Number(order.discount) > 0
      ? `<tr><td style="padding:6px 0;color:#888">ส่วนลด</td><td style="padding:6px 0;text-align:right;white-space:nowrap;color:#c0392b">-฿${Number(order.discount).toLocaleString()}</td></tr>`
      : "";
  return `
<p>${greetingLine(order.customer_name)}</p>
<p>ขอบคุณสำหรับการสั่งซื้อ — เราได้รับการยืนยันการชำระเงินของคุณแล้ว<br>
เลขที่คำสั่งซื้อ <strong>${escapeHtml(order.order_no)}</strong>${
    // ขายรายชุดอ่านจาก orders.receipt_no · เส้นทางใบเสนอราคาเลขอยู่บน quotes จึงส่งมาทาง argument
    order.receipt_no || receiptNo
      ? `<br>เลขที่ใบเสร็จรับเงิน <strong>${escapeHtml(order.receipt_no || receiptNo || "")}</strong>`
      : ""
  }${invoiceNo ? `<br>เลขที่ใบแจ้งหนี้ <strong>${escapeHtml(invoiceNo)}</strong>` : ""}</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  ${rows}
  ${discountRow}
  <tr><td style="padding:8px 0;border-top:1px solid #eee;font-weight:bold">รวม</td><td style="padding:8px 0;border-top:1px solid #eee;text-align:right;font-weight:bold">฿${Number(order.total_amount).toLocaleString()}</td></tr>
</table>
<p><strong>ดาวน์โหลดไฟล์ฟอนต์:</strong><br>
เข้าสู่ระบบที่ ${DOMAIN} ด้วยอีเมลนี้ (${escapeHtml(order.customer_email)}) <br>แล้วไปที่หน้า "บัญชีของฉัน" โดยไฟล์ทั้งหมดอยู่ในส่วน "ดาวน์โหลดของฉัน" และดาวน์โหลดซ้ำได้ตลอด</p>
<p>หากยังไม่มีบัญชี สมัครสมาชิกด้วยอีเมลนี้ ระบบจะผูกสิทธิ์ให้อัตโนมัติ</p>
<p><br><a href="${SITE_URL}/account" style="background:#0a8a84;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">ไปที่หน้าดาวน์โหลด →</a><br><br></p>
${
  receiptNo
    ? `<p style="color:#555;font-size:13px">แนบ${
        invoiceNo
          ? `ใบแจ้งหนี้เลขที่ <strong>${escapeHtml(invoiceNo)}</strong> และ`
          : ""
      }ใบเสร็จรับเงินเลขที่ <strong>${escapeHtml(receiptNo)}</strong> มาพร้อมอีเมลฉบับนี้แล้ว</p>`
    : ""
}
${licensePdfUrl ? `<p>เอกสารข้อตกลงสิทธิ์การใช้งาน (License): <a href="${escapeHtml(licensePdfUrl)}">ดาวน์โหลด PDF</a></p>` : ""}
<p style="color:#888;font-size:13px">ไฟล์ฟอนต์ของคุณถูกประทับข้อมูลการซื้อ (เลขคำสั่งซื้อ) ไว้ในไฟล์ ตรวจสอบได้ที่ ${DOMAIN}/verify</p>
<br>
<p style="color:#888;font-size:13px;border-top:1px solid #eee;padding-top:12px;margin-top:16px">${escapeHtml(designerBrand)}<br>via ${DOMAIN}</p>
`;
}

interface DocumentQuoteFields {
  contact_name: string;
  company_name: string;
}

/** เอกสารที่ส่งทางอีเมลได้ — ตรงกับ `QuoteDocType` ใน `quote-doc.ts` */
type DocEmailType = "quotation" | "invoice" | "receipt";

function documentHtml(d: DocumentQuoteFields, docType: DocEmailType, docNo: string): string {
  const greetingName = d.contact_name || d.company_name;
  const contact = `<a href="mailto:${escapeHtml(STUDIO_CONTACT_EMAIL)}">${escapeHtml(STUDIO_CONTACT_EMAIL)}</a>`;
  const body =
    docType === "quotation"
      ? `<p>แนบใบเสนอราคาเลขที่ <strong>${escapeHtml(docNo)}</strong> ตามที่ท่านสอบถามเข้ามา กรุณาตรวจสอบรายละเอียดในไฟล์ที่แนบมาพร้อมนี้</p>
<p>หากมีข้อสงสัยหรือต้องการแก้ไขรายการ ติดต่อได้ที่ ${contact}</p>`
      : docType === "invoice"
      ? `<p>แนบใบแจ้งหนี้เลขที่ <strong>${escapeHtml(docNo)}</strong> ตามไฟล์ที่แนบมาพร้อมนี้ กรุณาตรวจสอบรายละเอียดและรายการบัญชีสำหรับการชำระเงิน</p>
<p>หากมีข้อสงสัยเกี่ยวกับใบแจ้งหนี้ ติดต่อได้ที่ ${contact}</p>`
      : `<p>ขอบคุณสำหรับการชำระเงิน แนบใบเสร็จรับเงินเลขที่ <strong>${escapeHtml(docNo)}</strong> ตามไฟล์ที่แนบมาพร้อมนี้</p>
<p>หากมีข้อสงสัยเกี่ยวกับใบเสร็จ ติดต่อได้ที่ ${contact}</p>`;
  return `
<p>${greetingLine(greetingName)}</p>
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
  let designer: DesignerInfo = { email: adminEmail, name: BRAND, brand: BRAND, phone: "" };
  const designerId = str(raw.designer_id, 40);
  if (designerId && UUID_RE.test(designerId)) {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      return { status: 500, body: { ok: false, error: "service_role_not_configured" } };
    }
    const diag: { detail?: string } = {};
    const rows = await supabaseSelectAsService<UserRow>(
      env,
      `users?id=eq.${designerId}&select=email,name,business_name,phone`,
      diag
    );
    const row = rows?.[0];
    if (!row?.email) {
      // แยกให้ออกว่าอ่านไม่ได้ (สิทธิ์/env) กับ "ไม่มี designer คนนี้จริง ๆ" —
      // เดิมยุบเป็น designer_not_found เหมือนกันหมด ไล่บั๊กไม่ได้
      const detail =
        diag.detail ??
        (rows === null
          ? "select_returned_null"
          : rows.length === 0
            ? `no_row_for_id=${designerId}`
            : "row_found_but_email_empty");
      return { status: 500, body: { ok: false, error: "designer_not_found", detail } };
    }
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
      subject: `ได้รับคำขอใบเสนอราคาของคุณแล้ว — ${d.company_name || BRAND}`,
      html: quoteConfirmHtml(d, designer),
    }),
  ]);
  const firstErr = results.find((e) => e !== null);
  if (firstErr) return { status: 502, body: { ok: false, error: "send_failed", detail: firstErr } };
  return { status: 200, body: { ok: true } };
}

// ── ติดต่อสอบถาม (ฟอร์มสาธารณะใน /contact) ─────────────────────────────────
// สาธารณะเหมือน quote → ต้องผ่าน Turnstile ก่อนเสมอ ไม่งั้นกลายเป็นช่องส่งสแปมฟรี
//
// ส่งเข้า ADMIN_EMAIL อย่างเดียว ไม่ส่งสำเนากลับหาผู้กรอก — ผู้กรอกยังไม่ได้ยืนยันตัวตน
// ว่าเป็นเจ้าของอีเมลนั้นจริง ถ้าส่งกลับด้วยจะถูกใช้ยิงเมลใส่คนอื่นผ่านโดเมนเรา
type ContactFields = { name: string; email: string; subject: string; message: string };

function contactHtml(d: ContactFields): string {
  return `
<p><strong>ข้อความติดต่อใหม่จากเว็บไซต์</strong></p>
<p>
  <strong>ชื่อผู้ติดต่อ:</strong> ${escapeHtml(d.name)}<br />
  <strong>อีเมล:</strong> ${escapeHtml(d.email)}<br />
  <strong>เรื่อง:</strong> ${escapeHtml(d.subject || "—")}
</p>
<p><strong>ข้อความ</strong><br />${escapeHtml(d.message).replace(/\n/g, "<br />")}</p>
${STUDIO_FOOTER}
`;
}

async function handleContact(
  raw: Record<string, unknown>,
  turnstileToken: string,
  ip: string | null | undefined,
  env: EmailEnv
): Promise<EmailResult> {
  if (!(await verifyTurnstile(env, turnstileToken, ip))) {
    return { status: 403, body: { ok: false, error: "turnstile_failed" } };
  }

  const d: ContactFields = {
    name: str(raw.name, 200),
    email: str(raw.email, 254),
    subject: str(raw.subject, 200),
    message: str(raw.message, 5000),
  };
  if (!d.name || !d.message || !EMAIL_RE.test(d.email)) {
    return { status: 400, body: { ok: false, error: "invalid_payload" } };
  }

  const adminEmail = env.ADMIN_EMAIL ?? "";
  if (!adminEmail) return { status: 500, body: { ok: false, error: "no_recipient" } };
  if (!env.RESEND_API_KEY) return { status: 500, body: { ok: false, error: "email_not_configured" } };

  const sendErr = await sendResendEmail(env.RESEND_API_KEY, {
    to: adminEmail,
    subject: `ติดต่อสอบถาม — ${d.subject || d.name}`,
    html: contactHtml(d),
  });
  if (sendErr) return { status: 502, body: { ok: false, error: "send_failed", detail: sendErr } };
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

  const sendErr = await sendResendEmail(env.RESEND_API_KEY, {
    to: target.email,
    subject: "ยินดีด้วย! บัญชี Designer ของคุณได้รับการอนุมัติแล้ว",
    html: promoteHtml(target.name ?? target.email, env.ADMIN_EMAIL ?? ""),
  });
  if (sendErr) return { status: 502, body: { ok: false, error: "send_failed", detail: sendErr } };
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

  // ไฟล์แนบ (ใบเสร็จ + ใบแจ้งหนี้ถ้าลูกค้าขอ) — ออปชันนัล ไม่มีก็ยังส่งอีเมลได้ตามปกติ
  // เส้นทางซื้อรายชุดผ่าน Stripe (checkout-service) ส่งมาแค่ order_id ไม่มีไฟล์แนบ
  const receiptNo = str(raw.receipt_no, 40);
  const invoiceNo = str(raw.invoice_no, 40);

  const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  let attachments: { filename: string; content: string }[] | undefined;
  if (rawAttachments.length > 0) {
    // ⚠️ เพดานขนาดต้องนับ "รวมทุกไฟล์" — เช็คทีละไฟล์แล้วสองไฟล์จะทะลุได้เท่าตัว
    if (rawAttachments.length > MAX_ATTACHMENTS) {
      return { status: 400, body: { ok: false, error: "invalid_attachment" } };
    }
    const list: { filename: string; content: string }[] = [];
    let totalLen = 0;
    for (const item of rawAttachments) {
      const a = (item ?? {}) as Record<string, unknown>;
      const name = str(a.filename, 200);
      const content = typeof a.pdf_base64 === "string" ? a.pdf_base64.trim() : "";
      totalLen += content.length;
      if (!content || !PDF_FILENAME_RE.test(name) || !BASE64_RE.test(content)) {
        return { status: 400, body: { ok: false, error: "invalid_attachment" } };
      }
      list.push({ filename: name, content });
    }
    if (totalLen > PDF_BASE64_MAX_LEN) {
      return { status: 400, body: { ok: false, error: "invalid_attachment" } };
    }
    attachments = list;
  }

  // อ่าน order ด้วย token ของผู้เรียก — RLS บังคับให้เห็นเฉพาะ order ของตัวเอง
  // (designer เจ้าของ / admin) จึงยิงอีเมลแทน order คนอื่นไม่ได้
  const diag: { detail?: string } = {};
  const orders = await supabaseSelect<OrderRow>(
    env,
    `orders?id=eq.${orderId}&select=order_no,receipt_no,customer_email,customer_name,designer_id,items,total_amount,discount,paid_at`,
    authToken,
    diag
  );
  const order = orders?.[0];
  if (!order?.customer_email) {
    // แยกให้ออกว่าอ่านไม่ได้ (diag.detail) / อ่านได้แต่ไม่เจอแถว / เจอแถวแต่ไม่มีอีเมล
    const detail =
      diag.detail ??
      (orders === null
        ? "select_returned_null"
        : orders.length === 0
          ? `no_row_for_id=${orderId}`
          : "row_found_but_customer_email_empty");
    return { status: 404, body: { ok: false, error: "order_not_found", detail } };
  }
  if (!env.RESEND_API_KEY) return { status: 500, body: { ok: false, error: "email_not_configured" } };

  let brand = BRAND;
  let licensePdfUrl: string | null = null;
  if (order.designer_id) {
    const [users, configs] = await Promise.all([
      supabaseSelect<UserRow>(env, `users?id=eq.${order.designer_id}&select=email,name,business_name,phone`, authToken),
      // ต้องดึง use_default มาด้วย — ดีไซน์เนอร์ที่เคยตั้งสัญญาเองแล้วกลับไปใช้ฉบับกลาง
      // ยังมี license_pdf_url ค้างอยู่ในแถว (เก็บไว้ให้ดึงกลับมาได้ ดู OwnPricing.save)
      // อ่านคอลัมน์เดียวจะส่งลิงก์ฉบับที่เลิกใช้แล้วไปให้ลูกค้า
      supabaseSelect<{ use_default: boolean; license_pdf_url: string | null }>(
        env,
        `designer_license_config?designer_id=eq.${order.designer_id}&select=use_default,license_pdf_url`,
        authToken
      ),
    ]);
    const u = users?.[0];
    if (u) brand = u.business_name ?? u.name ?? brand;
    licensePdfUrl = designerLicensePdf(configs?.[0]);
  }

  const sendErr = await sendResendEmail(env.RESEND_API_KEY, {
    to: order.customer_email,
    subject: `คำสั่งซื้อ ${order.order_no} สำเร็จ — ดาวน์โหลดฟอนต์ของคุณได้แล้ว`,
    html: deliveryHtml(order, brand, licensePdfUrl, receiptNo || null, invoiceNo || null),
    ...(attachments ? { attachments } : {}),
  });
  if (sendErr) return { status: 502, body: { ok: false, error: "send_failed", detail: sendErr } };
  return { status: 200, body: { ok: true } };
}

type QuoteRow = {
  email: string | null;
  contact_name: string | null;
  company_name: string | null;
  quote_no: string | null;
  receipt_no: string | null;
  invoice_no: string | null;
};

async function handleDocument(
  raw: Record<string, unknown>,
  authToken: string | null | undefined,
  env: EmailEnv
): Promise<EmailResult> {
  if (!authToken) return { status: 401, body: { ok: false, error: "unauthorized" } };

  const quoteId = str(raw.quote_id, 40);
  const docTypeRaw = str(raw.doc_type, 20);
  const filename = str(raw.filename, 200);
  const pdfBase64 = typeof raw.pdf_base64 === "string" ? raw.pdf_base64.trim() : "";

  if (!UUID_RE.test(quoteId)) return { status: 400, body: { ok: false, error: "invalid_payload" } };
  if (docTypeRaw !== "quotation" && docTypeRaw !== "invoice" && docTypeRaw !== "receipt") {
    return { status: 400, body: { ok: false, error: "invalid_payload" } };
  }
  const docType = docTypeRaw as DocEmailType;
  if (!PDF_FILENAME_RE.test(filename)) return { status: 400, body: { ok: false, error: "invalid_filename" } };
  if (!pdfBase64) return { status: 400, body: { ok: false, error: "invalid_payload" } };
  if (pdfBase64.length > PDF_BASE64_MAX_LEN) return { status: 400, body: { ok: false, error: "file_too_large" } };
  if (!BASE64_RE.test(pdfBase64)) return { status: 400, body: { ok: false, error: "invalid_payload" } };

  // อ่าน quote ด้วย token ของผู้เรียก — RLS บังคับให้เห็นเฉพาะ quote ของตัวเอง
  // (admin ทุกใบ / designer เฉพาะ designer_id = auth.uid()) จึงยิงอีเมลแทน quote คนอื่นไม่ได้
  // ต้องรับ designer ด้วย เพราะ 0039 ให้ designer เจ้าของออกเอกสารเองได้ (เหมือน handleDelivery)
  const quotes = await supabaseSelect<QuoteRow>(
    env,
    `quotes?id=eq.${quoteId}&select=email,contact_name,company_name,quote_no,receipt_no,invoice_no`,
    authToken
  );
  const quote = quotes?.[0];
  if (!quote?.email) return { status: 404, body: { ok: false, error: "quote_not_found" } };

  // เอกสารต้องออกเลขที่แล้วก่อนถึงจะส่งได้
  const docNo =
    docType === "quotation"
      ? quote.quote_no
      : docType === "invoice"
      ? quote.invoice_no
      : quote.receipt_no;
  if (!docNo) return { status: 400, body: { ok: false, error: "doc_not_issued" } };

  if (!env.RESEND_API_KEY) return { status: 500, body: { ok: false, error: "email_not_configured" } };

  const DOC_SUBJECT: Record<DocEmailType, string> = {
    quotation: "ใบเสนอราคา",
    invoice: "ใบแจ้งหนี้",
    receipt: "ใบเสร็จรับเงิน",
  };
  const subject = `${DOC_SUBJECT[docType]} ${docNo} — ${BRAND}`;

  const sendErr = await sendResendEmail(env.RESEND_API_KEY, {
    to: quote.email,
    subject,
    html: documentHtml(
      { contact_name: quote.contact_name ?? "", company_name: quote.company_name ?? "" },
      docType,
      docNo
    ),
    attachments: [{ filename, content: pdfBase64 }],
  });
  if (sendErr) return { status: 502, body: { ok: false, error: "send_failed", detail: sendErr } };
  return { status: 200, body: { ok: true } };
}

// ── Payout confirmation ─────────────────────────────────────────────────────

function payoutHtml(d: {
  designerName: string;
  periodLabel: string;
  totalAmount: string;
  b2cAmount: string;
  subscriptionAmount: string;
  note: string;
}): string {
  return `
<p>สวัสดี คุณ ${escapeHtml(d.designerName)},</p>
<p>เราได้โอนส่วนแบ่งรายได้งวด <strong>${escapeHtml(d.periodLabel)}</strong> ให้คุณเรียบร้อยแล้ว</p>
<table style="border-collapse:collapse;width:100%;max-width:420px">
  <tr><td style="padding:6px 0;color:#888;width:220px">ส่วนแบ่งจากการขายผ่านเว็บ</td><td style="padding:6px 0;text-align:right">${escapeHtml(d.b2cAmount)}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ส่วนแบ่ง Subscription</td><td style="padding:6px 0;text-align:right">${escapeHtml(d.subscriptionAmount)}</td></tr>
  <tr><td style="padding:10px 0;border-top:1px solid #eee"><strong>ยอดโอนรวม</strong></td><td style="padding:10px 0;border-top:1px solid #eee;text-align:right"><strong>${escapeHtml(d.totalAmount)}</strong></td></tr>
</table>
${d.note ? `<p style="color:#888;font-size:13px">หมายเหตุ: ${escapeHtml(d.note)}</p>` : ""}
<p>รายละเอียดฉบับเต็มอยู่ในไฟล์ PDF ที่แนบมากับอีเมลนี้ และดูสรุปรายได้ย้อนหลังได้ที่หน้า
<a href="${SITE_URL}/designer/revenue">รายได้</a> ใน dashboard ของคุณ</p>
<p>หากยอดไม่ตรงหรือมีคำถาม ตอบกลับอีเมลนี้ได้เลย</p>
${STUDIO_FOOTER}
`;
}

/**
 * อีเมลยืนยันการโอนส่วนแบ่ง (admin กดหลังโอนเงินจริงแล้ว) พร้อมแนบ PDF ใบสรุป
 *
 * ต่างจาก handleDocument ตรงที่ตรวจสิทธิ์ตรง ๆ ว่าผู้เรียกเป็น admin — ไม่มี RLS
 * ของ quote มาคุมให้เหมือนเคสนั้น (อ่านอีเมลของ designer คนอื่นได้ต้องเป็น admin)
 */
async function handlePayout(
  raw: Record<string, unknown>,
  authToken: string | null | undefined,
  env: EmailEnv
): Promise<EmailResult> {
  if (!authToken) return { status: 401, body: { ok: false, error: "unauthorized" } };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { status: 500, body: { ok: false, error: "not_configured" } };
  }

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

  const designerId = str(raw.designer_id, 40);
  if (!UUID_RE.test(designerId)) return { status: 400, body: { ok: false, error: "invalid_payload" } };

  const periodLabel = str(raw.period_label, 80);
  const totalAmount = str(raw.total_amount, 40);
  if (!periodLabel || !totalAmount) return { status: 400, body: { ok: false, error: "invalid_payload" } };

  // ไฟล์แนบเป็นออปชันนัล — สร้าง PDF ไม่สำเร็จก็ยังต้องแจ้ง designer ได้
  const pdfBase64 = typeof raw.pdf_base64 === "string" ? raw.pdf_base64.trim() : "";
  const filename = str(raw.filename, 200);
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

  const rows = await supabaseSelect<UserRow>(
    env,
    `users?id=eq.${designerId}&select=email,name,business_name,phone`,
    authToken
  );
  const target = rows?.[0];
  if (!target?.email) return { status: 404, body: { ok: false, error: "designer_not_found" } };
  if (!env.RESEND_API_KEY) return { status: 500, body: { ok: false, error: "email_not_configured" } };

  const sendErr = await sendResendEmail(env.RESEND_API_KEY, {
    to: target.email,
    subject: `ยืนยันการโอนส่วนแบ่ง ${periodLabel} — ${BRAND}`,
    html: payoutHtml({
      designerName: target.business_name ?? target.name ?? target.email,
      periodLabel,
      totalAmount,
      b2cAmount: str(raw.b2c_amount, 40) || "฿0",
      subscriptionAmount: str(raw.subscription_amount, 40) || "฿0",
      note: str(raw.note, 300),
    }),
    attachments,
  });
  if (sendErr) return { status: 502, body: { ok: false, error: "send_failed", detail: sendErr } };
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
    if (body.type === "contact") {
      return await handleContact(payload, str(body.turnstile_token, 3000), ctx.ip, env);
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
    if (body.type === "payout") {
      return await handlePayout(payload, ctx.authToken, env);
    }
    return { status: 400, body: { ok: false, error: "unknown_type" } };
  } catch {
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}
