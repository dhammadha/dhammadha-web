/**
 * หนังสือรับรองการหักภาษี ณ ที่จ่าย (ใบ 50 ทวิ)
 *
 * **ไม่ได้วาดฟอร์มเอง** — กรอกลงแบบฟอร์มจริงของกรมสรรพากรที่เป็น AcroForm
 * (`public/forms/wh3.pdf` จาก rd.go.th `approve_wh3_081156.pdf`) แล้ว flatten
 * ได้ฟอร์มที่ถูกต้องตามราชการ 100% โดยไม่ต้องไล่วัดพิกัดเอง
 *
 * ── ทำไมไม่ใช้กลไก form กรอกข้อความ ─────────────────────────────────────────
 *
 * **ใช้ฟอร์มแค่ติ๊ก checkbox เท่านั้น ข้อความทุกช่องวาดเอง** เพราะ:
 *
 * 1. **ฟอนต์** ฟอร์มต้นฉบับมีแค่ Helvetica / MicrosoftSansSerif ไม่มีฟอนต์ไทย
 *    ถ้าใช้ `setText` ต้อง `form.updateFieldAppearances(ฟอนต์ไทย)` ตามทุกครั้ง
 *    ลืมเมื่อไรภาษาไทยกลายเป็นกล่องหรือหายทั้งช่อง
 *
 * 2. **กรอบ widget สูงไม่เท่ากัน** pdf-lib จัดข้อความกึ่งกลางกรอบ ซึ่งในฟอร์มนี้
 *    ช่องที่อยู่บรรทัดเดียวกันกลับสูงคนละอย่าง (`date_pay` 15.2 · `month_pay` 16.7
 *    · `year_pay` 14.4) ผลคือ baseline ไม่ตรงแถวกันทั้งที่ควรอยู่ระดับเดียวกัน
 *
 * 3. **comb field** ช่องเลขประจำตัว (`id1`, `id1_2`) เป็น comb — ฟอร์มพิมพ์กล่องย่อย
 *    ไว้แล้วบังคับตัวอักษรตัวละกล่อง แต่ **pdf-lib ไม่รองรับ comb** เลขจึงไม่ลงกล่อง
 *
 * 4. **คอลัมน์ บาท|สตางค์** ฟอร์มขีดเส้นแบ่งกลางกรอบ แต่เป็น text field ตัวเดียว
 *    ปล่อยให้ align=R ทศนิยมจะคร่อมเส้น
 *
 * วาดเองทั้งหมดจึงคุมได้ด้วยกฎเดียว + `NUDGE` เฉพาะช่องที่ฟอร์มวางกรอบเพี้ยน
 *
 * ⚠️ `flatten()` เสมอ — เอกสารภาษีต้องแก้ไขต่อไม่ได้
 */

import { PDFDocument, PDFName, PDFNumber, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { bahtText } from "./baht-text";

/* ------------------------------------------------------------------------ */
/* ที่มาของค่าคงที่                                                            */
/* ------------------------------------------------------------------------ */

const FORM_URL = "/forms/wh3.pdf";
const FONT_URL = "/fonts/pdf/NotoSansThaiLooped-Regular.ttf";

/** ขนาดตัวอักษรทุกช่อง — เจ้าของกำหนด looped regular 8pt */
const FONT_SIZE = 8;

/**
 * ความกว้างคอลัมน์ "สตางค์" นับจากขอบขวาของกรอบจำนวนเงิน
 *
 * วัดจากเส้นแนวตั้งใน content stream ของฟอร์มจริง: คอลัมน์ "จำนวนเงินที่จ่าย"
 * มีเส้นที่ x=475 ขอบขวา 489.9 · คอลัมน์ "ภาษีที่หัก" เส้นที่ x=546.4 ขอบขวา ~561
 * → ช่องสตางค์กว้าง ~15pt เท่ากันทั้งสองคอลัมน์
 */
const SATANG_W = 15;

/**
 * ค่าชดเชยตำแหน่งรายช่อง (pt) — `dy` บวก = ขยับขึ้น · `dx` บวก = ขยับขวา
 *
 * ⚠️ **ค่าพวกนี้ยืนยันด้วยสายตาจากฟอร์มจริง ไม่ได้วัดจากไฟล์ต้นแบบ**
 * ต่างจากใบเสนอราคา/ใบสรุปโอนที่ `CLAUDE.md` ห้ามปรับด้วยสายตาเด็ดขาด —
 * ใบพวกนั้นมีไฟล์ Illustrator ให้วัด แต่ฟอร์มราชการ **ตัวฟอร์มเองคือต้นแบบ**
 * และเส้นประใต้ช่องเป็น "ตัวอักษรจุด" ที่พิมพ์ไว้ ไม่ใช่ path (ทั้งหน้ามีเส้น
 * เวกเตอร์แค่ 4 เส้น ซึ่งเป็นเส้นแบ่งคอลัมน์เงิน) จึงไม่มีพิกัดเส้นให้ยึด
 *
 * ที่มาของแต่ละค่า: รอบตรวจตัวอย่าง 1 ส.ค. 2569
 */
const NUDGE: Record<string, { dx?: number; dy?: number }> = {
  add2: { dy: 2 }, // ที่อยู่ผู้ถูกหักชิดเส้นประเกินไป
  date_pay: { dy: 2 },
  // กรอบ month_pay (x 363.6) ล้ำกรอบ date_pay (จบที่ x 366.0) อยู่ 2.4pt
  // ทำให้ชื่อเดือนไปทับ "/" ที่ฟอร์มพิมพ์คั่นไว้ระหว่างวันกับเดือน
  month_pay: { dy: 2, dx: 10 },
  year_pay: { dy: 2 },
};

/**
 * ชื่อ field ในฟอร์มราชการ — ชื่อจริงอ่านไม่รู้เรื่อง (`pay1.13.0`, `chk4`)
 * ถ้าไม่จดไว้ตรงนี้จะไม่มีใครแก้ต่อได้
 *
 * ช่องที่ **จงใจเว้นว่าง** (เจ้าของสั่ง): `book_no` เล่มที่ · `tin1`/`tin1_2`
 * เลขประจำตัวผู้เสียภาษี (ซ้ำกับ `id1`) · `item` ลำดับที่ในแบบยื่น ·
 * `spec1`/`spec3`/`spec4` ช่องระบุ · `Text1.*`
 */
const F = {
  /** เลขที่หนังสือ — `WT-2569-0001` ฟอร์แมตเดียวกับใบเสนอราคา */
  certNo: "run_no",

  // ── ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (แพลตฟอร์ม) ──
  payerId: "id1", // comb 17 ช่อง = 13 หลัก + ขีด 4
  payerName: "name1",
  payerAddress: "add1",

  // ── ผู้ถูกหักภาษี ณ ที่จ่าย (designer) ──
  payeeId: "id1_2", // comb 17 ช่อง
  payeeName: "name2",
  payeeAddress: "add2",

  // ── ประเภทแบบยื่นรายการ (ติ๊กช่องเดียว) ──
  formPnd3: "chk4", // (4) ภ.ง.ด.3 — ผู้รับเงินเป็นบุคคลธรรมดา
  formPnd53: "chk7", // (7) ภ.ง.ด.53 — ผู้รับเงินเป็นนิติบุคคล

  // ── แถวเงินได้ + แถวรวม ──
  rowDate: "date14.0",
  rowPaid: "pay1.13.0",
  rowTax: "tax1.13.0",
  totalPaid: "pay1.14",
  totalTax: "tax1.14",
  /** ภาษีที่หักนำส่งเป็นตัวอักษร */
  totalInWords: "total",

  // ── วิธีการหักภาษี ──
  methodWithheld: "chk8", // (1) หัก ณ ที่จ่าย

  // ── วันที่ออกหนังสือ ──
  issueDay: "date_pay", // MaxLen 2
  issueMonth: "month_pay",
  issueYear: "year_pay", // MaxLen 4
} as const;

/**
 * แถวเงินได้ที่ใช้ = **มาตรา 3 เตรส** (ยื่น ภ.ง.ด.3 / ภ.ง.ด.53 หัก 3%)
 *
 * ⚠️ **ยังรอ CPA ยืนยัน** — ตามตัวอักษรแล้วส่วนแบ่งค่าลิขสิทธิ์ฟอนต์เข้าข่าย
 * เงินได้ 40(3) ซึ่งต้องยื่น **ภ.ง.ด.2** และคำนวณอัตราก้าวหน้า แต่ตลาดใช้
 * 3 เตรส/3% กันเป็นมาตรฐานเพราะทำเอกสารง่ายกว่ามาก
 *
 * ถ้า CPA ตอบว่าต้องเป็น 40(3) จริง ให้แก้ที่ `F.rowDate/rowPaid/rowTax`
 * กับ `F.formPnd3/formPnd53` ที่เดียว — ตัววาดด้านล่างไม่ต้องแตะ
 */
export const WHT_INCOME_BASIS = "3 เตรส" as const;

/* ------------------------------------------------------------------------ */
/* Public types                                                              */
/* ------------------------------------------------------------------------ */

export type WhtCertParty = {
  name: string;
  /** เลข 13 หลัก (มีขีดหรือไม่มีก็ได้ — จัดรูปแบบให้เอง) */
  taxId?: string | null;
  address?: string | null;
};

export type WhtCertData = {
  /** `WT-2569-0001` */
  certNo: string;
  payer: WhtCertParty;
  payee: WhtCertParty & {
    /** true → ติ๊ก ภ.ง.ด.53 · false → ภ.ง.ด.3 (มาจาก `users.entity_type`) */
    isJuristic: boolean;
  };
  /** ISO — วันที่จ่ายเงิน (ลงในแถวเงินได้) */
  paidAt: string;
  /** ISO — วันที่ออกหนังสือ (ไม่ส่งมา = ใช้ `paidAt`) */
  issuedAt?: string;
  /** จำนวนเงินที่จ่าย (ยอดเต็มก่อนหัก) */
  amount: number;
  /** ภาษีที่หักไว้ */
  whtAmount: number;
};

export type WhtCertAssets = { form: ArrayBuffer; font: ArrayBuffer };

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** `1849900005733` → `1-8499-00005-73-3` (17 ตัวพอดีกับ comb ของฟอร์ม) */
export function formatThaiId(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 13) return d;
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}

/** `10000` → `["10,000", "00"]` — แยกไว้ลงคนละฝั่งของเส้นแบ่งในฟอร์ม */
function splitMoney(n: number): [string, string] {
  const fixed = Math.abs(n).toFixed(2);
  const [baht, satang] = fixed.split(".");
  return [Number(baht).toLocaleString("en-US"), satang];
}

/** โหลดฟอร์ม + ฟอนต์จาก /public — ใช้ได้เฉพาะในเบราว์เซอร์ (fetch relative URL) */
export async function loadWhtCertAssets(): Promise<WhtCertAssets> {
  const [form, font] = await Promise.all(
    [FORM_URL, FONT_URL].map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`โหลด ${url} ไม่สำเร็จ: ${res.status}`);
      return res.arrayBuffer();
    }),
  );
  return { form, font };
}

type Rect = { x: number; y: number; width: number; height: number };

/** การจัดข้อความของ field ตาม `/Q` ในฟอร์ม: 0 ชิดซ้าย · 1 กึ่งกลาง · 2 ชิดขวา */
type Align = 0 | 1 | 2;

/** พิกัด/รูปแบบของช่องหนึ่ง อ่านจากฟอร์มไว้ก่อน flatten */
type FieldBox = { rect: Rect; maxLen: number; align: Align };

/** ตัววาดที่ผูกกับหน้า/ฟอนต์ไว้แล้ว — ทุกช่องผ่านตัวนี้ จะได้ baseline กฎเดียวกัน */
type Pen = {
  /** ข้อความธรรมดา — เคารพการจัดข้อความที่ฟอร์มกำหนดไว้เอง */
  text(field: string, box: FieldBox, value: string): void;
  /** วางทีละตัวอักษรกลางกล่องย่อยของ comb field */
  comb(field: string, box: FieldBox, value: string): void;
  /** แยก บาท / สตางค์ ไปคนละฝั่งของเส้นแบ่งที่ฟอร์มขีดไว้ */
  money(field: string, box: FieldBox, amount: number): void;
};

function makePen(page: PDFPage, font: PDFFont): Pen {
  /**
   * baseline กลางกรอบ + ชดเชยรายช่อง
   * `FONT_SIZE * 0.18` ชดเชยส่วนหางตัวอักษรใต้ baseline ให้ดูกึ่งกลางจริง
   */
  const baseline = (field: string, rect: Rect) =>
    rect.y + (rect.height - FONT_SIZE) / 2 + FONT_SIZE * 0.18 + (NUDGE[field]?.dy ?? 0);
  const originX = (field: string, rect: Rect) => rect.x + (NUDGE[field]?.dx ?? 0);
  const put = (text: string, x: number, y: number) =>
    page.drawText(text, { x, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });

  return {
    text(field, { rect, align }, value) {
      if (!value) return;
      // ⚠️ ต้องเคารพ `/Q` ของฟอร์ม — ช่องอย่าง `date14.0` ถูกตั้งให้กึ่งกลางไว้
      // ถ้าวาดชิดซ้ายหมดทุกช่องจะเพี้ยนจากที่ฟอร์มออกแบบมา
      const w = font.widthOfTextAtSize(value, FONT_SIZE);
      const slack = rect.width - w;
      const dx = align === 1 ? slack / 2 : align === 2 ? slack : 0;
      put(value, originX(field, rect) + dx, baseline(field, rect));
    },
    comb(field, { rect, maxLen }, text) {
      const cellW = rect.width / maxLen;
      const y = baseline(field, rect);
      const x0 = originX(field, rect);
      for (let i = 0; i < text.length && i < maxLen; i++) {
        const ch = text[i];
        put(ch, x0 + cellW * i + (cellW - font.widthOfTextAtSize(ch, FONT_SIZE)) / 2, y);
      }
    },
    money(field, { rect }, amount) {
      const [baht, satang] = splitMoney(amount);
      const y = baseline(field, rect);
      const dividerX = rect.x + rect.width - SATANG_W;
      // บาท ชิดขวาชนเส้นแบ่ง เว้นระยะหายใจเล็กน้อย
      put(baht, dividerX - 3 - font.widthOfTextAtSize(baht, FONT_SIZE), y);
      // สตางค์ กึ่งกลางช่องหลังเส้นแบ่ง
      put(satang, dividerX + (SATANG_W - font.widthOfTextAtSize(satang, FONT_SIZE)) / 2, y);
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Main                                                                      */
/* ------------------------------------------------------------------------ */

export async function generateWhtCertPdf(
  data: WhtCertData,
  assets?: WhtCertAssets,
): Promise<Uint8Array> {
  const { form: formBytes, font: fontBytes } = assets ?? (await loadWhtCertAssets());

  const doc = await PDFDocument.load(formBytes, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);
  const thai = await doc.embedFont(fontBytes, { subset: true });
  const form = doc.getForm();
  const page = doc.getPage(0);

  const paid = new Date(data.paidAt);
  const issued = new Date(data.issuedAt ?? data.paidAt);
  const beYear = (d: Date) => d.getFullYear() + 543;

  /* ── เก็บพิกัดกรอบไว้ก่อน flatten (หลัง flatten widget หายไปแล้ว) ────── */
  const boxOf = (name: string): FieldBox => {
    const field = form.getTextField(name);
    const num = (key: string) => {
      const v = field.acroField.dict.lookup(PDFName.of(key));
      return v instanceof PDFNumber ? v.asNumber() : 0;
    };
    return {
      rect: field.acroField.getWidgets()[0].getRectangle(),
      maxLen: num("MaxLen"),
      align: (num("Q") as Align) ?? 0,
    };
  };

  const texts: Array<[string, string]> = [
    [F.certNo, data.certNo],
    [F.payerName, data.payer.name],
    [F.payerAddress, data.payer.address ?? ""],
    [F.payeeName, data.payee.name],
    [F.payeeAddress, data.payee.address ?? ""],
    [F.rowDate, `${paid.getDate()}/${paid.getMonth() + 1}/${beYear(paid)}`],
    [F.totalInWords, bahtText(data.whtAmount)],
    [F.issueDay, String(issued.getDate())],
    [F.issueMonth, THAI_MONTHS[issued.getMonth()]],
    [F.issueYear, String(beYear(issued))],
  ];
  const combs: Array<[string, string]> = [
    [F.payerId, formatThaiId(data.payer.taxId)],
    [F.payeeId, formatThaiId(data.payee.taxId)],
  ];
  const monies: Array<[string, number]> = [
    [F.rowPaid, data.amount],
    [F.totalPaid, data.amount],
    [F.rowTax, data.whtAmount],
    [F.totalTax, data.whtAmount],
  ];

  const layout = new Map<string, FieldBox>();
  for (const name of [...texts, ...combs, ...monies].map(([n]) => n)) {
    layout.set(name, boxOf(name));
  }

  /* ── ติ๊ก checkbox แล้วตรึงเอกสาร ─────────────────────────────────────── */
  // checkbox ใช้ appearance ZapfDingbats ของฟอร์มเอง จึงไม่ต้อง updateFieldAppearances
  form.getCheckBox(data.payee.isJuristic ? F.formPnd53 : F.formPnd3).check();
  form.getCheckBox(F.methodWithheld).check();
  form.flatten();

  /* ── วาดข้อความทั้งหมดเอง (หลัง flatten จะได้ไม่มีอะไรมาทับ) ──────────── */
  const pen = makePen(page, thai);
  for (const [name, value] of texts) pen.text(name, layout.get(name)!, value);
  for (const [name, id] of combs) if (id) pen.comb(name, layout.get(name)!, id);
  for (const [name, amount] of monies) pen.money(name, layout.get(name)!, amount);

  return doc.save();
}
