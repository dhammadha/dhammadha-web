/**
 * ใบเสร็จรับเงินของการซื้อรายชุด (Retail)
 *
 * แปลงแถว `orders` → `QuoteDocData` เพื่อส่งเข้าตัวเรนเดอร์ตัวเดิม (`quote-doc.ts`)
 * ตามกติกาใน CLAUDE.md ว่าเอกสารทุกใบต้องออกจาก renderer เดียว ห้ามวาดเอง
 *
 * **ผู้ออกเอกสาร = แพลตฟอร์ม ไม่ใช่ designer**
 * การขายรายชุดแพลตฟอร์มเป็นตัวการ (principal) ตาม `/terms` ข้อ 4 —
 * ต่างจากใบเสร็จของใบเสนอราคาซึ่งออกในนาม designer เพราะเงินเข้า designer ตรง
 * (ดู `OwnQuotes.buildPrintData` ที่อ่าน seller จากแถว users ของ designer)
 */

import type { QuoteDocData, QuoteDocItem } from "./quote-doc";
import { licenseLabel, licenseDocLines } from "./license";
import {
  LEGAL_ENTITY,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_EMAIL,
  LEGAL_ENTITY_OPERATOR,
  LEGAL_ENTITY_PHONE,
  LEGAL_ENTITY_TAX_ID,
} from "./brand";

export type RetailReceiptOrder = {
  receipt_no: string | null;
  customer_name: string | null;
  customer_email: string | null;
  company_name?: string | null;
  items: Array<{ name?: string | null; license_type?: string | null; price?: number | null }> | null;
  discount?: number | null;
  paid_at: string | null;
};

/** ผู้ออกเอกสาร = แพลตฟอร์ม (ชุดเดียวกับที่ `payout-doc.ts` ใช้) */
const PLATFORM_SELLER = {
  business_name: LEGAL_ENTITY,
  name: LEGAL_ENTITY_OPERATOR,
  tax_id: LEGAL_ENTITY_TAX_ID,
  address: LEGAL_ENTITY_ADDRESS,
  phone: LEGAL_ENTITY_PHONE,
  email: LEGAL_ENTITY_EMAIL,
  // ใบเสร็จไม่พิมพ์บล็อกบัญชีธนาคารอยู่แล้ว (DOC_SPEC.receipt.bank = false)
  bank: null,
};

/**
 * คืน `null` เมื่อออเดอร์ยังไม่มีเลขใบเสร็จ — ออเดอร์เก่าก่อน migration `0075`
 * และออเดอร์ที่มาจากใบเสนอราคาจะเข้าเคสนี้ ผู้เรียกต้องซ่อนปุ่มเอง
 */
export function buildRetailReceiptData(order: RetailReceiptOrder): QuoteDocData | null {
  if (!order.receipt_no) return null;

  const items: QuoteDocItem[] = (order.items ?? []).map((i) => ({
    name: i.name ?? "",
    license_type: licenseLabel(i.license_type),
    license_lines: licenseDocLines(i.license_type),
    price: Number(i.price ?? 0),
  }));

  return {
    type: "receipt",
    doc_no: order.receipt_no,
    date: new Date(order.paid_at ?? Date.now()).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    // PromptPay ไม่ส่งชื่อผู้จ่ายมาเลย (`customer_details.name` = null) จึงต้องมีทางถอย
    // เป็นอีเมล ไม่งั้นใบเสร็จจะมีบรรทัดชื่อว่างเปล่า
    contact_name: order.customer_name?.trim() || order.customer_email || "",
    company_name: order.company_name ?? null,
    address: null,
    tax_id: null,
    email: order.customer_email,
    note: null,
    items,
    discount: Number(order.discount ?? 0),
    seller: PLATFORM_SELLER,
  };
}
