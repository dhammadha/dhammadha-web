/**
 * ใบสรุปการโอนส่วนแบ่งรายได้ (PDF) — แนบไปกับอีเมลยืนยันการโอนให้ designer
 *
 * ใช้เลย์เอาต์ชุดเดียวกับใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ (ดู `doc-layout.ts`)
 * ต่างกันแค่ผู้ออกเอกสารและเนื้อในตาราง:
 *  - ใบเสนอราคา/ใบเสร็จ  ออกในนาม **designer เจ้าของฟอนต์** (อ่านจากแถว users)
 *  - ใบนี้                ออกในนาม **แพลตฟอร์ม** ซึ่งเป็นผู้จ่ายเงินให้ designer
 *    จึงอ่านหัวเอกสารจากค่าคงที่ใน `brand.ts` (ฝั่ง admin ไม่มีหน้าตั้งค่าข้อมูลธุรกิจ)
 *
 * **ภาษีหัก ณ ที่จ่าย** — พิมพ์ก็ต่อเมื่อ `whtRate > 0` เท่านั้น (แพลตฟอร์มเป็น
 * นิติบุคคลแล้ว ดู `LEGAL_ENTITY_IS_JURISTIC`) ตอน rate = 0 เอกสารต้องหน้าตา
 * เหมือนก่อนมีฟีเจอร์นี้ทุกประการ รวมถึงคำว่า "ยอดโอนรวม" บนแถบ
 *
 * ⚠️ ตัวเลขทั้งสามค่า (`totalAmount`/`whtAmount`/`netAmount`) ต้องมาจาก
 * `payoutBreakdown()` ใน `revenue.ts` เสมอ ห้ามคำนวณเองในไฟล์นี้ —
 * ใบนี้กับใบ 50 ทวิและแถวใน `payouts` ต้องเป็นตัวเลขชุดเดียวกันเป๊ะ
 *
 * ⚠️ ยังไม่เคาะ: ตราประทับ
 */

import {
  COLOR,
  DocWriter,
  LEAD,
  M,
  drawIssuerHeader,
  drawLabelValue,
  drawSignature,
  drawTitleRow,
  drawTotalBar,
  drawTotalRow,
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
  /** เลขที่เอกสาร `PO-2569-0001` — ออกจาก `next_doc_no('PO')` ใน RPC `record_payout` */
  docNo?: string | null;
  /**
   * ชื่อร้าน/แบรนด์ของ designer — พิมพ์เป็นบรรทัดหัว ส่วน `designerName` ลงบรรทัดรอง
   * ไม่มีก็ใช้ `designerName` เป็นหัวแทน (แบบเดียวกับ `drawIssuerHeader`)
   */
  designerBusinessName?: string | null;
  designerName: string;
  periodLabel: string; // เช่น "ไตรมาส 3/2569 (ก.ค.–ก.ย.)"
  paidAt: string; // ISO
  b2cAmount: number; // ส่วนแบ่งจากการขายผ่านเว็บ
  subscriptionAmount: number; // ส่วนแบ่ง subscription
  /** ยอดเต็มก่อนหักภาษี = `payouts.amount` */
  totalAmount: number;
  /** 0 = ยังไม่เป็นนิติบุคคล → ไม่พิมพ์บรรทัดหักภาษี (ดูหัวไฟล์) */
  whtRate?: number;
  whtAmount?: number;
  /** ยอดที่โอนเข้าบัญชีจริง — ไม่ส่งมาถือว่าเท่ากับ `totalAmount` */
  netAmount?: number;
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
  // ไม่มีบล็อกเลขที่/วันที่มุมขวาบนแบบใบเสนอราคา — เลขที่/งวด/วันที่โอน
  // อยู่ใต้ชื่อผู้รับทั้งชุด (ดูบล็อกถัดไป) ตามที่เจ้าของกำหนด
  drawTitleRow(w, "ใบสรุปการโอนส่วนแบ่งรายได้", []);

  /* ── ผู้รับเงิน + เลขที่ + งวด ─────────────────────────────────────────── */
  // บรรทัดเดียว "ชื่อคน (ชื่อร้าน)" — เดิมส่งมาได้ชื่อเดียวจึงเสียอีกชื่อไปเสมอ
  w.y = M.recipientFirst;
  const brand = data.designerBusinessName?.trim();
  const person = data.designerName?.trim();
  const recipient =
    person && brand && person !== brand ? `${person} (${brand})` : person || brand || "";
  // ทั้งสี่แถวใช้ drawLabelValue ตัวเดียวกัน ค่าจึงกั้นหน้าตรงกันที่ `M.colNameX`
  // ซึ่งตรงกับหัวข้อ "รายละเอียด" ในแถบตารางด้านล่างด้วย
  drawLabelValue(w, "บัญชี", recipient, M.colNameX);
  if (data.docNo) drawLabelValue(w, "เลขที่", data.docNo, M.colNameX);
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

  /* ── ยอดรวม / หักภาษี / ยอดโอนสุทธิ ────────────────────────────────────── */
  const whtRate = data.whtRate ?? 0;
  const whtAmount = data.whtAmount ?? 0;
  const netAmount = data.netAmount ?? data.totalAmount;

  if (whtRate > 0) {
    // เรียงยอดหน้าตาเดียวกับใบเสนอราคา (drawTotalRow ตัวเดียวกัน)
    w.y = w.blockBottom + M.ruleToTotals;
    drawTotalRow(w, "รวมส่วนแบ่ง", money(data.totalAmount));
    drawTotalRow(w, `หักภาษี ณ ที่จ่าย ${whtRate * 100}%`, money(whtAmount));
  }

  w.y = w.blockBottom + M.totalsToBar;
  // ยังไม่เป็นนิติบุคคล = ไม่มีการหักภาษี ป้ายจึงต้องเป็น "ยอดโอนรวม" เหมือนเดิม
  drawTotalBar(
    w,
    whtRate > 0 ? "ยอดโอนสุทธิ" : "ยอดโอนรวม",
    money(netAmount),
    bahtText(netAmount),
  );

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

  // ไม่พิมพ์หมายเหตุลงเอกสาร (เจ้าของกำหนด) — โน้ต/เลขอ้างอิงสลิปยังเก็บใน
  // `payouts.note` และแสดงในหน้า admin กับในอีเมลตามเดิม

  drawSignature(w, LEGAL_ENTITY_OPERATOR, "ผู้จ่ายเงิน");

  return w.save();
}
