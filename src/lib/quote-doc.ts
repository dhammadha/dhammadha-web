/**
 * ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน (PDF)
 *
 * เลย์เอาต์ทุกค่าวัดมาจากไฟล์ต้นแบบที่เจ้าของทำใน Illustrator
 * (`dhammadha-web fix list/template.pdf`) — ระยะและตำแหน่งอยู่ใน `M` ของ
 * `doc-layout.ts` ส่วนไฟล์นี้บอกแค่ว่า "วาดอะไร เรียงลำดับไหน"
 *
 * ⚠️ ห้ามปรับค่าระยะด้วยสายตา ถ้าจะแก้เลย์เอาต์ให้วัดจากต้นแบบใหม่
 *
 * รันได้ทั้งเบราว์เซอร์และ server: ผู้เรียกส่ง `DocFontBytes` เข้ามาเอง
 */

import {
  CONTENT_RIGHT,
  CONTENT_W,
  COLOR,
  DocWriter,
  LEAD,
  M,
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
  type DocIssuer,
} from "./doc-layout";
import { bahtText } from "./baht-text";

export { bahtText } from "./baht-text";

/* ------------------------------------------------------------------------ */
/* Public types                                                              */
/* ------------------------------------------------------------------------ */

export type QuoteDocType = "quotation" | "invoice" | "receipt";

export type QuoteDocItem = {
  /** ชื่อที่จะพิมพ์ลงเอกสาร — ตรึงไว้ตอนออกใบแล้ว (รูปแบบ "ชื่อไทย | ชื่ออังกฤษ") */
  name: string;
  /** ป้ายสิทธิ์บรรทัดเดียว (ใช้เมื่อไม่มี license_lines — ใบที่ออกก่อน 31 ก.ค. 2569) */
  license_type?: string | null;
  /** บรรทัดย่อยใต้ชื่อฟอนต์ที่ตรึงไว้ตอนออกใบ — มีค่าเมื่อไหร่ให้ใช้ค่านี้เสมอ */
  license_lines?: string[] | null;
  price: number;
};

export type QuoteDocSellerBank = {
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
};

export type QuoteDocSeller = DocIssuer & { bank?: QuoteDocSellerBank | null };

export type QuoteDocData = {
  type: QuoteDocType;
  doc_no: string;
  date: string; // จัดรูปแบบ th-TH มาแล้ว
  contact_name: string;
  company_name?: string | null;
  address?: string | null;
  tax_id?: string | null;
  email?: string | null;
  note?: string | null; // เก็บไว้แต่ไม่พิมพ์ (เป็นข้อความที่ลูกค้ากรอกตอนขอราคา)
  items: QuoteDocItem[];
  seller: QuoteDocSeller;
  discount?: number;
};

/* ------------------------------------------------------------------------ */
/* ความต่างระหว่างเอกสารสามใบ                                                  */
/* ------------------------------------------------------------------------ */

const DOC_SPEC: Record<
  QuoteDocType,
  { title: string; salutation: boolean; bank: boolean; signRole: string }
> = {
  quotation: { title: "ใบเสนอราคา", salutation: true, bank: true, signRole: "ผู้เสนอราคา" },
  invoice: { title: "ใบแจ้งหนี้", salutation: false, bank: true, signRole: "ผู้วางบิล" },
  receipt: { title: "ใบเสร็จรับเงิน", salutation: false, bank: false, signRole: "ผู้รับเงิน" },
};

const QUOTE_SUBJECT = "เสนอราคาสิทธิการใช้งานโปรแกรมคอมพิวเตอร์ฟอนต์";
const QUOTE_VALIDITY = "ใบเสนอราคานี้มีอายุ 15 วัน นับจากวันที่เสนอราคา";

/** อัตราภาษีหัก ณ ที่จ่าย — ใบเสนอราคาออกให้นิติบุคคลเท่านั้นจึงหักทุกใบ */
const WHT_RATE = 0.03;

/* ------------------------------------------------------------------------ */
/* Main                                                                      */
/* ------------------------------------------------------------------------ */

export async function generateQuotePdf(
  data: QuoteDocData,
  fonts?: DocFontBytes,
): Promise<Uint8Array> {
  const w = await DocWriter.create(fonts ?? (await loadDocFonts()));
  const spec = DOC_SPEC[data.type];

  const subtotal = data.items.reduce((s, i) => s + i.price, 0);
  const discount = data.discount ?? 0;
  const discountedSubtotal = subtotal - discount;
  const wht = discountedSubtotal * WHT_RATE;
  const total = discountedSubtotal - wht;

  drawIssuerHeader(w, data.seller);
  drawTitleRow(w, spec.title, [
    ["เลขที่", data.doc_no],
    ["วันที่", data.date],
  ]);

  drawRecipient(w, data, spec.salutation);
  drawItemsTable(w, data.items);

  /* ── ยอดรวม ───────────────────────────────────────────────────────────── */
  w.y = w.blockBottom + M.ruleToTotals;
  drawTotalRow(w, "รวมจำนวนเงิน", money(subtotal));
  if (discount > 0) drawTotalRow(w, "ส่วนลด", money(discount), COLOR.red);
  drawTotalRow(w, `หักภาษี ณ ที่จ่าย ${WHT_RATE * 100}%`, money(wht));

  w.y = w.blockBottom + M.totalsToBar;
  drawTotalBar(w, "ยอดชำระ", money(total), bahtText(total));

  if (spec.bank && data.seller.bank) drawBankBlock(w, data.seller.bank);

  drawSignature(w, data.seller.name || "", spec.signRole);

  return w.save();
}

/* ------------------------------------------------------------------------ */
/* บล็อกย่อย                                                                  */
/* ------------------------------------------------------------------------ */

function drawRecipient(w: DocWriter, data: QuoteDocData, salutation: boolean): void {
  w.y = M.recipientFirst;

  if (salutation) {
    // ใบเสนอราคา: ป้าย "เรียน" ทางซ้าย เนื้อหาเยื้องเข้าไป
    const bodyW = CONTENT_W - (M.salutBodyX - MARGIN_X);
    w.drawAt("เรียน", w.y, { x: M.salutLabelX, font: "sans" });
    for (const line of [data.contact_name, data.company_name, data.address, taxLine(data.tax_id)]) {
      if (line) w.text(line, { x: M.salutBodyX, font: "looped", maxWidth: bodyW });
    }

    w.y = w.blockBottom + 22;
    w.drawAt("เรื่อง", w.y, { x: M.salutLabelX, font: "sans" });
    w.text(QUOTE_SUBJECT, { x: M.salutBodyX, font: "loopedBold", color: COLOR.navy, maxWidth: bodyW });

    w.y = w.blockBottom + 21;
    w.text(QUOTE_VALIDITY, { x: M.salutLabelX, font: "looped", color: COLOR.grey, maxWidth: CONTENT_W });
  } else {
    // ใบแจ้งหนี้ / ใบเสร็จ: ออกในนามบริษัท ไม่มีคำขึ้นต้น
    const head = data.company_name || data.contact_name;
    if (head) w.text(head, { font: "sans", maxWidth: CONTENT_W });
    for (const line of [data.address, taxLine(data.tax_id)]) {
      if (line) w.text(line, { font: "looped", maxWidth: CONTENT_W });
    }
  }
}

function taxLine(taxId?: string | null): string | null {
  return taxId ? `หมายเลขประจำตัวผู้เสียภาษี ${taxId}` : null;
}

function drawItemsTable(w: DocWriter, items: QuoteDocItem[]): void {
  const nameW = M.colPriceLeft - M.colNameX - 8;

  const drawHeader = () => {
    const top = w.y;
    w.bar(top, M.barH);
    const baseline = top + M.barTextOffset;
    // "ลำดับ" กึ่งกลางคอลัมน์ตามที่กำกับมา
    w.drawAt("ลำดับ", baseline, { center: [MARGIN_X, M.colIndexRight], font: "sans", color: COLOR.white });
    w.drawAt("รายละเอียด", baseline, { x: M.colNameX, font: "sans", color: COLOR.white });
    w.drawAt("ราคา", baseline, { right: M.priceRight, font: "sans", color: COLOR.white });
    w.y = top + M.barH + M.tableToFirstItem;
  };

  w.y = w.blockBottom + M.recipientToTable;
  w.ensureSpace(M.barH + M.tableToFirstItem);
  drawHeader();
  // ขึ้นหน้าใหม่กลางตาราง ต้องได้หัวตารางซ้ำ ไม่งั้นอ่านไม่รู้เรื่อง
  w.setPageHeader(drawHeader);

  items.forEach((item, i) => {
    const subLines = itemSubLines(item);
    w.ensureSpace(LEAD * (1 + subLines.length));

    const baseline = w.y;
    // เลขลำดับกึ่งกลางแกนเดียวกับหัวข้อ "ลำดับ" ตามที่กำกับมา
    w.drawAt(String(i + 1), baseline, {
      center: [MARGIN_X, M.colIndexRight],
      font: "sans",
      color: COLOR.navy,
    });
    w.drawAt(money(item.price), baseline, { right: M.priceRight, font: "sans", color: COLOR.navy });

    w.text(`ชุดฟอนต์ “${item.name}”`, {
      x: M.colNameX,
      font: "sans",
      color: COLOR.navy,
      maxWidth: nameW,
    });
    for (const sub of subLines) {
      w.text(sub, { x: M.colNameX, font: "looped", maxWidth: nameW });
    }
    if (i < items.length - 1) w.y = w.blockBottom + M.itemToItem;
  });

  w.setPageHeader(null);
  w.rule(w.blockBottom + M.itemsToRule);
}

/** ใช้ค่าที่ตรึงไว้ตอนออกใบก่อนเสมอ — แถวเก่าค่อย fallback ไปที่ป้ายเดี่ยว */
function itemSubLines(item: QuoteDocItem): string[] {
  if (item.license_lines?.length) return item.license_lines;
  return item.license_type ? [`สิทธิการใช้งาน: ${item.license_type}`] : [];
}

function drawTotalRow(w: DocWriter, label: string, value: string, color = COLOR.text): void {
  w.ensureSpace();
  w.drawAt(label, w.y, { right: M.totalLabelRight, font: "sans", color: COLOR.text });
  w.drawAt(value, w.y, { right: M.priceRight, font: "sans", color });
  w.blockBottom = w.y;
  w.y += M.totalRowGap;
}

function drawBankBlock(w: DocWriter, bank: QuoteDocSellerBank): void {
  const rows: Array<[string, string]> = [];
  if (bank.bank_name) rows.push(["บัญชี", bank.bank_name]);
  if (bank.account_name) rows.push(["ชื่อบัญชี", bank.account_name]);
  if (bank.account_number) rows.push(["เลขที่บัญชี", bank.account_number]);
  if (!rows.length) return;

  w.y = w.blockBottom + M.barToBank;
  w.ensureSpace(LEAD * (rows.length + 1));
  w.text("รายละเอียดการชำระเงิน", { font: "sans" });
  for (const [label, value] of rows) drawLabelValue(w, label, value, M.bankValueX);
}
