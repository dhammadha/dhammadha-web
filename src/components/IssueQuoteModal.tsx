"use client";

// Modal "ออกใบเสนอราคา" — เจ้าของฟอนต์ตรวจ/แก้ราคาแต่ละฟอนต์ + ใส่ส่วนลด (บาท)
// ก่อนออกเลขใบเสนอราคา จับคู่ชื่อฟอนต์ใน quote กับฟอนต์จริงบนแพลตฟอร์ม (font_id)
// แล้วเรียก issue_quotation_priced → บันทึกราคา/ส่วนลดลง quote + ออกเลข QT
// ราคาที่บันทึกจะถูกดึงไปใช้ต่อในขั้นยืนยันรับชำระ/ออกใบเสร็จโดยไม่ต้องกรอกซ้ำ
// ใช้ร่วมกันทั้งหน้า designer/quotes และ admin/quotes

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { licenseLabel } from "@/lib/license";
import Button from "@/components/ui/Button";

export type IssueQuote = {
  id: string;
  fonts: string[];
  license_type: string;
  discount: number | null;
  designer_id: string | null;
};

export type InitialItem = { name: string; license_type: string; price: number };

type FontOption = { id: string; name: string | null; name_th: string | null; price: number | null };

type ItemRow = {
  quoteName: string;
  font_id: string;
  license_type: string;
  price: string; // เก็บเป็น string ระหว่างพิมพ์
};

interface Props {
  quote: IssueQuote;
  /** รายการราคาตั้งต้น (จาก getLicenseItems/fonts_detail) — ชื่อ/ประเภทสิทธิ์/ราคา */
  initialItems: InitialItem[];
  onClose: () => void;
  /** เรียกหลังออกใบเสนอราคาสำเร็จ — เลขที่เอกสาร + already_issued */
  onIssued: (docNo: string, alreadyIssued: boolean) => void;
}

function matchFont(quoteName: string, fonts: FontOption[]): string {
  const q = quoteName.trim().toLowerCase();
  const exact = fonts.find((f) => f.name?.toLowerCase() === q || f.name_th?.toLowerCase() === q);
  if (exact) return exact.id;
  const partial = fonts.find(
    (f) => (f.name && q.includes(f.name.toLowerCase())) || (f.name && f.name.toLowerCase().includes(q))
  );
  return partial?.id ?? "";
}

export default function IssueQuoteModal({ quote, initialItems, onClose, onIssued }: Props) {
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [discount, setDiscount] = useState<string>(String(quote.discount ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      let q = supabase.from("fonts").select("id, name, name_th, price").order("name");
      if (quote.designer_id) q = q.eq("owner_id", quote.designer_id);
      const { data } = await q;
      const list = (data as FontOption[]) ?? [];
      setFonts(list);
      setRows(
        quote.fonts.map((name) => {
          const initial = initialItems.find((d) => d.name === name);
          return {
            quoteName: name,
            font_id: matchFont(name, list),
            license_type: initial?.license_type ?? quote.license_type,
            price: String(initial?.price ?? 0),
          };
        })
      );
    })();
  }, [quote, initialItems]);

  const subtotal = useMemo(() => rows.reduce((s, r) => s + (Number(r.price) || 0), 0), [rows]);
  const discountNum = Math.max(Number(discount) || 0, 0);
  const net = Math.max(subtotal - discountNum, 0);
  const ready = rows.length > 0 && rows.every((r) => r.font_id && Number(r.price) >= 0);

  const issue = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    const items = rows.map((r) => ({
      font_id: r.font_id,
      name: r.quoteName,
      license_type: r.license_type,
      price: Number(r.price) || 0,
    }));
    const { data, error: rpcError } = await supabase.rpc("issue_quotation_priced", {
      p_quote_id: quote.id,
      p_items: items,
      p_discount: discountNum,
    });
    if (rpcError) {
      const msg = rpcError.message.includes("already_confirmed")
        ? "ใบเสนอราคานี้ยืนยันรับชำระไปแล้ว แก้ราคาไม่ได้"
        : rpcError.message.includes("not_authorized")
        ? "คุณไม่มีสิทธิ์ออกเอกสารนี้"
        : rpcError.message.includes("font_not_found")
        ? "มีฟอนต์ในรายการที่ไม่ตรงกับฟอนต์ในระบบ — กรุณาเลือกฟอนต์ให้ครบ"
        : `ออกใบเสนอราคาไม่สำเร็จ: ${rpcError.message}`;
      setError(msg);
      setSaving(false);
      return;
    }
    const result = data as unknown as { doc_no: string; already_issued: boolean };
    setSaving(false);
    onIssued(result.doc_no, result.already_issued);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white shadow-lg w-full max-w-[560px] max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-heading text-h2 text-black">ออกใบเสนอราคา</h3>
          <button onClick={onClose} className="text-grey-600 hover:text-black bg-transparent border-none cursor-pointer text-lg leading-none transition-colors duration-150 ease-base">✕</button>
        </div>
        <p className="font-body text-body-sm text-grey-600 mb-4">
          ตรวจสอบ/แก้ราคาแต่ละฟอนต์และส่วนลดก่อนออกเอกสาร — ราคานี้จะถูกใช้ต่อในขั้นยืนยันรับชำระ
        </p>

        <div className="flex flex-col gap-3 mb-4">
          {rows.map((row, i) => (
            <div key={i} className="bg-surface p-3">
              <div className="font-ui text-ui text-black mb-2">
                {row.quoteName}
                <span className="font-body text-body-sm text-grey-600"> · {licenseLabel(row.license_type)}</span>
              </div>
              <div className="flex gap-2">
                <select
                  value={row.font_id}
                  onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, font_id: e.target.value } : r)))}
                  className="flex-1 font-body text-body-sm px-2 py-2 bg-white text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                >
                  <option value="">— เลือกฟอนต์ในระบบ —</option>
                  {fonts.map((f) => (
                    <option key={f.id} value={f.id}>{f.name ?? f.name_th ?? f.id}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <span className="font-body text-body-sm text-grey-600">฿</span>
                  <input
                    type="number"
                    min="0"
                    value={row.price}
                    onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))}
                    className="w-[100px] font-body text-body-sm px-2 py-2 text-right bg-white text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-body text-body-sm text-grey-600">รวมจำนวนเงิน</span>
            <span className="font-body text-body-sm text-black">฿{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-body text-body-sm text-grey-600">ส่วนลด (บาท)</span>
            <div className="flex items-center gap-1">
              <span className="font-body text-body-sm text-grey-600">฿</span>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-[110px] font-body text-body-sm px-2 py-2 text-right bg-surface text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 bg-surface px-3 py-2 -mx-3">
            <span className="font-body text-body-sm text-grey-600">ยอดสุทธิ</span>
            <span className="font-heading text-h2 text-black">฿{net.toLocaleString()}</span>
          </div>
        </div>

        {error && <p className="font-body text-body-sm text-danger-dark mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={issue} disabled={!ready || saving}>
            {saving ? "กำลังออกเอกสาร…" : "ออกใบเสนอราคา"}
          </Button>
        </div>
      </div>
    </div>
  );
}
