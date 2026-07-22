"use client";

import { useEffect, useState } from "react";
import { bahtText } from "@/lib/baht-text";

interface SellerInfo {
  name: string;
  business_name?: string | null;
  entity_type?: string;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bank: { bank_name?: string; account_name?: string; account_number?: string } | null;
}

interface FontItem {
  name: string;
  license_type: string;
  price: number;
}

// โครงสร้างเดียวกับ QuoteDocData ใน src/lib/quote-doc.ts
export interface PrintData {
  type: "quotation" | "receipt";
  doc_no: string;
  date: string;
  contact_name: string;
  company_name: string;
  address: string;
  tax_id: string;
  email: string;
  note: string | null;
  items: FontItem[];
  seller: SellerInfo;
  discount?: number;
}

interface Props {
  open: boolean;
  data: PrintData | null;
  onClose: () => void;
  /** สร้าง PDF แล้วส่งอีเมลถึงลูกค้าผ่าน /api/send-email — ต้องกดยืนยันเอง ไม่ auto-send */
  onSendEmail?: () => Promise<void>;
}

export default function PrintLightbox({ open, data, onClose, onSendEmail }: Props) {
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // รีเซ็ตสถานะปุ่มส่งอีเมล ทุกครั้งที่เปิด lightbox ใหม่
  useEffect(() => {
    if (open) {
      setEmailState("idle");
      setEmailError("");
    }
  }, [open, data?.doc_no]);

  if (!open || !data) return null;

  const subtotal = data.items.reduce((s, i) => s + i.price, 0);
  const discount = data.discount ?? 0;
  const discountedSubtotal = subtotal - discount;
  const wht = discountedSubtotal * 0.03;
  const total = discountedSubtotal - wht;
  const isReceipt = data.type === "receipt";
  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSend = async () => {
    if (!onSendEmail || emailState === "sending" || emailState === "sent") return;
    setEmailState("sending");
    setEmailError("");
    try {
      await onSendEmail();
      setEmailState("sent");
    } catch (e) {
      setEmailState("error");
      setEmailError(e instanceof Error ? e.message : "ส่งอีเมลไม่สำเร็จ");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-grey-800 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black flex-shrink-0 flex-wrap gap-2">
        <span className="font-ui text-ui text-white">
          {isReceipt ? "ตัวอย่างใบเสร็จรับเงิน" : "ตัวอย่างใบเสนอราคา"}
        </span>
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={() => window.print()} className="font-ui text-ui px-4 py-1.5 bg-grey-800 text-white border-none cursor-pointer hover:bg-grey-600 transition-colors duration-150 ease-base">
            พิมพ์ / บันทึก PDF
          </button>
          {onSendEmail && (
            <button
              onClick={handleSend}
              disabled={!data.email || emailState === "sending" || emailState === "sent"}
              title={!data.email ? "ใบเสนอราคานี้ไม่มีอีเมลลูกค้า" : `ส่งถึง ${data.email}`}
              className="font-ui text-ui px-4 py-1.5 bg-mint text-black border-none cursor-pointer hover:bg-white transition-colors duration-150 ease-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailState === "sending"
                ? "กำลังส่ง…"
                : emailState === "sent"
                ? "ส่งแล้ว ✓"
                : data.email
                ? `ส่งอีเมลถึงลูกค้า (${data.email})`
                : "ส่งอีเมลถึงลูกค้า"}
            </button>
          )}
          <button onClick={onClose} className="font-ui text-ui px-3 py-1.5 bg-grey-800 text-white border-none cursor-pointer hover:bg-grey-600 transition-colors duration-150 ease-base">
            ปิด
          </button>
        </div>
      </div>

      {((emailState === "error" && emailError) || (onSendEmail && !data.email)) && (
        <div className="px-6 py-2 bg-danger text-white font-body text-footnote flex-shrink-0 flex flex-col gap-0.5">
          {emailState === "error" && emailError && <div>ส่งอีเมลไม่สำเร็จ: {emailError} — กดปุ่มเพื่อลองใหม่ได้</div>}
          {onSendEmail && !data.email && <div>ใบเสนอราคานี้ไม่มีอีเมลลูกค้า — ส่งอีเมลไม่ได้</div>}
        </div>
      )}

      {/* Print area */}
      <div className="flex-1 overflow-y-auto p-6 flex justify-center" id="printAreaWrapper">
        <div id="printDoc" className="bg-white w-[210mm] min-h-[297mm] p-[28mm_25mm] shadow-xl print:shadow-none print:p-[15mm_18mm]" style={{ fontFamily: "Noto Sans Thai, sans-serif" }}>
          {/* Header */}
          <div className="font-ui text-ui text-black">
            {data.seller.business_name || data.seller.name}
            {data.seller.entity_type === "individual" && data.seller.business_name && data.seller.name && (
              <span className="font-body text-body-sm text-grey-600"> โดย {data.seller.name}</span>
            )}
          </div>
          {data.seller.tax_id && <div className="font-body text-footnote text-grey-600">เลขประจำตัวผู้เสียภาษี {data.seller.tax_id}</div>}
          {data.seller.address && <div className="font-body text-footnote text-grey-600">{data.seller.address}</div>}
          <div className="font-body text-footnote text-grey-600">
            {data.seller.phone && `โทรศัพท์ ${data.seller.phone}`}
            {data.seller.phone && data.seller.email && " / "}
            {data.seller.email && `Email: ${data.seller.email}`}
          </div>
          <hr className="my-4 border-grey-200" />

          {/* Doc info */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="font-heading text-h2 text-black mb-2">{isReceipt ? "ใบเสร็จรับเงิน" : "ใบเสนอราคา"}</div>
              <div className="font-body text-footnote text-grey-600">
                <div><span className="font-ui text-ui text-black">{data.company_name}</span></div>
                <div>{data.contact_name}</div>
                <div>{data.address}</div>
                {data.tax_id && <div>เลขประจำตัวผู้เสียภาษี {data.tax_id}</div>}
                <div>{data.email}</div>
              </div>
            </div>
            <div className="text-right font-body text-footnote text-grey-600">
              <div><span className="text-grey-600">เลขที่ </span>{data.doc_no}</div>
              <div><span className="text-grey-600">วันที่ </span>{data.date}</div>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full border-collapse font-body text-footnote mb-6">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-2 text-black font-ui text-ui w-8">ลำดับ</th>
                <th className="text-left py-2 text-black font-ui text-ui">รายละเอียด</th>
                <th className="text-right py-2 text-black font-ui text-ui">ราคา</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i} className="border-b border-grey-200">
                  <td className="py-2 text-grey-600">{i + 1}</td>
                  <td className="py-2">
                    <div className="font-ui text-ui text-black">{item.name}</div>
                    <div className="font-body text-footnote text-grey-600">สิทธิ์ใช้งาน: {item.license_type}</div>
                  </td>
                  <td className="py-2 text-right">฿{item.price.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-grey-200">
                <td colSpan={2} className="text-right py-1.5 text-grey-600">รวมจำนวนเงิน</td>
                <td className="text-right py-1.5">฿{money(subtotal)}</td>
              </tr>
              {discount > 0 && (
                <tr>
                  <td colSpan={2} className="text-right py-1.5 text-grey-600">ส่วนลด</td>
                  <td className="text-right py-1.5 text-danger-dark">-฿{money(discount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={2} className="text-right py-1.5 text-grey-600">หักภาษี ณ ที่จ่าย 3%</td>
                <td className="text-right py-1.5 text-danger-dark">-฿{money(wht)}</td>
              </tr>
              <tr className="border-t-2 border-black">
                <td colSpan={2} className="text-right py-2 font-ui text-ui text-black">
                  <span className="font-body text-footnote text-grey-600 mr-3 italic">{bahtText(total)}</span>
                  ยอดชำระ
                </td>
                <td className="text-right py-2 font-heading text-h2 text-black">฿{money(total)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Bank info */}
          {data.seller.bank && (
            <div className="p-4 bg-surface font-body text-footnote text-grey-600 mb-8">
              <div className="font-ui text-ui text-black mb-1">ชำระเงินโดยโอนเงินเข้าบัญชี</div>
              {data.seller.bank.bank_name && <div>ธนาคาร: {data.seller.bank.bank_name}</div>}
              {data.seller.bank.account_name && <div>ชื่อบัญชี: {data.seller.bank.account_name}</div>}
              {data.seller.bank.account_number && <div>เลขที่บัญชี: {data.seller.bank.account_number}</div>}
            </div>
          )}

          {/* Signature */}
          <div className="flex justify-end mt-8">
            <div className="text-center">
              <div className="w-40 border-b border-grey-600 mb-1 mt-10" />
              <div className="font-body text-footnote text-grey-600">{data.seller.name}</div>
              <div className="font-body text-footnote text-grey-600">ผู้{isReceipt ? "รับเงิน" : "เสนอราคา"}</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; position: absolute; }
          #printAreaWrapper, #printAreaWrapper * { visibility: visible; position: static; }
          #printDoc { margin: 0 !important; padding: 15mm 18mm !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
