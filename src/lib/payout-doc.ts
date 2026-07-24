/**
 * ใบสรุปการโอนส่วนแบ่งรายได้ (PDF) — แนบไปกับอีเมลยืนยันการโอนให้ designer
 *
 * ⚠️ เลย์เอาต์ยัง **ไม่ใช่ตัวจริง** — เจ้าของจะส่งตัวอย่างเอกสารมาให้ทีหลัง
 * ตอนนี้ทำให้ท่อทั้งเส้นทำงานได้ก่อน (ข้อมูล → Uint8Array → base64 → แนบอีเมล)
 * ตอนได้ตัวอย่างจริงให้แก้เฉพาะส่วนวาดในไฟล์นี้ที่เดียว โครง/ผู้เรียกไม่ต้องแตะ
 * ฟิลด์ที่ยังไม่เคาะ: เลขที่เอกสาร, ภาษีหัก ณ ที่จ่าย, ลายเซ็น/ตราประทับ
 *
 * โหลดฟอนต์ไทยแบบเดียวกับ quote-doc.ts (pdf-lib + fontkit ไม่มีฟอนต์ไทยในตัว)
 */

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type PayoutDocData = {
  designerName: string;
  periodLabel: string; // เช่น "ไตรมาส 3/2569 (ก.ค.–ก.ย.)"
  paidAt: string; // ISO
  b2cAmount: number; // ส่วนแบ่งจากการขายผ่านเว็บ
  subscriptionAmount: number; // ส่วนแบ่ง subscription
  totalAmount: number; // ยอดที่โอนจริง
  note?: string | null;
  bank?: { bank_name?: string; account_name?: string; account_number?: string } | null;
};

const MM = 2.8346456693;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 25 * MM;

const COLOR = {
  navy: rgb(0x2b / 255, 0x1b / 255, 0x3d / 255),
  gray555: rgb(0x55 / 255, 0x55 / 255, 0x55 / 255),
  black: rgb(0.07, 0.07, 0.07),
};

let regularFontPromise: Promise<ArrayBuffer> | null = null;
let boldFontPromise: Promise<ArrayBuffer> | null = null;

function fetchFont(url: string): Promise<ArrayBuffer> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load font "${url}": ${res.status}`);
    return res.arrayBuffer();
  });
}

async function getFontBytes(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (!regularFontPromise) regularFontPromise = fetchFont("/fonts/pdf/NotoSansThai-Regular.ttf");
  if (!boldFontPromise) boldFontPromise = fetchFont("/fonts/pdf/NotoSansThai-Bold.ttf");
  try {
    const [regular, bold] = await Promise.all([regularFontPromise, boldFontPromise]);
    return { regular, bold };
  } catch (err) {
    // อย่า cache promise ที่ fail — ไม่งั้น retry เจอ error เดิมจนกว่าจะ reload
    regularFontPromise = null;
    boldFontPromise = null;
    throw err;
  }
}

const baht = (n: number) =>
  "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generatePayoutPdf(data: PayoutDocData): Promise<Uint8Array> {
  const { regular, bold } = await getFontBytes();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontRegular = await pdf.embedFont(regular, { subset: true });
  const fontBold = await pdf.embedFont(bold, { subset: true });
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  let y = PAGE_H - 28 * MM;
  const line = (text: string, opts?: { size?: number; boldText?: boolean; color?: typeof COLOR.black; gap?: number }) => {
    const size = opts?.size ?? 11;
    page.drawText(text, {
      x: MARGIN_X,
      y,
      size,
      font: opts?.boldText ? fontBold : fontRegular,
      color: opts?.color ?? COLOR.black,
    });
    y -= opts?.gap ?? size * 1.8;
  };
  const row = (label: string, value: string, boldRow = false) => {
    const size = boldRow ? 13 : 11;
    const font = boldRow ? fontBold : fontRegular;
    page.drawText(label, { x: MARGIN_X, y, size, font: fontRegular, color: COLOR.gray555 });
    const w = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: PAGE_W - MARGIN_X - w, y, size, font, color: COLOR.black });
    y -= size * 2;
  };

  line("DHAMMADHA STUDIO", { size: 12, boldText: true, color: COLOR.navy, gap: 26 });
  line("ใบสรุปการโอนส่วนแบ่งรายได้", { size: 18, boldText: true, color: COLOR.navy, gap: 34 });

  row("ผู้รับ", data.designerName);
  row("งวด", data.periodLabel);
  row("วันที่โอน", new Date(data.paidAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }));
  y -= 10;

  row("ส่วนแบ่งจากการขายผ่านเว็บ", baht(data.b2cAmount));
  row("ส่วนแบ่ง Subscription", baht(data.subscriptionAmount));
  y -= 6;
  row("ยอดโอนรวม", baht(data.totalAmount), true);

  if (data.bank?.bank_name || data.bank?.account_number) {
    y -= 14;
    line("บัญชีที่รับโอน", { size: 11, boldText: true, color: COLOR.navy });
    line(
      [data.bank?.bank_name, data.bank?.account_name, data.bank?.account_number]
        .filter(Boolean)
        .join(" · "),
      { size: 11, color: COLOR.gray555 }
    );
  }

  if (data.note) {
    y -= 10;
    line("หมายเหตุ: " + data.note, { size: 11, color: COLOR.gray555 });
  }

  return pdf.save();
}
