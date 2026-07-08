import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "DHAMMADHA STUDIO <noreply@dhammadha.com>";
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "dhammadha@outlook.com";

// ── Email HTML builders ─────────────────────────────────────────────────────

function quoteNotifyHtml(d: QuotePayload) {
  return `
<p>สวัสดี ${d.designer_name},</p>
<p>มีคำขอใบเสนอราคาใหม่เข้ามาในระบบ</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 0;color:#888;width:140px">ชื่อผู้ติดต่อ</td><td style="padding:6px 0">${d.contact_name}</td></tr>
  <tr><td style="padding:6px 0;color:#888">บริษัท</td><td style="padding:6px 0">${d.company_name || "—"}</td></tr>
  <tr><td style="padding:6px 0;color:#888">อีเมล</td><td style="padding:6px 0">${d.email}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ฟอนต์</td><td style="padding:6px 0">${d.fonts}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ประเภทลิขสิทธิ์</td><td style="padding:6px 0">${d.license_type}</td></tr>
  ${d.note && d.note !== "—" ? `<tr><td style="padding:6px 0;color:#888">หมายเหตุ</td><td style="padding:6px 0">${d.note}</td></tr>` : ""}
</table>
<br>
<p style="color:#888;font-size:13px">— DHAMMADHA STUDIO</p>
`;
}

function quoteConfirmHtml(d: QuotePayload) {
  return `
<p>สวัสดี ${d.contact_name},</p>
<p>เราได้รับคำขอใบเสนอราคาของคุณเรียบร้อยแล้ว ทีมงานจะติดต่อกลับโดยเร็วที่สุด</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 0;color:#888;width:140px">ฟอนต์</td><td style="padding:6px 0">${d.fonts}</td></tr>
  <tr><td style="padding:6px 0;color:#888">ประเภทลิขสิทธิ์</td><td style="padding:6px 0">${d.license_type}</td></tr>
</table>
<br>
<p>ขอบคุณที่สนใจ DHAMMADHA STUDIO</p>
<p style="color:#888;font-size:13px">— ทีมงาน DHAMMADHA STUDIO</p>
`;
}

function promoteHtml(d: PromotePayload) {
  return `
<p>สวัสดี ${d.designer_name},</p>
<p>ทีมงาน DHAMMADHA STUDIO ได้ตรวจสอบผลงานของคุณแล้ว และยินดีต้อนรับคุณเป็นส่วนหนึ่งของครอบครัวนักออกแบบฟอนต์ของเรา</p>
<p><strong>ขั้นตอนต่อไป:</strong></p>
<ul>
  <li>เข้าสู่ระบบที่ <a href="https://dhammadha.com">dhammadha.com</a></li>
  <li>ไปที่ Dashboard → อัปโหลดฟอนต์ได้เลย</li>
  <li>ตั้งราคาและรายละเอียดฟอนต์ของคุณ</li>
</ul>
<p>หากมีคำถามสามารถติดต่อทีมงานได้ที่ <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a></p>
<br>
<p>ขอบคุณที่เลือก DHAMMADHA STUDIO<br>
<span style="color:#888;font-size:13px">ทีมงาน DHAMMADHA STUDIO</span></p>
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
  const body: EmailRequest = await req.json();

  try {
    if (body.type === "quote") {
      const d = body.payload;
      await Promise.all([
        resend.emails.send({
          from: FROM,
          to: d.designer_email,
          subject: `คำขอใบเสนอราคาใหม่ — ${d.fonts}`,
          html: quoteNotifyHtml(d),
        }),
        resend.emails.send({
          from: FROM,
          to: d.email,
          subject: "ได้รับคำขอใบเสนอราคาของคุณแล้ว — DHAMMADHA STUDIO",
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
