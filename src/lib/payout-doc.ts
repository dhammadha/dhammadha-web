/**
 * ใบสรุปการโอนส่วนแบ่งรายได้ (PDF) — แนบไปกับอีเมลยืนยันการโอนให้ designer
 *
 * ใช้เลย์เอาต์ชุดเดียวกับใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ (ดู `doc-layout.ts`)
 * ต่างกันแค่ผู้ออกเอกสารและเนื้อในตาราง:
 *  - ใบเสนอราคา/ใบเสร็จ  ออกในนาม **designer เจ้าของฟอนต์** (อ่านจากแถว users)
 *  - ใบนี้                ออกในนาม **แพลตฟอร์ม** ซึ่งเป็นผู้จ่ายเงินให้ designer
 *    จึงอ่านหัวเอกสารจากค่าคงที่ใน `brand.ts` (ฝั่ง admin ไม่มีหน้าตั้งค่าข้อมูลธุรกิจ)
 *
 * ⚠️ ยังไม่เคาะ: เลขที่เอกสาร (ตอนนี้ไม่มี), ภาษีหัก ณ ที่จ่าย, ตราประทับ
 */

import {
  CONTENT_RIGHT,
  COLOR,
  DocWriter,
  LINE,
  MARGIN_X,
  SZ,
  drawIssuerHeader,
  drawLabelValue,
  drawSignature,
  drawTitleRow,
  drawTotalBar,
  loadDocFonts,
  money,
  type DocFontBytes,
} from "./doc-layout";
import { bahtText } from "./baht-text";
import {
  LEGAL_ENTITY,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_EMAIL,
  LEGAL_ENTITY_OPERATOR,
  LEGAL_ENTITY_PHONE,
  LEGAL_ENTITY_TAX_ID,
} from "./brand";

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

/** ผู้ออกเอกสาร = แพลตฟอร์ม */
const PLATFORM_ISSUER = {
  business_name: LEGAL_ENTITY,
  name: LEGAL_ENTITY_OPERATOR,
  tax_id: LEGAL_ENTITY_TAX_ID,
  address: LEGAL_ENTITY_ADDRESS,
  phone: LEGAL_ENTITY_PHONE,
  email: LEGAL_ENTITY_EMAIL,
};

const COL_PAD = 12;

export async function generatePayoutPdf(
  data: PayoutDocData,
  fonts?: DocFontBytes,
): Promise<Uint8Array> {
  const w = await DocWriter.create(fonts ?? (await loadDocFonts()));

  const paidDate = new Date(data.paidAt).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  drawIssuerHeader(w, PLATFORM_ISSUER);
  drawTitleRow(w, "ใบสรุปการโอนส่วนแบ่งรายได้", [
    ["งวด", data.periodLabel],
    ["วันที่โอน", paidDate],
  ]);

  /* ── ผู้รับเงิน ────────────────────────────────────────────────────────── */
  w.text(data.designerName, { size: SZ.body, bold: true, color: COLOR.black });
  w.space(14);

  /* ── ตารางรายการ ──────────────────────────────────────────────────────── */
  const rows: Array<[string, number]> = [
    ["ส่วนแบ่งจากการขายผ่านเว็บ", data.b2cAmount],
    ["ส่วนแบ่ง Subscription", data.subscriptionAmount],
  ];

  const headerH = SZ.body * 2.4;
  const padTop = (headerH - SZ.body * 1.2) / 2;
  const top = w.bar(headerH, COLOR.navy, padTop);
  w.textAt("รายละเอียด", top, { x: MARGIN_X + COL_PAD, size: SZ.body, bold: true, color: COLOR.white });
  w.textAt("จำนวนเงิน", top, {
    align: "right",
    right: CONTENT_RIGHT - COL_PAD,
    size: SZ.body,
    bold: true,
    color: COLOR.white,
  });
  w.space(12);

  const rowH = SZ.itemName * LINE + 6;
  for (const [label, amount] of rows) {
    w.ensureSpace(rowH);
    const rowTop = w.y;
    w.textAt(label, rowTop, { x: MARGIN_X + COL_PAD, size: SZ.itemName, color: COLOR.black });
    w.textAt(money(amount), rowTop, {
      align: "right",
      right: CONTENT_RIGHT - COL_PAD,
      size: SZ.itemName,
      color: COLOR.black,
    });
    w.y -= rowH;
  }

  w.space(4);
  w.rule(0.8, COLOR.gray555);
  w.space(10);
  drawTotalBar(w, "ยอดโอนรวม", money(data.totalAmount), bahtText(data.totalAmount));

  /* ── บัญชีที่รับโอน ────────────────────────────────────────────────────── */
  const bank = data.bank;
  if (bank?.bank_name || bank?.account_name || bank?.account_number) {
    const bankRows: Array<[string, string]> = [];
    if (bank.bank_name) bankRows.push(["บัญชี", bank.bank_name]);
    if (bank.account_name) bankRows.push(["ชื่อบัญชี", bank.account_name]);
    if (bank.account_number) bankRows.push(["เลขที่บัญชี", bank.account_number]);

    w.space(20);
    w.text("บัญชีที่รับโอน", { size: SZ.bodyLabel, bold: true, color: COLOR.black });
    const labelW = Math.max(...bankRows.map(([l]) => w.widthOf(l, SZ.body, true))) + 16;
    for (const [label, value] of bankRows) drawLabelValue(w, label, value, labelW);
  }

  if (data.note) {
    w.space(14);
    w.text(`หมายเหตุ: ${data.note}`, {
      size: SZ.itemSub,
      color: COLOR.gray555,
      maxWidth: CONTENT_RIGHT - MARGIN_X,
    });
  }

  drawSignature(w, LEGAL_ENTITY_OPERATOR, "ผู้จ่ายเงิน");

  return w.save();
}
