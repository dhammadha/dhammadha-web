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

/** รายการหนึ่งบรรทัดใน `orders.items` — ชุดเดียวกับที่อีเมล delivery อ่าน */
export type RetailOrderItem = {
  name?: string | null;
  license_type?: string | null;
  /** ราคาเต็ม ณ วันที่ซื้อ — มีตั้งแต่ migration `0086` · ออเดอร์เก่าเป็น undefined */
  list_price?: number | null;
  /** ยอดที่เก็บเงินได้จริงต่อรายการ (จาก line_items ของ Stripe) */
  price?: number | null;
};

export type RetailReceiptOrder = {
  receipt_no: string | null;
  customer_name: string | null;
  customer_email: string | null;
  company_name?: string | null;
  items: RetailOrderItem[] | null;
  discount?: number | null;
  paid_at: string | null;
};

/**
 * ราคาที่จะพิมพ์เป็น "ราคาเต็ม" ของรายการ
 *
 * ออเดอร์ก่อน `0086` ไม่มี `list_price` → คืนราคาที่จ่ายจริง ทำให้ส่วนลดออกมาเป็น 0
 * แล้วใบเสร็จเก่าพิมพ์ซ้ำได้หน้าตาเดิมเป๊ะ (บรรทัด "ส่วนลด" ไม่โผล่)
 */
export function itemListPrice(item: RetailOrderItem): number {
  const paid = Number(item.price ?? 0);
  const list = Number(item.list_price ?? 0);
  return list > paid ? list : paid;
}

/**
 * ส่วนลดรวมของทั้งใบ = ส่วนลดที่บันทึกไว้ที่ระดับออเดอร์ + ผลต่างราคาเต็ม/ราคาจ่ายรายรายการ
 *
 * ⚠️ ใช้ตัวเดียวกันทั้งใบเสร็จ PDF และตารางเงินในอีเมล delivery — ทั้งสองใบไปถึง
 * ลูกค้าในซองเดียวกัน ถ้าคิดคนละสูตรจะขัดกันเอง
 */
export function retailDiscountTotal(order: {
  items?: RetailOrderItem[] | null;
  discount?: number | null;
}): number {
  const perItem = (order.items ?? []).reduce(
    (sum, i) => sum + (itemListPrice(i) - Number(i.price ?? 0)),
    0
  );
  return Number(order.discount ?? 0) + perItem;
}

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

  // ตารางรายการพิมพ์ **ราคาเต็ม** แล้วให้บรรทัด "ส่วนลด" ข้างล่างหักออก — โครงเดียว
  // กับใบเสนอราคา ลูกค้าจึงเห็นว่าฟอนต์ราคาเท่าไรและได้ลดเท่าไร ไม่ใช่เห็นแค่ยอดสุทธิ
  const items: QuoteDocItem[] = (order.items ?? []).map((i) => ({
    name: i.name ?? "",
    license_type: licenseLabel(i.license_type),
    license_lines: licenseDocLines(i.license_type),
    price: itemListPrice(i),
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
    discount: retailDiscountTotal(order),
    seller: PLATFORM_SELLER,
    // 🔴 การซื้อรายชุด = ลูกค้าจ่ายเต็มจำนวนผ่านบัตร/PromptPay ไม่มีการหัก ณ ที่จ่าย
    // (หน้าที่หัก 3% เป็นของลูกค้า**นิติบุคคล**ในเส้นทางใบเสนอราคาเท่านั้น)
    // ถ้าไม่ส่งค่านี้ ตัวเรนเดอร์จะหัก 3% ตามปริยายของฝั่งองค์กร แล้วใบเสร็จจะพิมพ์
    // ยอดชำระน้อยกว่าที่ Stripe เก็บจริง — เป็นบั๊กที่เจอในใบ RC-2569-0017
    withholding: false,
  };
}
