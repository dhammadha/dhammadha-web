"use client";

import { useEffect } from "react";

interface SellerInfo {
  name: string;
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

interface PrintData {
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
}

interface Props {
  open: boolean;
  data: PrintData | null;
  onClose: () => void;
}

function bahtText(amount: number): string {
  const units = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า", "สิบ"];
  if (amount === 0) return "ศูนย์บาทถ้วน";
  const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const str = Math.round(amount).toString();
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const d = parseInt(str[i]);
    const pos = str.length - i - 1;
    if (d === 0) continue;
    if (d === 1 && pos === 1) result += "สิบ";
    else if (d === 2 && pos === 1) result += "ยี่สิบ";
    else result += digits[d] + positions[pos];
  }
  return result + "บาทถ้วน";
}

export default function PrintLightbox({ open, data, onClose }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !data) return null;

  const subtotal = data.items.reduce((s, i) => s + i.price, 0);
  const wht = Math.round(subtotal * 0.03);
  const total = subtotal - wht;
  const isReceipt = data.type === "receipt";

  return (
    <div className="fixed inset-0 z-[200] bg-[#555] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#444] flex-shrink-0">
        <span className="text-white text-[14px] font-medium">
          {isReceipt ? "ตัวอย่างใบเสร็จรับเงิน" : "ตัวอย่างใบเสนอราคา"}
        </span>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-1.5 rounded-lg bg-mint text-white text-[13px] font-medium border-none cursor-pointer hover:bg-[#4dbfb9]">
            พิมพ์ / บันทึก PDF
          </button>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#666] text-white text-[13px] border-none cursor-pointer hover:bg-[#888]">
            ปิด
          </button>
        </div>
      </div>

      {/* Print area */}
      <div className="flex-1 overflow-y-auto p-6 flex justify-center" id="printAreaWrapper">
        <div id="printDoc" className="bg-white w-[210mm] min-h-[297mm] p-[28mm_25mm] shadow-xl print:shadow-none print:p-[15mm_18mm]" style={{ fontFamily: "Noto Sans Thai, sans-serif" }}>
          {/* Header */}
          <div className="text-[15px] font-semibold text-navy">{data.seller.name}</div>
          {data.seller.tax_id && <div className="text-[12px] text-[#555]">หมายเลขประจำตัวผู้เสียภาษี {data.seller.tax_id}</div>}
          {data.seller.address && <div className="text-[12px] text-[#555]">{data.seller.address}</div>}
          <div className="text-[12px] text-[#555]">
            {data.seller.phone && `โทรศัพท์ ${data.seller.phone}`}
            {data.seller.phone && data.seller.email && " / "}
            {data.seller.email && `Email: ${data.seller.email}`}
          </div>
          <hr className="my-4 border-[#ddd]" />

          {/* Doc info */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[20px] font-semibold text-navy mb-2">{isReceipt ? "ใบเสร็จรับเงิน" : "ใบเสนอราคา"}</div>
              <div className="text-[13px] text-[#555]">
                <div><span className="font-medium">{data.company_name}</span></div>
                <div>{data.contact_name}</div>
                <div>{data.address}</div>
                {data.tax_id && <div>เลขประจำตัวผู้เสียภาษี {data.tax_id}</div>}
                <div>{data.email}</div>
              </div>
            </div>
            <div className="text-right text-[13px] text-[#555]">
              <div><span className="text-[#aaa]">เลขที่ </span>{data.doc_no}</div>
              <div><span className="text-[#aaa]">วันที่ </span>{data.date}</div>
            </div>
          </div>

          {data.note && <div className="text-[13px] text-[#555] mb-4 p-3 bg-[#f8f8f6] rounded-lg">{data.note}</div>}

          {/* Items table */}
          <table className="w-full border-collapse text-[13px] mb-6">
            <thead>
              <tr className="border-b-2 border-navy">
                <th className="text-left py-2 text-navy font-semibold w-8">ลำดับ</th>
                <th className="text-left py-2 text-navy font-semibold">รายละเอียด</th>
                <th className="text-right py-2 text-navy font-semibold">ราคา</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i} className="border-b border-[#f0f0f0]">
                  <td className="py-2 text-[#aaa]">{i + 1}</td>
                  <td className="py-2">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-[12px] text-[#888]">สิทธิ์ใช้งาน: {item.license_type}</div>
                  </td>
                  <td className="py-2 text-right">฿{item.price.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#ddd]">
                <td colSpan={2} className="text-right py-1.5 text-[#555]">รวมจำนวนเงิน</td>
                <td className="text-right py-1.5">฿{subtotal.toLocaleString()}</td>
              </tr>
              <tr>
                <td colSpan={2} className="text-right py-1.5 text-[#555]">หักภาษี ณ ที่จ่าย 3%</td>
                <td className="text-right py-1.5 text-red-500">-฿{wht.toLocaleString()}</td>
              </tr>
              <tr className="border-t-2 border-navy">
                <td colSpan={2} className="text-right py-2 font-semibold text-navy">
                  <span className="text-[11px] font-normal text-[#888] mr-3 italic">{bahtText(total)}</span>
                  ยอดชำระ
                </td>
                <td className="text-right py-2 font-semibold text-navy text-[16px]">฿{total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          {/* Bank info */}
          {data.seller.bank && (
            <div className="p-4 bg-[#f8f8f6] rounded-xl text-[12px] text-[#555] mb-8">
              <div className="font-medium text-navy mb-1">ชำระเงินโดยโอนเงินเข้าบัญชี</div>
              {data.seller.bank.bank_name && <div>ธนาคาร: {data.seller.bank.bank_name}</div>}
              {data.seller.bank.account_name && <div>ชื่อบัญชี: {data.seller.bank.account_name}</div>}
              {data.seller.bank.account_number && <div>เลขที่บัญชี: {data.seller.bank.account_number}</div>}
            </div>
          )}

          {/* Signature */}
          <div className="flex justify-end mt-8">
            <div className="text-center">
              <div className="w-40 border-b border-[#555] mb-1 mt-10" />
              <div className="text-[12px] text-[#555]">{data.seller.name}</div>
              <div className="text-[11px] text-[#aaa]">ผู้{isReceipt ? "รับเงิน" : "เสนอราคา"}</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body > *:not(#printAreaWrapper) { display: none !important; }
          #printDoc { margin: 0 !important; padding: 15mm 18mm !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
