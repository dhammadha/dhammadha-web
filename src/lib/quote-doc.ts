/**
 * Client-side PDF generation for Thai quotation (ใบเสนอราคา) and receipt
 * (ใบเสร็จรับเงิน) documents.
 *
 * This is a faithful pdf-lib port of the HTML/print layout defined in
 * `src/components/admin/PrintLightbox.tsx`. Content, labels, ordering, and
 * math mirror that component exactly. Only runs in the browser (uses
 * `fetch` to load embedded Thai fonts) — it is meant to be dynamically
 * imported from an admin page.
 */

import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import type { RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/* ------------------------------------------------------------------------ */
/* Public types                                                              */
/* ------------------------------------------------------------------------ */

export type QuoteDocItem = {
  name: string;
  license_type?: string | null;
  price: number;
};

export type QuoteDocSellerBank = {
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
};

export type QuoteDocSeller = {
  name?: string | null;
  business_name?: string | null;
  entity_type?: string | null;
  tax_id?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bank?: QuoteDocSellerBank | null;
};

export type QuoteDocData = {
  type: "quotation" | "receipt";
  doc_no: string;
  date: string; // already-formatted Thai locale date string
  contact_name: string;
  company_name?: string | null;
  address?: string | null;
  tax_id?: string | null;
  email?: string | null;
  note?: string | null;
  items: QuoteDocItem[];
  seller: QuoteDocSeller;
};

export { bahtText } from "./baht-text";
import { bahtText } from "./baht-text";

/* ------------------------------------------------------------------------ */
/* Font loading (cached at module level so repeat generations don't refetch) */
/* ------------------------------------------------------------------------ */

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
    // อย่า cache promise ที่ fail ไว้ — ไม่งั้นกด retry ยังไงก็เจอ error เดิมจนกว่าจะ reload
    regularFontPromise = null;
    boldFontPromise = null;
    throw err;
  }
}

/* ------------------------------------------------------------------------ */
/* Geometry / style constants                                                */
/* ------------------------------------------------------------------------ */

const MM = 2.8346456693; // pt per mm
const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;

// PrintLightbox uses padding: 28mm (top/bottom) 25mm (left/right)
const MARGIN_TOP = 28 * MM;
const MARGIN_BOTTOM = 28 * MM;
const MARGIN_X = 25 * MM;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// Tailwind arbitrary px values -> pt (96dpi css px -> 72pt)
const px = (n: number) => n * 0.75;

const COLOR = {
  navy: rgb(0x2b / 255, 0x1b / 255, 0x3d / 255), // tailwind.config.ts navy
  gray555: rgb(0x55 / 255, 0x55 / 255, 0x55 / 255),
  gray888: rgb(0x88 / 255, 0x88 / 255, 0x88 / 255),
  grayAAA: rgb(0xaa / 255, 0xaa / 255, 0xaa / 255),
  grayDDD: rgb(0xdd / 255, 0xdd / 255, 0xdd / 255),
  grayF0: rgb(0xf0 / 255, 0xf0 / 255, 0xf0 / 255),
  bgF8: rgb(0xf8 / 255, 0xf8 / 255, 0xf6 / 255),
  red500: rgb(0xef / 255, 0x44 / 255, 0x44 / 255),
  black: rgb(0.07, 0.07, 0.07),
} satisfies Record<string, RGB>;

const SZ = {
  headerName: px(15),
  headerSub: px(13),
  headerMeta: px(12),
  docTitle: px(20),
  buyer: px(13),
  docNo: px(13),
  note: px(13),
  th: px(13),
  td: px(13),
  tdSub: px(12),
  footLabel: px(13),
  footBaht: px(11),
  footTotal: px(16),
  bank: px(12),
  sigName: px(12),
  sigRole: px(11),
};

/* ------------------------------------------------------------------------ */
/* Text measuring / wrapping helper                                          */
/* ------------------------------------------------------------------------ */

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  const hardBreak = (word: string): string => {
    let chunk = "";
    for (const ch of word) {
      const attempt = chunk + ch;
      if (chunk && font.widthOfTextAtSize(attempt, size) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = attempt;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth) {
      current = attempt;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      current = hardBreak(word);
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/* ------------------------------------------------------------------------ */
/* Main entry point                                                          */
/* ------------------------------------------------------------------------ */

export async function generateQuotePdf(data: QuoteDocData): Promise<Uint8Array> {
  const { regular, bold } = await getFontBytes();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fontRegular = await pdfDoc.embedFont(regular, { subset: true });
  const fontBold = await pdfDoc.embedFont(bold, { subset: true });

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;

  const isReceipt = data.type === "receipt";
  const subtotal = data.items.reduce((s, i) => s + i.price, 0);
  const wht = Math.round(subtotal * 0.03);
  const total = subtotal - wht;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN_TOP;
    }
  };

  const drawRightAligned = (
    text: string,
    rightEdge: number,
    size: number,
    font: PDFFont,
    color: RGB,
    yy: number,
  ) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightEdge - w, y: yy, size, font, color });
  };

  /* ---------------------------- Seller header ---------------------------- */
  {
    const sellerTitle = data.seller.business_name || data.seller.name || "";
    const showByLine =
      data.seller.entity_type === "individual" &&
      !!data.seller.business_name &&
      !!data.seller.name;
    const size = SZ.headerName;
    ensureSpace(size * 1.5);
    page.drawText(sellerTitle, { x: MARGIN_X, y, size, font: fontBold, color: COLOR.navy });
    if (showByLine) {
      const titleW = fontBold.widthOfTextAtSize(sellerTitle, size);
      const subSize = SZ.headerSub;
      page.drawText(` โดย ${data.seller.name}`, {
        x: MARGIN_X + titleW,
        y: y + (size - subSize) * 0.15,
        size: subSize,
        font: fontRegular,
        color: COLOR.gray555,
      });
    }
    y -= size * 1.5;
  }

  if (data.seller.tax_id) {
    const size = SZ.headerMeta;
    ensureSpace(size * 1.5);
    page.drawText(`เลขประจำตัวผู้เสียภาษี ${data.seller.tax_id}`, {
      x: MARGIN_X,
      y,
      size,
      font: fontRegular,
      color: COLOR.gray555,
    });
    y -= size * 1.5;
  }

  if (data.seller.address) {
    const size = SZ.headerMeta;
    const lines = wrapText(data.seller.address, fontRegular, size, CONTENT_W);
    for (const ln of lines) {
      ensureSpace(size * 1.5);
      page.drawText(ln, { x: MARGIN_X, y, size, font: fontRegular, color: COLOR.gray555 });
      y -= size * 1.5;
    }
  }

  {
    const parts: string[] = [];
    if (data.seller.phone) parts.push(`โทรศัพท์ ${data.seller.phone}`);
    if (data.seller.email) parts.push(`Email: ${data.seller.email}`);
    if (parts.length) {
      const size = SZ.headerMeta;
      ensureSpace(size * 1.5);
      page.drawText(parts.join(" / "), { x: MARGIN_X, y, size, font: fontRegular, color: COLOR.gray555 });
      y -= size * 1.5;
    }
  }

  // <hr className="my-4" />
  y -= px(12);
  ensureSpace(1);
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: MARGIN_X + CONTENT_W, y },
    thickness: 1,
    color: COLOR.grayDDD,
  });
  y -= px(12);

  /* ----------------------------- Doc info row ----------------------------- */
  {
    ensureSpace(px(220));
    const topY = y;
    const rightColW = px(150);
    const leftMaxW = CONTENT_W - rightColW - px(16);
    const leftX = MARGIN_X;
    const rightEdge = MARGIN_X + CONTENT_W;

    let leftY = topY;
    const titleSize = SZ.docTitle;
    page.drawText(isReceipt ? "ใบเสร็จรับเงิน" : "ใบเสนอราคา", {
      x: leftX,
      y: leftY,
      size: titleSize,
      font: fontBold,
      color: COLOR.navy,
    });
    leftY -= titleSize * 1.4 + px(6); // mb-2

    const buyerSize = SZ.buyer;
    const buyerLineH = buyerSize * 1.5;
    const drawBuyerLine = (str: string | null | undefined, font: PDFFont, color: RGB) => {
      if (!str) return;
      const lines = wrapText(str, font, buyerSize, leftMaxW);
      for (const ln of lines) {
        page.drawText(ln, { x: leftX, y: leftY, size: buyerSize, font, color });
        leftY -= buyerLineH;
      }
    };

    drawBuyerLine(data.company_name, fontBold, COLOR.gray555);
    drawBuyerLine(data.contact_name, fontRegular, COLOR.gray555);
    drawBuyerLine(data.address, fontRegular, COLOR.gray555);
    if (data.tax_id) drawBuyerLine(`เลขประจำตัวผู้เสียภาษี ${data.tax_id}`, fontRegular, COLOR.gray555);
    drawBuyerLine(data.email, fontRegular, COLOR.gray555);

    // Right column: doc no / date, right-aligned, top-aligned with the title
    let rightY = topY - (titleSize - SZ.docNo);
    const rightSize = SZ.docNo;
    const rightLineH = rightSize * 1.5;
    const drawRightRow = (label: string, value: string) => {
      const labelW = fontRegular.widthOfTextAtSize(label, rightSize);
      const valueW = fontRegular.widthOfTextAtSize(value, rightSize);
      let x = rightEdge - labelW - valueW;
      page.drawText(label, { x, y: rightY, size: rightSize, font: fontRegular, color: COLOR.grayAAA });
      x += labelW;
      page.drawText(value, { x, y: rightY, size: rightSize, font: fontRegular, color: COLOR.gray555 });
      rightY -= rightLineH;
    };
    drawRightRow("เลขที่ ", data.doc_no);
    drawRightRow("วันที่ ", data.date);

    y = Math.min(leftY, rightY) - px(24); // mb-6
  }

  /* --------------------------------- Note --------------------------------- */
  if (data.note) {
    const size = SZ.note;
    const padding = px(12); // p-3
    const lines = wrapText(data.note, fontRegular, size, CONTENT_W - padding * 2);
    const lineH = size * 1.5;
    const boxH = lines.length * lineH + padding * 2;
    ensureSpace(boxH + px(16));
    const boxTop = y;
    const boxBottom = y - boxH;
    page.drawRectangle({ x: MARGIN_X, y: boxBottom, width: CONTENT_W, height: boxH, color: COLOR.bgF8 });
    let ly = boxTop - padding - size * 0.85;
    for (const ln of lines) {
      page.drawText(ln, { x: MARGIN_X + padding, y: ly, size, font: fontRegular, color: COLOR.gray555 });
      ly -= lineH;
    }
    y = boxBottom - px(16); // mb-4
  }

  /* ------------------------------ Items table ------------------------------ */
  {
    const idxColW = px(32); // w-8
    const priceColW = px(90);
    const nameColW = CONTENT_W - idxColW - priceColW;
    const xIdx = MARGIN_X;
    const xName = MARGIN_X + idxColW;
    const rightEdge = MARGIN_X + CONTENT_W;

    const thSize = SZ.th;
    ensureSpace(thSize * 1.5 + px(40));

    // Header row
    page.drawText("ลำดับ", { x: xIdx, y, size: thSize, font: fontBold, color: COLOR.navy });
    page.drawText("รายละเอียด", { x: xName, y, size: thSize, font: fontBold, color: COLOR.navy });
    drawRightAligned("ราคา", rightEdge, thSize, fontBold, COLOR.navy, y);
    y -= px(8);
    page.drawLine({ start: { x: MARGIN_X, y }, end: { x: rightEdge, y }, thickness: 1.5, color: COLOR.navy });
    y -= px(10);

    const rowNameSize = SZ.td;
    const rowSubSize = SZ.tdSub;
    const rowLineH = rowNameSize * 1.4;
    const rowSubLineH = rowSubSize * 1.4;
    const rowBottomPad = px(8);

    data.items.forEach((item, i) => {
      const licenseLabel = item.license_type ? `สิทธิ์ใช้งาน: ${item.license_type}` : "";
      const nameLines = wrapText(item.name, fontBold, rowNameSize, nameColW - px(4));
      const rowH =
        nameLines.length * rowLineH + (licenseLabel ? rowSubLineH : 0) + rowBottomPad;

      ensureSpace(rowH + px(4));
      const rowTop = y;

      page.drawText(String(i + 1), {
        x: xIdx,
        y: rowTop,
        size: rowNameSize,
        font: fontRegular,
        color: COLOR.grayAAA,
      });

      let ly = rowTop;
      nameLines.forEach((ln) => {
        page.drawText(ln, { x: xName, y: ly, size: rowNameSize, font: fontBold, color: COLOR.black });
        ly -= rowLineH;
      });
      if (licenseLabel) {
        page.drawText(licenseLabel, { x: xName, y: ly, size: rowSubSize, font: fontRegular, color: COLOR.gray888 });
        ly -= rowSubLineH;
      }

      const priceStr = `฿${item.price.toLocaleString()}`;
      drawRightAligned(priceStr, rightEdge, rowNameSize, fontRegular, COLOR.black, rowTop);

      y = ly - rowBottomPad;
      page.drawLine({
        start: { x: MARGIN_X, y: y + rowBottomPad / 2 },
        end: { x: rightEdge, y: y + rowBottomPad / 2 },
        thickness: 0.5,
        color: COLOR.grayF0,
      });
    });

    /* ------------------------------- tfoot ------------------------------- */
    ensureSpace(px(10));
    page.drawLine({ start: { x: MARGIN_X, y }, end: { x: rightEdge, y }, thickness: 1, color: COLOR.grayDDD });
    y -= px(14);

    const footSize = SZ.footLabel;
    const footRowH = footSize * 1.9;

    const drawFootRow = (
      label: string,
      value: string,
      opts: { valueColor?: RGB; bold?: boolean; big?: boolean; extra?: string } = {},
    ) => {
      ensureSpace((opts.big ? SZ.footTotal : footSize) * 1.9);
      const valueSize = opts.big ? SZ.footTotal : footSize;
      const valueFont = opts.bold ? fontBold : fontRegular;
      const valueColor = opts.valueColor ?? (opts.bold ? COLOR.navy : COLOR.black);
      const valueW = valueFont.widthOfTextAtSize(value, valueSize);
      const priceX = rightEdge - valueW;
      page.drawText(value, { x: priceX, y, size: valueSize, font: valueFont, color: valueColor });

      const labelFont = opts.bold ? fontBold : fontRegular;
      const labelColor = opts.bold ? COLOR.navy : COLOR.gray555;
      const labelW = labelFont.widthOfTextAtSize(label, footSize);
      const labelX = priceX - px(16) - labelW;
      page.drawText(label, { x: labelX, y, size: footSize, font: labelFont, color: labelColor });

      if (opts.extra) {
        const extraSize = SZ.footBaht;
        const extraW = fontRegular.widthOfTextAtSize(opts.extra, extraSize);
        page.drawText(opts.extra, {
          x: labelX - px(16) - extraW,
          y,
          size: extraSize,
          font: fontRegular,
          color: COLOR.gray888,
        });
      }

      y -= footRowH;
    };

    drawFootRow("รวมจำนวนเงิน", `฿${subtotal.toLocaleString()}`);
    drawFootRow("หักภาษี ณ ที่จ่าย 3%", `-฿${wht.toLocaleString()}`, { valueColor: COLOR.red500 });

    ensureSpace(px(44));
    page.drawLine({
      start: { x: MARGIN_X, y: y + px(8) },
      end: { x: rightEdge, y: y + px(8) },
      thickness: 1.5,
      color: COLOR.navy,
    });
    drawFootRow("ยอดชำระ", `฿${total.toLocaleString()}`, {
      bold: true,
      big: true,
      extra: bahtText(total),
    });

    y -= px(16); // table mb-6 remainder
  }

  /* ------------------------------- Bank info ------------------------------- */
  if (data.seller.bank) {
    const bank = data.seller.bank;
    const rows: { text: string; bold?: boolean }[] = [
      { text: "ชำระเงินโดยโอนเงินเข้าบัญชี", bold: true },
    ];
    if (bank.bank_name) rows.push({ text: `ธนาคาร: ${bank.bank_name}` });
    if (bank.account_name) rows.push({ text: `ชื่อบัญชี: ${bank.account_name}` });
    if (bank.account_number) rows.push({ text: `เลขที่บัญชี: ${bank.account_number}` });

    const size = SZ.bank;
    const lineH = size * 1.5;
    const padding = px(16); // p-4
    const boxH = rows.length * lineH + padding * 2;
    ensureSpace(boxH + px(32));
    const boxTop = y;
    const boxBottom = y - boxH;
    page.drawRectangle({ x: MARGIN_X, y: boxBottom, width: CONTENT_W, height: boxH, color: COLOR.bgF8 });
    let ly = boxTop - padding - size * 0.85;
    for (const row of rows) {
      page.drawText(row.text, {
        x: MARGIN_X + padding,
        y: ly,
        size,
        font: row.bold ? fontBold : fontRegular,
        color: row.bold ? COLOR.navy : COLOR.gray555,
      });
      ly -= lineH;
    }
    y = boxBottom - px(32); // mb-8
  } else {
    y -= px(8);
  }

  /* -------------------------------- Signature ------------------------------- */
  {
    const sigW = px(160); // w-40
    const rightEdge = MARGIN_X + CONTENT_W;
    const sigX = rightEdge - sigW;

    ensureSpace(px(90));
    y -= px(30); // mt-10-ish gap before the signature line
    const lineY = y;
    page.drawLine({
      start: { x: sigX, y: lineY },
      end: { x: rightEdge, y: lineY },
      thickness: 1,
      color: COLOR.gray555,
    });
    y -= px(14);

    const nameSize = SZ.sigName;
    const nameText = data.seller.name || "";
    const nameW = fontRegular.widthOfTextAtSize(nameText, nameSize);
    page.drawText(nameText, {
      x: rightEdge - (sigW + nameW) / 2,
      y,
      size: nameSize,
      font: fontRegular,
      color: COLOR.gray555,
    });
    y -= nameSize * 1.5;

    const roleSize = SZ.sigRole;
    const roleText = `ผู้${isReceipt ? "รับเงิน" : "เสนอราคา"}`;
    const roleW = fontRegular.widthOfTextAtSize(roleText, roleSize);
    page.drawText(roleText, {
      x: rightEdge - (sigW + roleW) / 2,
      y,
      size: roleSize,
      font: fontRegular,
      color: COLOR.grayAAA,
    });
  }

  return pdfDoc.save();
}
