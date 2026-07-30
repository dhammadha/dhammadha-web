/**
 * ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน (PDF)
 *
 * เอกสารทั้งสามใบใช้โครงเดียวกัน ต่างกันแค่หัวเรื่อง บล็อกผู้รับ บล็อกบัญชี
 * และคำลงท้ายลายเซ็น — ตารางเดียวใน DOC_SPEC คุมความต่างทั้งหมด
 *
 * เลย์เอาต์อ้างอิงไฟล์ตัวอย่าง (Illustrator) ที่เจ้าของทำมา 30 ก.ค. 2569
 * งานวางกล่อง/ตัดบรรทัด/แปลงพิกัดอยู่ใน `doc-layout.ts` — ไฟล์นี้บอกแค่ว่า
 * "วาดอะไร เรียงลำดับไหน"
 *
 * รันได้ทั้งเบราว์เซอร์และ server: ตัวโหลดฟอนต์อยู่นอกไฟล์นี้ ผู้เรียกส่ง
 * `DocFontBytes` เข้ามาเอง (ดู `loadDocFonts()` สำหรับฝั่งเบราว์เซอร์)
 */

import {
  CONTENT_RIGHT,
  CONTENT_W,
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
  type DocIssuer,
} from "./doc-layout";
import { bahtText } from "./baht-text";

export { bahtText } from "./baht-text";

/* ------------------------------------------------------------------------ */
/* Public types                                                              */
/* ------------------------------------------------------------------------ */

export type QuoteDocType = "quotation" | "invoice" | "receipt";

export type QuoteDocItem = {
  name: string;
  /** ป้ายสิทธิ์แบบบรรทัดเดียว (ใช้เมื่อไม่มี license_lines — แถวเก่า) */
  license_type?: string | null;
  /**
   * บรรทัดย่อยใต้ชื่อฟอนต์ที่ **ตรึงไว้ตอนออกใบ** แล้ว
   * มีค่านี้เมื่อไหร่ให้ใช้ค่านี้เสมอ ห้ามคำนวณใหม่ — ดู licenseDocLines() ใน license.ts
   */
  license_lines?: string[] | null;
  price: number;
};

export type QuoteDocSellerBank = {
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
};

export type QuoteDocSeller = DocIssuer & {
  bank?: QuoteDocSellerBank | null;
};

export type QuoteDocData = {
  type: QuoteDocType;
  doc_no: string;
  date: string; // จัดรูปแบบ th-TH มาแล้ว
  contact_name: string;
  company_name?: string | null;
  address?: string | null;
  tax_id?: string | null;
  email?: string | null;
  note?: string | null; // เก็บไว้แต่ไม่พิมพ์ลงเอกสาร (เป็นข้อความที่ลูกค้ากรอกตอนขอราคา)
  items: QuoteDocItem[];
  seller: QuoteDocSeller;
  discount?: number;
};

/* ------------------------------------------------------------------------ */
/* ความต่างระหว่างเอกสารสามใบ                                                  */
/* ------------------------------------------------------------------------ */

const DOC_SPEC: Record<
  QuoteDocType,
  {
    title: string;
    /** มีบล็อก "เรียน / เรื่อง / อายุใบเสนอราคา" ไหม */
    salutation: boolean;
    /** มีบล็อกเลขบัญชีไหม — ใบเสร็จไม่มีเพราะจ่ายไปแล้ว */
    bank: boolean;
    signRole: string;
  }
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

  /* ── หัวผู้ขาย + หัวเรื่อง ─────────────────────────────────────────────── */
  drawIssuerHeader(w, data.seller);
  drawTitleRow(w, spec.title, [
    ["เลขที่", data.doc_no],
    ["วันที่", data.date],
  ]);

  /* ── ผู้รับ ────────────────────────────────────────────────────────────── */
  drawRecipient(w, data, spec.salutation);

  /* ── ตารางรายการ ──────────────────────────────────────────────────────── */
  drawItemsTable(w, data.items);

  /* ── ยอดรวม ───────────────────────────────────────────────────────────── */
  w.space(10);
  drawTotalRow(w, "รวมจำนวนเงิน", money(subtotal));
  if (discount > 0) drawTotalRow(w, "ส่วนลด", money(discount), COLOR.red);
  drawTotalRow(w, `หักภาษี ณ ที่จ่าย ${WHT_RATE * 100}%`, money(wht));

  w.space(10);
  drawTotalBar(w, "ยอดชำระ", money(total), bahtText(total));

  /* ── รายละเอียดการชำระเงิน ─────────────────────────────────────────────── */
  if (spec.bank && data.seller.bank) drawBankBlock(w, data.seller.bank);

  /* ── ลายเซ็น ──────────────────────────────────────────────────────────── */
  drawSignature(w, data.seller.name || "", spec.signRole);

  return w.save();
}

/* ------------------------------------------------------------------------ */
/* บล็อกย่อย                                                                  */
/* ------------------------------------------------------------------------ */

function drawRecipient(w: DocWriter, data: QuoteDocData, salutation: boolean): void {
  const lines: Array<{ text: string; bold?: boolean }> = [];
  if (salutation) {
    // ใบเสนอราคา: ชื่อผู้ติดต่อขึ้นก่อน ตามลำดับในไฟล์ตัวอย่าง
    if (data.contact_name) lines.push({ text: data.contact_name });
    if (data.company_name) lines.push({ text: data.company_name });
  } else {
    // ใบแจ้งหนี้/ใบเสร็จ: ออกในนามบริษัท ชื่อบริษัทจึงเป็นบรรทัดแรกและเป็นตัวหนา
    if (data.company_name) lines.push({ text: data.company_name, bold: true });
    else if (data.contact_name) lines.push({ text: data.contact_name, bold: true });
  }
  if (data.address) lines.push({ text: data.address });
  if (data.tax_id) lines.push({ text: `หมายเลขประจำตัวผู้เสียภาษี ${data.tax_id}` });

  if (salutation) {
    const labelW = w.widthOf("เรียน", SZ.bodyLabel, true) + 16;
    const bodyX = MARGIN_X + labelW;
    const bodyW = CONTENT_W - labelW;

    w.textAt("เรียน", w.y, { size: SZ.bodyLabel, bold: true, color: COLOR.black });
    for (const ln of lines) {
      w.text(ln.text, { x: bodyX, size: SZ.body, bold: ln.bold, color: COLOR.gray555, maxWidth: bodyW });
    }

    w.space(8);
    w.textAt("เรื่อง", w.y, { size: SZ.bodyLabel, bold: true, color: COLOR.black });
    w.text(QUOTE_SUBJECT, { x: bodyX, size: SZ.body, bold: true, color: COLOR.black, maxWidth: bodyW });
    w.space(4);
    w.text(QUOTE_VALIDITY, { size: SZ.itemSub, color: COLOR.gray888, maxWidth: CONTENT_W });
  } else {
    for (const ln of lines) {
      w.text(ln.text, { size: SZ.body, bold: ln.bold, color: ln.bold ? COLOR.black : COLOR.gray555, maxWidth: CONTENT_W });
    }
  }

  w.space(14);
}

/** คอลัมน์ของตาราง (pt จากขอบซ้ายของเนื้อหา) */
const COL_IDX = 14;
const COL_NAME = 46;
const COL_PAD_RIGHT = 12;

function drawItemsTable(w: DocWriter, items: QuoteDocItem[]): void {
  const headerH = SZ.body * 2.4;
  const nameW = CONTENT_W - COL_NAME - 90;

  const drawHeader = () => {
    const padTop = (headerH - SZ.body * 1.2) / 2;
    const top = w.bar(headerH, COLOR.navy, padTop);
    w.textAt("ลำดับ", top, { x: MARGIN_X + COL_IDX, size: SZ.body, bold: true, color: COLOR.white });
    w.textAt("รายละเอียด", top, { x: MARGIN_X + COL_NAME, size: SZ.body, bold: true, color: COLOR.white });
    w.textAt("ราคา", top, {
      align: "right",
      right: CONTENT_RIGHT - COL_PAD_RIGHT,
      size: SZ.body,
      bold: true,
      color: COLOR.white,
    });
    w.space(12);
  };

  drawHeader();
  // ขึ้นหน้าใหม่กลางตาราง ต้องได้หัวตารางซ้ำ ไม่งั้นอ่านไม่รู้เรื่อง
  w.setPageHeader(drawHeader);

  const nameLineH = SZ.itemName * LINE;
  const subLineH = SZ.itemSub * 1.45;

  items.forEach((item, i) => {
    const subLines = itemSubLines(item);
    const rowH = nameLineH + subLines.length * subLineH + 10;
    w.ensureSpace(rowH);

    const rowTop = w.y;
    w.textAt(String(i + 1), rowTop, {
      x: MARGIN_X + COL_IDX,
      size: SZ.itemName,
      color: COLOR.gray555,
    });
    w.textAt(money(item.price), rowTop, {
      align: "right",
      right: CONTENT_RIGHT - COL_PAD_RIGHT,
      size: SZ.itemName,
      color: COLOR.black,
    });

    w.text(`ชุดฟอนต์ “${item.name}”`, {
      x: MARGIN_X + COL_NAME,
      size: SZ.itemName,
      bold: true,
      color: COLOR.black,
      maxWidth: nameW,
    });
    for (const sub of subLines) {
      w.text(sub, {
        x: MARGIN_X + COL_NAME,
        size: SZ.itemSub,
        color: COLOR.gray555,
        maxWidth: nameW,
        line: 1.45,
      });
    }
    w.space(10);
  });

  w.setPageHeader(null);
  w.space(4);
  w.rule(0.8, COLOR.gray555);
}

/**
 * บรรทัดย่อยใต้ชื่อฟอนต์
 * ใช้ค่าที่ตรึงไว้ตอนออกใบก่อนเสมอ — แถวเก่าที่ยังไม่มีค่อย fallback ไปที่ป้ายเดี่ยว
 */
function itemSubLines(item: QuoteDocItem): string[] {
  if (item.license_lines?.length) return item.license_lines;
  return item.license_type ? [`สิทธิการใช้งาน: ${item.license_type}`] : [];
}

function drawTotalRow(w: DocWriter, label: string, value: string, color = COLOR.black): void {
  const lineH = SZ.totalLabel * 1.9;
  w.ensureSpace(lineH);
  const top = w.y;
  const valueW = w.widthOf(value, SZ.totalLabel, true);
  w.textAt(value, top, {
    align: "right",
    right: CONTENT_RIGHT - COL_PAD_RIGHT,
    size: SZ.totalLabel,
    bold: true,
    color,
  });
  w.textAt(label, top, {
    align: "right",
    right: CONTENT_RIGHT - COL_PAD_RIGHT - valueW - 24,
    size: SZ.totalLabel,
    bold: true,
    color: COLOR.black,
  });
  w.y -= lineH;
}

function drawBankBlock(w: DocWriter, bank: QuoteDocSellerBank): void {
  const rows: Array<[string, string]> = [];
  if (bank.bank_name) rows.push(["บัญชี", bank.bank_name]);
  if (bank.account_name) rows.push(["ชื่อบัญชี", bank.account_name]);
  if (bank.account_number) rows.push(["เลขที่บัญชี", bank.account_number]);
  if (!rows.length) return;

  w.space(20);
  w.ensureSpace(SZ.body * LINE * (rows.length + 1));
  w.text("รายละเอียดการชำระเงิน", { size: SZ.bodyLabel, bold: true, color: COLOR.black });

  const labelW = Math.max(...rows.map(([l]) => w.widthOf(l, SZ.body, true))) + 16;
  for (const [label, value] of rows) drawLabelValue(w, label, value, labelW);
}
