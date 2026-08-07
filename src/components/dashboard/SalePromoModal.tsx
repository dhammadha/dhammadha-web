"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { todayISO, formatSaleEnd } from "@/lib/sale";
import type { Database } from "@/lib/database.types";

type FontRow = Database["public"]["Tables"]["fonts"]["Row"];

// ตั้งโปรโมชั่นรายฟอนต์จากในตาราง "ฟอนต์ของฉัน" โดยไม่ต้องเปิด FontForm ทั้งฟอร์ม
//
// payload ต้องเขียนให้ตรงกับ FontForm เป๊ะ (ดู FontForm.tsx ตรง discount_percent/
// sale_price/is_sale) — ถ้าสองทางเขียนคนละรูป effectiveSale จะคิดราคาไม่ตรงกับที่โชว์
export default function SalePromoModal({
  font,
  onClose,
  onSaved,
}: {
  font: FontRow | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  // ฝั่งเรียกใส่ key={font?.id} ไว้ — เปลี่ยนฟอนต์แล้ว component remount ค่าในฟอร์ม
  // จึงล้างเองโดยไม่ต้อง useEffect คอย sync
  const [discount, setDiscount] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const price = font?.price ?? 0;
  const disc = parseInt(discount) || 0;
  const salePrice = disc > 0 && disc <= 100 ? Math.round(price * (1 - disc / 100)) : null;

  const save = async () => {
    if (!font) return;
    // ชุดเดียวกับ savePromo ในหน้าราคาและโปรโมชั่น — ส่วนลดต้องมีวันหมดอายุเสมอ
    // ไม่งั้นโปรฯ ไม่มีวันสิ้นสุดจริง (ดู isSaleActive ใน lib/sale)
    if (disc < 1 || disc > 100) { setError("กรุณาใส่ส่วนลดระหว่าง 1–100%"); return; }
    if (!end) { setError("กรุณาใส่วันสิ้นสุดโปรโมชั่น"); return; }
    if (end < todayISO()) { setError("วันสิ้นสุดต้องไม่เป็นวันที่ผ่านมาแล้ว"); return; }

    setSaving(true);
    setError("");
    const { error: err } = await supabase
      .from("fonts")
      .update({
        is_sale: true,
        discount_percent: disc,
        sale_price: Math.round(price * (1 - disc / 100)),
        sale_label: `ลด ${disc}%`,
        sale_end: end,
      })
      .eq("id", font.id);
    setSaving(false);
    if (err) { setError("บันทึกไม่สำเร็จ: " + err.message); return; }
    onSaved(`✓ เปิดโปรโมชั่น ลด ${disc}% ถึง ${formatSaleEnd(end)} แล้ว`);
  };

  return (
    <Modal open={!!font} onClose={onClose} title="สร้างโปรโมชั่น" className="w-full max-w-[420px]">
      <div className="p-5 flex flex-col gap-4">
        <div className="font-body text-body-sm text-grey-600">
          {font?.name ?? "—"}
          {price > 0 && <span className="text-black"> · ราคา ฿{price.toLocaleString()}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-body-sm text-grey-600">ส่วนลด %</label>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="เช่น 30"
            min="1"
            max="100"
            autoFocus
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-body-sm text-grey-600">วันสิ้นสุดโปรโมชั่น *</label>
          <input
            type="date"
            value={end}
            min={todayISO()}
            onChange={(e) => setEnd(e.target.value)}
            className={inputCls}
          />
        </div>

        {salePrice !== null && price > 0 && (
          <div className="font-body text-body-sm text-grey-600">
            ราคาหลังลด <span className="line-through">฿{price.toLocaleString()}</span>{" "}
            <span className="text-black font-ui text-ui">฿{salePrice.toLocaleString()}</span>
          </div>
        )}

        {error && <div className="font-body text-footnote text-danger-dark">{error}</div>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="font-ui text-ui px-4 py-2 bg-surface text-black hover:bg-grey-200 border-none cursor-pointer transition-colors duration-150 ease-base"
          >
            ยกเลิก
          </button>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "กำลังบันทึก…" : "เปิดโปรโมชั่น"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const inputCls = "w-full px-3 py-2 h-[42px] bg-page font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base";
