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
  CONTENT_W,
  COLOR,
  DocWriter,
  LEAD,
  M,
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
  // ไม่มีบล็อกเลขที่/วันที่ทางขวาแบบใบเสนอราคา — ใบนี้ยังไม่มีเลขที่เอกสาร
  // และงวด/วันที่โอนอยู่ใต้ชื่อผู้รับแทน (ดูบล็อกถัดไป)
  drawTitleRow(w, "ใบสรุปการโอนส่วนแบ่งรายได้", []);

  /* ── ผู้รับเงิน + งวด ──────────────────────────────────────────────────── */
  // ค่าของงวด/วันที่โอนกั้นหน้าตรงกับหัวข้อ "รายละเอียด" ในแถบตารางด้านล่าง
  w.y = M.recipientFirst;
  w.text(data.designerName, { font: "sans", maxWidth: CONTENT_W });
  drawLabelValue(w, "งวด", data.periodLabel, M.colNameX);
  drawLabelValue(w, "วันที่โอน", paidDate, M.colNameX);

  /* ── ตารางรายการ ──────────────────────────────────────────────────────── */
  const rows: Array<[string, number]> = [
    ["ส่วนแบ่งจากการขายผ่านเว็บ", data.b2cAmount],
    ["ส่วนแบ่ง Subscription", data.subscriptionAmount],
  ];

  w.y = w.blockBottom + M.recipientToTable;
  const barTop = w.y;
  w.bar(barTop, M.barH);
  const headBase = barTop + M.barTextOffset;
  w.drawAt("รายละเอียด", headBase, { x: M.colNameX, font: "sans", color: COLOR.white });
  w.drawAt("จำนวนเงิน", headBase, { right: M.priceRight, font: "sans", color: COLOR.white });
  w.y = barTop + M.barH + M.tableToFirstItem;

  for (const [label, amount] of rows) {
    w.ensureSpace();
    w.drawAt(label, w.y, { x: M.colNameX, font: "sans", color: COLOR.navy });
    w.drawAt(money(amount), w.y, { right: M.priceRight, font: "sans", color: COLOR.navy });
    w.blockBottom = w.y;
    w.y += LEAD;
  }

  w.rule(w.blockBottom + M.itemsToRule);
  w.y = w.blockBottom + M.totalsToBar;
  drawTotalBar(w, "ยอดโอนรวม", money(data.totalAmount), bahtText(data.totalAmount));

  /* ── บัญชีที่รับโอน ────────────────────────────────────────────────────── */
  const bank = data.bank;
  if (bank?.bank_name || bank?.account_name || bank?.account_number) {
    const bankRows: Array<[string, string]> = [];
    if (bank.bank_name) bankRows.push(["บัญชี", bank.bank_name]);
    if (bank.account_name) bankRows.push(["ชื่อบัญชี", bank.account_name]);
    if (bank.account_number) bankRows.push(["เลขที่บัญชี", bank.account_number]);

    w.y = w.blockBottom + M.barToBank;
    w.ensureSpace(LEAD * (bankRows.length + 1));
    w.text("บัญชีที่รับโอน", { font: "sans" });
    for (const [label, value] of bankRows) drawLabelValue(w, label, value, M.bankValueX);
  }

  if (data.note) {
    w.y = w.blockBottom + LEAD;
    w.text(`หมายเหตุ: ${data.note}`, { font: "looped", color: COLOR.grey, maxWidth: CONTENT_W });
  }

  drawSignature(w, LEGAL_ENTITY_OPERATOR, "ผู้จ่ายเงิน");

  return w.save();
}
