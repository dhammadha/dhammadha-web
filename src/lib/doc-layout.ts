/**
 * Primitive กลางสำหรับวาดเอกสาร PDF ทุกใบที่ออกจากระบบ
 * (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน / ใบสรุปโอนส่วนแบ่ง)
 *
 * ── ทำไมต้องมีไฟล์นี้ ────────────────────────────────────────────────────────
 * เดิมมีตัวเรนเดอร์เอกสารสองตัวเขียนมือแยกกัน (HTML ใน PrintLightbox กับ pdf-lib
 * ใน quote-doc) ตัวที่โชว์บนเว็บกับตัวที่แนบอีเมลจึงเพี้ยนไม่ตรงกัน ตอนนี้เหลือ
 * ตัวเดียว และงานวางกล่อง/ตัดบรรทัด/แปลงพิกัดทั้งหมดอยู่ในไฟล์นี้ที่เดียว
 *
 * ⚠️ กติกาสำคัญ: pdf-lib `drawText({ y })` วาดที่ **เส้นฐาน (baseline)** ไม่ใช่
 * ขอบบนกล่องแบบ HTML — โค้ดเดิมสับสนตรงนี้ ตัวอักษรเลยพุ่งขึ้นไปทับเส้นที่วาด
 * ไว้ก่อนหน้า และคลาดเคลื่อนสะสมลงมาทั้งหน้า `DocWriter` จึงคุมเคอร์เซอร์เป็น
 * "ขอบบน" เสมอ แล้วแปลงเป็น baseline ให้ตอนวาด
 * **ห้ามเรียก page.drawText() ตรง ๆ นอกไฟล์นี้**
 */

import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import type { RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/* ------------------------------------------------------------------------ */
/* Geometry                                                                  */
/* ------------------------------------------------------------------------ */

export const MM = 2.8346456693; // pt ต่อ mm
export const PAGE_W = 595.28; // A4
export const PAGE_H = 841.89;

export const MARGIN_TOP = 20 * MM;
export const MARGIN_BOTTOM = 18 * MM;
export const MARGIN_X = 20 * MM;
export const CONTENT_W = PAGE_W - MARGIN_X * 2;
export const CONTENT_RIGHT = MARGIN_X + CONTENT_W;

export const COLOR = {
  navy: rgb(0x2b / 255, 0x1b / 255, 0x3d / 255), // = tailwind navy, ตรงกับสีในตัวอย่าง
  white: rgb(1, 1, 1),
  black: rgb(0.09, 0.09, 0.09),
  gray555: rgb(0x55 / 255, 0x55 / 255, 0x55 / 255),
  gray888: rgb(0x88 / 255, 0x88 / 255, 0x88 / 255),
  grayDDD: rgb(0xdd / 255, 0xdd / 255, 0xdd / 255),
  red: rgb(0xc0 / 255, 0x39 / 255, 0x2b / 255),
} satisfies Record<string, RGB>;

/** ขนาดตัวอักษร (pt) — ตั้งตามสัดส่วนในไฟล์ตัวอย่างที่เจ้าของทำมา */
export const SZ = {
  sellerName: 13,
  sellerMeta: 8.5,
  docTitle: 19,
  metaLabel: 9,
  bodyLabel: 9,
  body: 9,
  itemName: 9.5,
  itemSub: 8.5,
  totalLabel: 9,
  totalBar: 10.5,
  sig: 9,
};

/** ระยะบรรทัดมาตรฐาน — ไทยมีสระบน/ล่าง ต้องหลวมกว่าละติน */
export const LINE = 1.55;

/* ------------------------------------------------------------------------ */
/* Font loading                                                              */
/* ------------------------------------------------------------------------ */

export type DocFontBytes = { regular: ArrayBuffer; bold: ArrayBuffer };

let regularFontPromise: Promise<ArrayBuffer> | null = null;
let boldFontPromise: Promise<ArrayBuffer> | null = null;

function fetchFont(url: string): Promise<ArrayBuffer> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load font "${url}": ${res.status}`);
    return res.arrayBuffer();
  });
}

/**
 * โหลดฟอนต์ไทยจาก /public — **ใช้ได้เฉพาะในเบราว์เซอร์** (fetch แบบ relative URL)
 *
 * ตัววาดไม่เรียกฟังก์ชันนี้เอง แต่รับ `DocFontBytes` เข้ามา เพื่อให้ฝั่ง server
 * (Cloudflare Pages Function ที่รับ Stripe webhook) ส่ง bytes ที่ฝังมากับ bundle
 * เข้ามาแทนได้ โดยไม่ต้องแก้ตัววาด
 */
export async function loadDocFonts(): Promise<DocFontBytes> {
  if (!regularFontPromise) regularFontPromise = fetchFont("/fonts/pdf/NotoSansThai-Regular.ttf");
  if (!boldFontPromise) boldFontPromise = fetchFont("/fonts/pdf/NotoSansThai-Bold.ttf");
  try {
    const [regular, bold] = await Promise.all([regularFontPromise, boldFontPromise]);
    return { regular, bold };
  } catch (err) {
    // อย่า cache promise ที่ fail ไว้ — ไม่งั้นกด retry ยังไงก็เจอ error เดิมจนกว่าจะ reload
    regularFontPromise = null;
    boldFontPromise = null;
    throw err;
  }
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * จำนวนเงินรูปแบบไทย ทศนิยม 2 ตำแหน่งเสมอ
 * ตรึง locale เป็น th-TH — ของเดิมใช้ค่า default ผลลัพธ์เลยขึ้นกับเครื่องคนกดส่ง
 */
export function money(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Uint8Array → base64 แบบแบ่ง chunk (btoa รับ argument ยาวมากไม่ได้) */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/* ── การตัดบรรทัดภาษาไทย ─────────────────────────────────────────────────── */

/** สระ/วรรณยุกต์ที่ต้องเกาะพยัญชนะตัวหน้า — ห้ามขึ้นบรรทัดใหม่นำหน้าตัวเหล่านี้ */
const THAI_COMBINING = /[ัิ-ฺ็-๎]/;
/** สระหน้า เ แ โ ใ ไ — ต้องอยู่ติดพยัญชนะที่ตามมา ห้ามทิ้งไว้ท้ายบรรทัด */
const THAI_LEADING_VOWEL = /[เ-ไ]/;

/** ตัดคำไทยด้วย Intl.Segmenter ถ้ามี — ไม่มีก็คืนทั้งก้อนให้ hardBreak จัดการต่อ */
function segmentThai(text: string): string[] {
  const S = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!S) return [text];
  try {
    const seg = new S("th", { granularity: "word" });
    return Array.from(seg.segment(text), (s) => s.segment);
  } catch {
    return [text];
  }
}

/**
 * ตัดข้อความให้พอดีความกว้าง
 *
 * ของเดิมตัดที่ช่องว่างอย่างเดียว ภาษาไทยไม่มีช่องว่างระหว่างคำจึงตกไปที่
 * "ตัดทีละอักขระ" ซึ่งทำให้สระ/วรรณยุกต์หลุดจากพยัญชนะ ตอนนี้ใช้ตัวตัดคำของ
 * ICU ก่อน แล้วค่อย fallback เป็นตัดทีละอักขระแบบไม่แยก cluster
 */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let current = "";

  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;

  // ตัดทีละอักขระเมื่อคำเดียวยังยาวเกินบรรทัด — เลี่ยงจุดตัดที่ทำให้ตัวอักษรเพี้ยน
  const hardBreak = (word: string): string => {
    const chars = Array.from(word);
    let chunk = "";
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const attempt = chunk + ch;
      const nextCh = chars[i + 1] ?? "";
      const badBreak =
        THAI_COMBINING.test(nextCh) || // ตัวถัดไปเป็นสระบน/ล่าง ต้องอยู่กับตัวนี้
        THAI_LEADING_VOWEL.test(ch); // ตัวนี้เป็นสระหน้า ต้องอยู่กับตัวถัดไป
      if (chunk && !badBreak && !fits(attempt)) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = attempt;
      }
    }
    return chunk;
  };

  // แตกด้วยช่องว่างก่อน (ที่อยู่ไทยมักปนอังกฤษ/ตัวเลข) แล้วค่อยตัดคำไทยในแต่ละก้อน
  const words = text.split(" ").flatMap((w, i) => {
    const parts = /[฀-๿]/.test(w) ? segmentThai(w) : [w];
    return i === 0 ? parts : [" ", ...parts];
  });

  for (const word of words) {
    if (!word) continue;
    const attempt = current + word;
    if (fits(attempt)) {
      current = attempt;
      continue;
    }
    if (current) {
      lines.push(current.trimEnd());
      current = "";
    }
    const w = word.trimStart();
    current = fits(w) ? w : hardBreak(w);
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines.length ? lines : [""];
}

/* ------------------------------------------------------------------------ */
/* DocWriter                                                                 */
/* ------------------------------------------------------------------------ */

export type TextOpts = {
  /** ขอบซ้ายของข้อความ (ไม่ใช้เมื่อ align เป็น right/center) */
  x?: number;
  size?: number;
  bold?: boolean;
  color?: RGB;
  /** ขอบขวาสำหรับ align:"right" — ค่าเริ่มต้นคือขอบขวาของเนื้อหา */
  right?: number;
  align?: "left" | "right" | "center";
  /** กว้างสุดก่อนตัดบรรทัด — ไม่ใส่ = ไม่ตัด */
  maxWidth?: number;
  /** ตัวคูณระยะบรรทัด (ค่าเริ่มต้น LINE) */
  line?: number;
};

/**
 * ตัวช่วยวาดเอกสารทีละบล็อกจากบนลงล่าง
 *
 * `y` ที่ถืออยู่คือ **ขอบบน** ของบรรทัดถัดไปเสมอ (แบบเดียวกับ flow ของ HTML)
 * การแปลงเป็น baseline ของ pdf-lib เกิดขึ้นที่ `baselineOf()` จุดเดียว
 */
export class DocWriter {
  readonly doc: PDFDocument;
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  page: PDFPage;
  y: number;
  /** วาดซ้ำหัวตารางเมื่อขึ้นหน้าใหม่ — ตั้งไว้ระหว่างวาดตาราง */
  private onNewPage: (() => void) | null = null;

  private constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN_TOP;
  }

  static async create(fonts: DocFontBytes): Promise<DocWriter> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const regular = await doc.embedFont(fonts.regular, { subset: true });
    const bold = await doc.embedFont(fonts.bold, { subset: true });
    return new DocWriter(doc, regular, bold);
  }

  fontFor(bold?: boolean): PDFFont {
    return bold ? this.bold : this.regular;
  }

  widthOf(text: string, size: number, bold?: boolean): number {
    return this.fontFor(bold).widthOfTextAtSize(text, size);
  }

  /**
   * ขอบบน → baseline
   *
   * `heightAtSize(size, { descender: false })` คือระยะจากขอบบนของกล่องตัวอักษร
   * ลงมาถึงเส้นฐาน ตามข้อมูลจริงในไฟล์ฟอนต์ จึงไม่ต้องเดาค่า ascent เอง
   */
  private baselineOf(top: number, size: number, font: PDFFont): number {
    return top - font.heightAtSize(size, { descender: false });
  }

  /** ขึ้นหน้าใหม่ถ้าที่เหลือไม่พอ */
  ensureSpace(needed: number): void {
    if (this.y - needed >= MARGIN_BOTTOM) return;
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN_TOP;
    this.onNewPage?.();
  }

  /** ตั้ง callback วาดหัวตารางซ้ำตอนขึ้นหน้าใหม่ (ส่ง null เพื่อยกเลิก) */
  setPageHeader(fn: (() => void) | null): void {
    this.onNewPage = fn;
  }

  space(h: number): void {
    this.y -= h;
  }

  /** วาดข้อความโดยไม่ขยับเคอร์เซอร์ — ใช้กับคอลัมน์ที่ต้องอยู่ระดับเดียวกัน */
  textAt(text: string, top: number, opts: TextOpts = {}): void {
    if (!text) return;
    const size = opts.size ?? SZ.body;
    const font = this.fontFor(opts.bold);
    const color = opts.color ?? COLOR.black;
    const w = font.widthOfTextAtSize(text, size);
    let x = opts.x ?? MARGIN_X;
    if (opts.align === "right") x = (opts.right ?? CONTENT_RIGHT) - w;
    else if (opts.align === "center") x = (opts.x ?? MARGIN_X) + (((opts.maxWidth ?? 0) - w) / 2);
    this.page.drawText(text, { x, y: this.baselineOf(top, size, font), size, font, color });
  }

  /** วาดข้อความแล้วเลื่อนเคอร์เซอร์ลง — ตัดหลายบรรทัดให้อัตโนมัติถ้ากำหนด maxWidth */
  text(text: string, opts: TextOpts = {}): void {
    if (!text) return;
    const size = opts.size ?? SZ.body;
    const lineH = size * (opts.line ?? LINE);
    const lines = opts.maxWidth
      ? wrapText(text, this.fontFor(opts.bold), size, opts.maxWidth)
      : [text];
    for (const ln of lines) {
      this.ensureSpace(lineH);
      this.textAt(ln, this.y, opts);
      this.y -= lineH;
    }
  }

  /** เส้นคั่นเต็มความกว้างเนื้อหา */
  rule(thickness = 1, color: RGB = COLOR.navy): void {
    this.ensureSpace(thickness);
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: CONTENT_RIGHT, y: this.y },
      thickness,
      color,
    });
    this.y -= thickness;
  }

  /** เส้นสั้นตามความกว้างที่กำหนด (ใช้กับเส้นลายเซ็น) */
  ruleAt(x: number, width: number, thickness = 1, color: RGB = COLOR.gray555): void {
    this.page.drawLine({
      start: { x, y: this.y },
      end: { x: x + width, y: this.y },
      thickness,
      color,
    });
  }

  /**
   * แถบสีเต็มความกว้าง คืนค่าขอบบนของ "พื้นที่ข้อความ" ในแถบ
   * ผู้เรียกวาดข้อความเองด้วย textAt() เพราะแถบเดียวมีได้ทั้งซ้ายและขวา
   */
  bar(height: number, color: RGB = COLOR.navy, padTop = 0): number {
    this.ensureSpace(height);
    this.page.drawRectangle({
      x: MARGIN_X,
      y: this.y - height,
      width: CONTENT_W,
      height,
      color,
    });
    const textTop = this.y - padTop;
    this.y -= height;
    return textTop;
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

/* ------------------------------------------------------------------------ */
/* บล็อกที่ใช้ซ้ำทุกเอกสาร                                                     */
/* ------------------------------------------------------------------------ */

/** ผู้ออกเอกสาร — designer (จากตาราง users) หรือแพลตฟอร์ม (จาก brand.ts) */
export type DocIssuer = {
  name?: string | null;
  business_name?: string | null;
  entity_type?: string | null;
  tax_id?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

/**
 * หัวเอกสาร: ชื่อผู้ออก / ผู้ดำเนินการ + เลขผู้เสียภาษี / ที่อยู่ / ช่องทางติดต่อ
 * ปิดท้ายด้วยเส้นคั่นหนา ตามไฟล์ตัวอย่าง
 */
export function drawIssuerHeader(w: DocWriter, issuer: DocIssuer): void {
  const title = issuer.business_name || issuer.name || "";
  w.text(title, { size: SZ.sellerName, bold: true, color: COLOR.black, maxWidth: CONTENT_W });

  // "โดย {ชื่อ} หมายเลขประจำตัวผู้เสียภาษี {เลข}" รวมเป็นบรรทัดเดียวตามตัวอย่าง
  const byParts: string[] = [];
  if (issuer.name && issuer.business_name && issuer.name !== issuer.business_name) {
    byParts.push(`โดย ${issuer.name}`);
  }
  if (issuer.tax_id) byParts.push(`หมายเลขประจำตัวผู้เสียภาษี ${issuer.tax_id}`);
  if (byParts.length) {
    w.text(byParts.join(" "), { size: SZ.sellerMeta, color: COLOR.gray555, maxWidth: CONTENT_W });
  }

  if (issuer.address) {
    w.text(issuer.address, { size: SZ.sellerMeta, color: COLOR.gray555, maxWidth: CONTENT_W });
  }

  const contact: string[] = [];
  if (issuer.phone) contact.push(`โทรศัพท์ ${issuer.phone}`);
  if (issuer.email) contact.push(`Email : ${issuer.email}`);
  if (contact.length) {
    w.text(contact.join(" / "), { size: SZ.sellerMeta, color: COLOR.gray555, maxWidth: CONTENT_W });
  }

  w.space(6);
  w.rule(1.2, COLOR.black);
  w.space(14);
}

/**
 * แถวหัวเรื่อง: ชื่อเอกสารตัวใหญ่ทางซ้าย + เลขที่/วันที่ทางขวา
 * ค่าทางขวาจัดเป็นคอลัมน์ให้ตรงกัน (label ชิดซ้ายของคอลัมน์ ค่าเริ่มที่ x เดียวกัน)
 */
export function drawTitleRow(w: DocWriter, title: string, rows: Array<[string, string]>): void {
  const top = w.y;
  w.textAt(title, top, { size: SZ.docTitle, bold: true, color: COLOR.black });

  // จัดคอลัมน์: label กว้างสุดกำหนดตำแหน่งเริ่มของค่า
  const labelW = Math.max(...rows.map(([l]) => w.widthOf(l, SZ.metaLabel, true)));
  const valueW = Math.max(...rows.map(([, v]) => w.widthOf(v, SZ.metaLabel)));
  const labelX = CONTENT_RIGHT - valueW - 12 - labelW;
  const valueX = CONTENT_RIGHT - valueW;

  let rowTop = top;
  const lineH = SZ.metaLabel * LINE;
  for (const [label, value] of rows) {
    w.textAt(label, rowTop, { x: labelX, size: SZ.metaLabel, bold: true, color: COLOR.black });
    w.textAt(value, rowTop, { x: valueX, size: SZ.metaLabel, color: COLOR.gray555 });
    rowTop -= lineH;
  }

  // บล็อกนี้สูงเท่าฝั่งที่สูงกว่า
  const titleH = SZ.docTitle * 1.35;
  w.y = Math.min(top - titleH, rowTop);
  w.space(10);
}

/** แถวป้าย/ค่า เช่น "บัญชี   ธนาคารกสิกรไทย ..." — ใช้ในบล็อกรายละเอียดการชำระเงิน */
export function drawLabelValue(w: DocWriter, label: string, value: string, labelW: number): void {
  const lineH = SZ.body * LINE;
  w.ensureSpace(lineH);
  const top = w.y;
  w.textAt(label, top, { size: SZ.body, bold: true, color: COLOR.black });
  w.textAt(value, top, {
    x: MARGIN_X + labelW,
    size: SZ.body,
    color: COLOR.gray555,
  });
  w.y -= lineH;
}

/**
 * แถบยอดชำระพื้น navy — ตัวหนังสือจำนวนเงินชิดซ้าย, ป้าย+ยอดชิดขวา
 * (ตามไฟล์ตัวอย่าง ทั้งใบเสนอราคา ใบแจ้งหนี้ และใบเสร็จใช้แถบเดียวกัน)
 */
export function drawTotalBar(w: DocWriter, label: string, amount: string, inWords: string): void {
  const barH = SZ.totalBar * 2.4;
  const padTop = (barH - SZ.totalBar * 1.2) / 2;
  const top = w.bar(barH, COLOR.navy, padTop);

  if (inWords) {
    w.textAt(`(${inWords})`, top, {
      x: MARGIN_X + 12,
      size: SZ.body,
      color: COLOR.white,
    });
  }
  const amountW = w.widthOf(amount, SZ.totalBar, true);
  w.textAt(amount, top, {
    align: "right",
    right: CONTENT_RIGHT - 12,
    size: SZ.totalBar,
    bold: true,
    color: COLOR.white,
  });
  w.textAt(label, top, {
    align: "right",
    right: CONTENT_RIGHT - 12 - amountW - 20,
    size: SZ.totalBar,
    bold: true,
    color: COLOR.white,
  });
}

/** บล็อกลายเซ็นมุมขวาล่าง */
export function drawSignature(w: DocWriter, name: string, role: string): void {
  const sigW = 150;
  const sigX = CONTENT_RIGHT - sigW;

  w.ensureSpace(70);
  w.space(46);
  w.ruleAt(sigX, sigW, 0.8, COLOR.gray555);
  w.space(8);

  const top = w.y;
  w.textAt(name, top, { x: sigX, maxWidth: sigW, align: "center", size: SZ.sig, bold: true, color: COLOR.black });
  w.y -= SZ.sig * LINE;
  w.textAt(`(${role})`, w.y, { x: sigX, maxWidth: sigW, align: "center", size: SZ.sig, color: COLOR.gray555 });
  w.y -= SZ.sig * LINE;
}
