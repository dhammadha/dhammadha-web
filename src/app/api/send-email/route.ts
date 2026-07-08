import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const FROM = "DHAMMADHA STUDIO <noreply@dhammadha.com>";
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "dhammadha@outlook.com";

// ── Email HTML builders ─────────────────────────────────────────────────────

const FOOTER = `
<br>
<p style="color:#888;font-size:13px;border-top:1px solid #eee;padding-top:12px;margin-top:16px">
  ธรรมดาสตูดิโอ<br>
  <a href="https://www.dhammadha.com" style="color:#888">www.dhammadha.com</a><br>
  Mobile: 09-2929-9882<br>
  Line: @dhammadha
</p>
`;

function quoteNotifyHtml(d: QuotePayload) {
  return `
<p>คุณได้รับคำขอใบเสนอราคาใหม่</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 0;color:#888;width:160px">ชื่อผู้ติดต่อ</td><td style="padding:6px 0">${d.contact_name}</td></tr>
  <tr><td style="padding:6px 0;color:#888">บริษัท</td><td style="padding:6px 0">${d.company_name || "—"}</td></tr>
  <tr><td style="padding:6px 0;color:#888">อีเมล</td><td style="padding:6px 0">${d.email}</td></tr>
  <tr><td style="padding:6px 0;color:#888">เลขประจำตัวผู้เสียภาษี</td><td style="padding:6px 0">${d.tax_id || "—"}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ที่อยู่</td><td style="padding:6px 0">${d.address || "—"}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ประเภทสิทธิ์</td><td style="padding:6px 0">${d.license_type}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ฟอนต์ที่ต้องการ</td><td style="padding:6px 0">${d.fonts}</td></tr>
  ${d.note && d.note !== "—" ? `<tr><td style="padding:6px 0;color:#888">หมายเหตุ</td><td style="padding:6px 0">${d.note}</td></tr>` : ""}
</table>
<br>
<p><a href="https://dhammadha.com/designer" style="background:#0a8a84;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">จัดการใบเสนอราคา →</a></p>
${FOOTER}
`;
}

function quoteConfirmHtml(d: QuotePayload) {
  const designerFooter = `
<br>
<p style="color:#888;font-size:13px;border-top:1px solid #eee;padding-top:12px;margin-top:16px">
  ${d.designer_brand}<br>
  ${d.designer_email ? `<a href="mailto:${d.designer_email}" style="color:#888">${d.designer_email}</a><br>` : ""}
  ${d.designer_phone ? `Mobile: ${d.designer_phone}` : ""}
</p>
`;
  return `
<p>เรียน คุณ ${d.contact_name}</p>
<p>เราได้รับคำขอใบเสนอราคาของคุณแล้ว และจะติดต่อกลับภายใน 1-2 วันทำการ</p>
<p><strong>รายละเอียดคำขอ:</strong></p>
<p>
  - ฟอนต์: ${d.fonts}<br>
  - ประเภทสิทธิ์: ${d.license_type}<br>
  ${d.note && d.note !== "—" ? `- หมายเหตุ: ${d.note}` : ""}
</p>
<p>หากมีคำถามเพิ่มเติม ติดต่อได้ที่ <a href="mailto:${d.designer_email}">${d.designer_email}</a></p>
<p>ขอบคุณมากครับ</p>
${designerFooter}
`;
}

function promoteHtml(d: PromotePayload) {
  return `
<p>สวัสดี คุณ ${d.designer_name},</p>
<p>ทีมงาน DHAMMADHA STUDIO ได้ตรวจสอบผลงานของคุณแล้ว และยินดีต้อนรับคุณเป็นส่วนหนึ่งของครอบครัวนักออกแบบฟอนต์ของเรา</p>
<p><strong>ขั้นตอนต่อไป:</strong><br>
• เข้าสู่ระบบที่ <a href="https://dhammadha.com">dhammadha.com</a><br>
• ไปที่ Dashboard → อัปโหลดฟอนต์ได้เลย<br>
• ตั้งราคาและรายละเอียดฟอนต์ของคุณ</p>
<p>หากมีคำถามสามารถติดต่อทีมงานได้ที่ <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a></p>
<p>ขอบคุณที่เลือก DHAMMADHA STUDIO</p>
${FOOTER}
`;
}

// ── Types ───────────────────────────────────────────────────────────────────

type QuotePayload = {
  contact_name: string;
  company_name: string;
  email: string;
  tax_id: string;
  address: string;
  license_type: string;
  fonts: string;
  note: string;
  designer_name: string;
  designer_email: string;
  designer_phone: string;
  designer_brand: string;
};

type PromotePayload = {
  designer_name: string;
  designer_email: string;
};

type EmailRequest =
  | { type: "quote"; payload: QuotePayload }
  | { type: "promote"; payload: PromotePayload };

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const body: EmailRequest = await req.json();

  try {
    if (body.type === "quote") {
      const d = body.payload;
      await Promise.all([
        resend.emails.send({
          from: FROM,
          to: d.designer_email,
          subject: `คำขอใบเสนอราคาใหม่ — ฟอนต์ ${d.fonts}`,
          html: quoteNotifyHtml(d),
        }),
        resend.emails.send({
          from: FROM,
          to: d.email,
          subject: `ได้รับคำขอใบเสนอราคาของคุณแล้ว — ${d.company_name || "DHAMMADHA STUDIO"}`,
          html: quoteConfirmHtml(d),
        }),
      ]);
    } else if (body.type === "promote") {
      const d = body.payload;
      await resend.emails.send({
        from: FROM,
        to: d.designer_email,
        subject: "ยินดีด้วย! บัญชี Designer ของคุณได้รับการอนุมัติแล้ว",
        html: promoteHtml(d),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("send-email error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
