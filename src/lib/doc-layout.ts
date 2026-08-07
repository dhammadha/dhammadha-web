/**
 * Primitive กลางสำหรับวาดเอกสาร PDF ทุกใบที่ออกจากระบบ
 * (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน / ใบสรุปโอนส่วนแบ่ง)
 *
 * ── ระบบพิกัด ────────────────────────────────────────────────────────────────
 * ทุกค่า y ในไฟล์นี้และใน `quote-doc.ts` คือ **ระยะจากขอบบนหน้ากระดาษลงมาถึง
 * เส้นฐาน (baseline) ของตัวอักษร** หน่วย pt เพิ่มลงล่าง — ตรงกับที่วัดจากไฟล์
 * ต้นแบบ Illustrator มาโดยตรง แปลงเป็นพิกัดของ pdf-lib (นับจากล่างขึ้นบน)
 * ที่จุดเดียวใน `draw()`
 *
 * เดิมไฟล์นี้เก็บเคอร์เซอร์เป็น "ขอบบนกล่อง" แล้วแปลงเป็น baseline ด้วย
 * `heightAtSize()` ซึ่งทำให้ตำแหน่งขึ้นกับ metric ของฟอนต์และเทียบกับต้นแบบไม่ได้
 * ตอนนี้ค่าที่เขียนในโค้ดคือค่าที่วัดได้จริงจากต้นแบบ ไม่มีการคำนวณคั่นกลาง
 *
 * ⚠️ **ห้ามเรียก page.drawText() นอกไฟล์นี้**
 *
 * ── ค่าที่วัดจากต้นแบบ (dhammadha-web fix list/template.pdf) ─────────────────
 * หน้า A4 595.28 × 841.89 · ขอบซ้าย/ขวา 59.53 · เนื้อหากว้าง 476.22
 * ตัวอักษร 10pt leading 15pt · หัวผู้ออก 16pt · ชื่อเอกสาร 28pt
 * สีเน้น #080808 (เดิม navy #1B1428) · เนื้อความ #1A1919 · เทา #747777 · เส้นคั่นดำ 1pt
 */

import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import type { RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/* ------------------------------------------------------------------------ */
/* Geometry                                                                  */
/* ------------------------------------------------------------------------ */

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

export const CONTENT_W = 476.22;
export const MARGIN_X = (PAGE_W - CONTENT_W) / 2; // 59.53
export const CONTENT_RIGHT = MARGIN_X + CONTENT_W;
export const MARGIN_BOTTOM = MARGIN_X;

/** baseline ของบรรทัดแรกสุดในหน้า (หัวผู้ออกเอกสาร) */
export const FIRST_BASELINE = 59;

/** leading มาตรฐาน — ต้นแบบใช้ 10pt/15pt = 1.5 เท่าทุกบรรทัด */
export const LEAD = 15;

export const COLOR = {
  /**
   * สีเน้น: ชื่อผู้ออกเอกสาร, ชื่อเอกสาร, ป้ายกำกับ, ตัวเลขเงิน, พื้นแถบยอดชำระ, ชื่อผู้เซ็น
   *
   * เดิมเป็น navy #1B1428 (วัดจากต้นแบบ) — เปลี่ยนเป็น #080808 ตอนแยกแบรนด์ typedee
   * (7 ส.ค. 2569) เพราะ palette ใหม่เลิกใช้ navy ทั้งระบบ ตัวอักษรดำใช้ 080808 ตัวเดียว
   *
   * ⚠️ เอกสารถูกเรนเดอร์ใหม่ทุกครั้งที่เปิด → **ใบที่ออกไปแล้วเปลี่ยนสีตามย้อนหลังด้วย**
   * (ตัวข้อความไม่เปลี่ยน เพราะถูก freeze ไว้ใน `quotes.fonts_detail` ตั้งแต่ตอนออกใบ)
   */
  heading: rgb(0x08 / 255, 0x08 / 255, 0x08 / 255),
  text: rgb(0x1a / 255, 0x19 / 255, 0x19 / 255),
  grey: rgb(0x74 / 255, 0x77 / 255, 0x77 / 255),
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  red: rgb(0xc0 / 255, 0x39 / 255, 0x2b / 255),
} satisfies Record<string, RGB>;

export const SZ = {
  issuer: 16,
  title: 28,
  body: 10,
};

/* ------------------------------------------------------------------------ */
/* Fonts                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * บทบาทของฟอนต์ตามสเปกต้นแบบ
 *  - `sans`       Noto Sans Thai Bold — หัวข้อ ป้าย ตัวเลข ชื่อรายการ
 *  - `looped`     Noto Sans Thai Looped Regular — เนื้อความทั้งหมด
 *  - `loopedBold` Noto Sans Thai Looped Bold — ค่าของ "เรื่อง"
 * (ต้นแบบไม่ใช้ Noto Sans Thai แบบธรรมดาเลย ใช้เฉพาะตัวหนา)
 */
export type FontRole = "sans" | "looped" | "loopedBold";

export type DocFontBytes = {
  sans: ArrayBuffer;
  looped: ArrayBuffer;
  loopedBold: ArrayBuffer;
};

const FONT_URL: Record<FontRole, string> = {
  sans: "/fonts/pdf/NotoSansThai-Bold.ttf",
  looped: "/fonts/pdf/NotoSansThaiLooped-Regular.ttf",
  loopedBold: "/fonts/pdf/NotoSansThaiLooped-Bold.ttf",
};

let fontPromise: Promise<DocFontBytes> | null = null;

/**
 * โหลดฟอนต์จาก /public — **ใช้ได้เฉพาะในเบราว์เซอร์** (fetch แบบ relative URL)
 *
 * ตัววาดไม่เรียกฟังก์ชันนี้เอง แต่รับ `DocFontBytes` เข้ามา เพื่อให้ฝั่ง server
 * (Cloudflare Pages Function ที่รับ Stripe webhook) ส่ง bytes ที่ฝังมากับ bundle
 * เข้ามาแทนได้ โดยไม่ต้องแก้ตัววาด
 */
export function loadDocFonts(): Promise<DocFontBytes> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const roles = Object.keys(FONT_URL) as FontRole[];
      const bufs = await Promise.all(
        roles.map(async (r) => {
          const res = await fetch(FONT_URL[r]);
          if (!res.ok) throw new Error(`Failed to load font "${FONT_URL[r]}": ${res.status}`);
          return res.arrayBuffer();
        }),
      );
      return Object.fromEntries(roles.map((r, i) => [r, bufs[i]])) as DocFontBytes;
    })().catch((err) => {
      // อย่า cache promise ที่ fail ไว้ — ไม่งั้นกด retry ยังไงก็เจอ error เดิมจนกว่าจะ reload
      fontPromise = null;
      throw err;
    });
  }
  return fontPromise;
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

/** จำนวนเงินรูปแบบไทย ทศนิยม 2 ตำแหน่งเสมอ — ตรึง locale ไม่ให้ขึ้นกับเครื่องผู้ใช้ */
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

function segmentThai(text: string): string[] {
  const S = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!S) return [text];
  try {
    return Array.from(new S("th", { granularity: "word" }).segment(text), (s) => s.segment);
  } catch {
    return [text];
  }
}

/**
 * ตัดข้อความให้พอดีความกว้าง
 *
 * ภาษาไทยไม่มีช่องว่างระหว่างคำ จึงใช้ตัวตัดคำของ ICU ก่อน แล้วค่อย fallback
 * เป็นตัดทีละอักขระแบบไม่แยกสระ/วรรณยุกต์ออกจากพยัญชนะ
 */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let current = "";
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;

  const hardBreak = (word: string): string => {
    const chars = Array.from(word);
    let chunk = "";
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const next = chars[i + 1] ?? "";
      const badBreak = THAI_COMBINING.test(next) || THAI_LEADING_VOWEL.test(ch);
      if (chunk && !badBreak && !fits(chunk + ch)) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    return chunk;
  };

  const words = text.split(" ").flatMap((w, i) => {
    const parts = /[฀-๿]/.test(w) ? segmentThai(w) : [w];
    return i === 0 ? parts : [" ", ...parts];
  });

  for (const word of words) {
    if (!word) continue;
    if (fits(current + word)) { current += word; continue; }
    if (current) { lines.push(current.trimEnd()); current = ""; }
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
  /** ขอบซ้ายของข้อความ (ค่าเริ่มต้น = ขอบซ้ายเนื้อหา) */
  x?: number;
  /** ชิดขวาโดยให้ขอบขวาของข้อความอยู่ที่ค่านี้ */
  right?: number;
  /** จัดกึ่งกลางระหว่าง [from, to] */
  center?: [number, number];
  size?: number;
  font?: FontRole;
  color?: RGB;
  /** ตัดบรรทัดเมื่อกว้างเกินค่านี้ */
  maxWidth?: number;
  /** ระยะบรรทัดเมื่อตัดหลายบรรทัด (ค่าเริ่มต้น LEAD) */
  lead?: number;
};

/**
 * ตัวช่วยวาดเอกสาร — `y` คือ baseline ของบรรทัดถัดไป นับจากขอบบนหน้ากระดาษ
 *
 * ผู้เรียกเลื่อน `y` เองด้วยค่าที่วัดมาจากต้นแบบ (ดู `quote-doc.ts`) คลาสนี้
 * ไม่เดาระยะห่างให้
 */
export class DocWriter {
  readonly doc: PDFDocument;
  private readonly fonts: Record<FontRole, PDFFont>;
  page: PDFPage;
  /** baseline ของบรรทัดถัดไป (จากขอบบน) */
  y = FIRST_BASELINE;
  /** ขอบล่างของบล็อกที่วาดล่าสุด — ใช้วางบล็อกลายเซ็น */
  blockBottom = FIRST_BASELINE;
  private onNewPage: (() => void) | null = null;

  private constructor(doc: PDFDocument, fonts: Record<FontRole, PDFFont>) {
    this.doc = doc;
    this.fonts = fonts;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
  }

  static async create(bytes: DocFontBytes): Promise<DocWriter> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const roles = ["sans", "looped", "loopedBold"] as const;
    const embedded = await Promise.all(roles.map((r) => doc.embedFont(bytes[r], { subset: true })));
    return new DocWriter(doc, Object.fromEntries(roles.map((r, i) => [r, embedded[i]])) as Record<FontRole, PDFFont>);
  }

  fontFor(role: FontRole = "looped"): PDFFont {
    return this.fonts[role];
  }

  widthOf(text: string, size = SZ.body, role: FontRole = "looped"): number {
    return this.fonts[role].widthOfTextAtSize(text, size);
  }

  /** ขึ้นหน้าใหม่ถ้า baseline ที่จะวาดเลยขอบล่าง */
  ensureSpace(needed = 0): void {
    if (this.y + needed <= PAGE_H - MARGIN_BOTTOM) return;
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = FIRST_BASELINE;
    this.blockBottom = FIRST_BASELINE;
    this.onNewPage?.();
  }

  /** ตั้ง callback วาดหัวตารางซ้ำตอนขึ้นหน้าใหม่ (null = ยกเลิก) */
  setPageHeader(fn: (() => void) | null): void {
    this.onNewPage = fn;
  }

  private xFor(text: string, o: TextOpts): number {
    const size = o.size ?? SZ.body;
    const role = o.font ?? "looped";
    if (o.right !== undefined) return o.right - this.widthOf(text, size, role);
    if (o.center) return o.center[0] + (o.center[1] - o.center[0] - this.widthOf(text, size, role)) / 2;
    return o.x ?? MARGIN_X;
  }

  /** วาดข้อความที่ baseline ที่ระบุ โดยไม่ขยับเคอร์เซอร์ */
  drawAt(text: string, baseline: number, o: TextOpts = {}): void {
    if (!text) return;
    this.page.drawText(text, {
      x: this.xFor(text, o),
      y: PAGE_H - baseline, // จุดเดียวที่แปลงเป็นพิกัดของ pdf-lib
      size: o.size ?? SZ.body,
      font: this.fontFor(o.font),
      color: o.color ?? COLOR.text,
    });
  }

  /** วาดข้อความที่เคอร์เซอร์แล้วเลื่อนลงหนึ่งบรรทัด (ตัดบรรทัดให้ถ้ากำหนด maxWidth) */
  text(text: string, o: TextOpts = {}): void {
    if (!text) return;
    const lead = o.lead ?? LEAD;
    const lines = o.maxWidth
      ? wrapText(text, this.fontFor(o.font), o.size ?? SZ.body, o.maxWidth)
      : [text];
    for (const ln of lines) {
      this.ensureSpace();
      this.drawAt(ln, this.y, o);
      this.blockBottom = this.y;
      this.y += lead;
    }
  }

  /** เส้นแนวนอน — `top` คือระยะจากขอบบนหน้า */
  rule(top: number, from = MARGIN_X, to = CONTENT_RIGHT, thickness = 1, color: RGB = COLOR.black): void {
    this.page.drawLine({
      start: { x: from, y: PAGE_H - top },
      end: { x: to, y: PAGE_H - top },
      thickness,
      color,
    });
    this.blockBottom = top;
  }

  /** แถบสีเต็มความกว้างเนื้อหา — `top` คือขอบบนของแถบ */
  bar(top: number, height: number, color: RGB = COLOR.heading): void {
    this.page.drawRectangle({
      x: MARGIN_X,
      y: PAGE_H - top - height,
      width: CONTENT_W,
      height,
      color,
    });
    this.blockBottom = top + height;
  }

  save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

/* ------------------------------------------------------------------------ */
/* บล็อกที่ใช้ร่วมทุกเอกสาร                                                    */
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

/** ระยะที่วัดจากต้นแบบ — baseline นับจากขอบบนหน้ากระดาษ */
export const M = {
  /** หัวผู้ออกเอกสาร */
  issuerName: 59,
  issuerMeta1: 78,
  headerRule: 122,

  /** แถวหัวเรื่อง */
  metaLabel1: 155,
  metaLabel2: 170,
  metaLabelX: MARGIN_X + 361.59,
  metaValueX: MARGIN_X + 396.59,
  title: 163,

  /** ผู้รับ */
  recipientFirst: 191,
  salutLabelX: MARGIN_X + 1.48,
  salutBodyX: MARGIN_X + 36.48,
  /** ระยะจากบรรทัดสุดท้ายของบล็อกผู้รับ ถึงขอบบนแถบหัวตาราง */
  recipientToTable: 25.04,

  /** ตาราง */
  barH: 26.929,
  /** baseline ของตัวหนังสือในแถบสี นับจากขอบบนแถบ */
  barTextOffset: 16.58,
  colIndexRight: MARGIN_X + 46.215,
  /** ขอบซ้ายคอลัมน์ "รายละเอียด" (= เส้นแบ่งคอลัมน์ + 0.9) */
  colNameX: MARGIN_X + 47.11,
  colPriceLeft: MARGIN_X + 396.85,
  priceRight: CONTENT_RIGHT - 11.16,
  /** ขอบล่างแถบหัวตาราง → baseline รายการแรก */
  tableToFirstItem: 22.65,
  /** baseline บรรทัดสุดท้ายของรายการก่อนหน้า → baseline ชื่อรายการถัดไป */
  itemToItem: 25,
  /** baseline บรรทัดสุดท้ายของรายการสุดท้าย → เส้นคั่นใต้ตาราง */
  itemsToRule: 16.88,

  /** ยอดรวม */
  ruleToTotals: 21.12,
  totalRowGap: 18,
  totalLabelRight: MARGIN_X + 395.7,
  /** baseline แถวยอดรวมสุดท้าย → ขอบบนแถบยอดชำระ */
  totalsToBar: 14.42,

  /** รายละเอียดการชำระเงิน */
  barToBank: 33.03,
  bankValueX: MARGIN_X + 56,

  /** ลายเซ็น */
  toSignature: 66.5,
  sigLineX: MARGIN_X + 359.72,
  sigLineW: 116.5,
  sigLineToName: 17.5,
} as const;

/**
 * หัวเอกสาร: ชื่อผู้ออก / ผู้ดำเนินการ + เลขผู้เสียภาษี / ที่อยู่ / ช่องทางติดต่อ
 * ปิดท้ายด้วยเส้นคั่น — วางที่ baseline ตายตัวตามต้นแบบ
 */
export function drawIssuerHeader(w: DocWriter, issuer: DocIssuer): void {
  w.drawAt(issuer.business_name || issuer.name || "", M.issuerName, {
    size: SZ.issuer,
    font: "sans",
    color: COLOR.heading,
  });

  const meta: string[] = [];
  const by: string[] = [];
  if (issuer.name && issuer.business_name && issuer.name !== issuer.business_name) by.push(`โดย ${issuer.name}`);
  if (issuer.tax_id) by.push(`หมายเลขประจำตัวผู้เสียภาษี ${issuer.tax_id}`);
  if (by.length) meta.push(by.join(" "));
  if (issuer.address) meta.push(issuer.address);
  const contact: string[] = [];
  if (issuer.phone) contact.push(`โทรศัพท์ ${issuer.phone}`);
  if (issuer.email) contact.push(`Email : ${issuer.email}`);
  if (contact.length) meta.push(contact.join(" / "));

  w.y = M.issuerMeta1;
  for (const line of meta) w.text(line, { maxWidth: CONTENT_W });

  w.rule(M.headerRule);
}

/** แถวหัวเรื่อง: ชื่อเอกสารทางซ้าย + เลขที่/วันที่ทางขวา */
export function drawTitleRow(w: DocWriter, title: string, rows: Array<[string, string]>): void {
  w.drawAt(title, M.title, { size: SZ.title, font: "sans", color: COLOR.heading });
  let baseline = M.metaLabel1;
  for (const [label, value] of rows) {
    w.drawAt(label, baseline, { x: M.metaLabelX, font: "sans", color: COLOR.heading });
    w.drawAt(value, baseline, { x: M.metaValueX, font: "looped" });
    baseline += LEAD;
  }
}

/**
 * แถวป้าย/ค่า สองคอลัมน์ (บล็อกรายละเอียดการชำระเงิน, งวดในใบสรุปโอนส่วนแบ่ง)
 * ป้ายเป็นสีเดียวกับเนื้อความ ไม่ใช่สีเน้น — วัดจากต้นแบบแล้วเป็น #1A1919
 */
export function drawLabelValue(w: DocWriter, label: string, value: string, valueX: number): void {
  w.drawAt(label, w.y, { font: "sans", color: COLOR.text });
  w.drawAt(value, w.y, { x: valueX, font: "looped" });
  w.blockBottom = w.y;
  w.y += LEAD;
}

/**
 * แถวยอดรวมเหนือแถบสีเน้น (รวมจำนวนเงิน / ส่วนลด / หักภาษี ณ ที่จ่าย)
 * ป้ายชิดขวาที่แกน `totalLabelRight` ตัวเลขชิดขวาแกนเดียวกับคอลัมน์ราคา
 *
 * ใช้ร่วมกันระหว่างใบเสนอราคาและใบสรุปโอนส่วนแบ่ง — ทั้งสองใบต้องเรียงยอด
 * หน้าตาเหมือนกัน ถ้าแยกกันเขียนจะเพี้ยนคนละแบบเหมือนที่เคยเกิดกับตัวเรนเดอร์เอกสาร
 */
export function drawTotalRow(
  w: DocWriter,
  label: string,
  value: string,
  color = COLOR.text,
): void {
  w.ensureSpace();
  w.drawAt(label, w.y, { right: M.totalLabelRight, font: "sans", color: COLOR.text });
  w.drawAt(value, w.y, { right: M.priceRight, font: "sans", color });
  w.blockBottom = w.y;
  w.y += M.totalRowGap;
}

/**
 * แถบยอดชำระพื้นสีเน้น — ป้ายชิดขวาแกนเดียวกับป้ายยอดรวม, ยอดชิดขวาแกนเดียวกับ
 * ตัวเลข, ตัวหนังสือจำนวนเงินจัดกึ่งกลางระหว่างขอบซ้ายแถบกับป้าย
 */
export function drawTotalBar(w: DocWriter, label: string, amount: string, inWords: string): void {
  const top = w.y;
  w.ensureSpace(M.barH);
  w.bar(top, M.barH);
  const baseline = top + M.barTextOffset;

  const labelX = M.totalLabelRight - w.widthOf(label, SZ.body, "sans");
  w.drawAt(label, baseline, { right: M.totalLabelRight, font: "sans", color: COLOR.white });
  w.drawAt(amount, baseline, { right: M.priceRight, font: "sans", color: COLOR.white });
  if (inWords) {
    w.drawAt(`(${inWords})`, baseline, { center: [MARGIN_X, labelX], font: "looped", color: COLOR.white });
  }
  w.y = top + M.barH;
}

/** บล็อกลายเซ็นมุมขวาล่าง — เส้น ชื่อ และคำลงท้าย จัดกึ่งกลางบนเส้น */
export function drawSignature(w: DocWriter, name: string, role: string): void {
  const lineTop = w.blockBottom + M.toSignature;
  w.ensureSpace(lineTop - w.y + LEAD * 2);
  const top = w.y > lineTop ? w.y + M.toSignature : lineTop;

  w.rule(top, M.sigLineX, M.sigLineX + M.sigLineW);
  const span: [number, number] = [M.sigLineX, M.sigLineX + M.sigLineW];
  w.drawAt(name, top + M.sigLineToName, { center: span, font: "sans", color: COLOR.heading });
  w.drawAt(`(${role})`, top + M.sigLineToName + LEAD, { center: span, font: "looped" });
  w.y = top + M.sigLineToName + LEAD * 2;
}
