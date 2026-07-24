"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

/**
 * ConfirmDeleteModal — ยืนยันการลบแบบ "พิมพ์ชื่อให้ตรง"
 *
 * ใช้กับการลบที่กู้คืนไม่ได้จริง ๆ (ลบฟอนต์ในหน้า admin Fonts)
 * ตั้งใจไม่ใช้ window.confirm() เพราะกดพลาดได้ในคลิกเดียว
 */
export default function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  confirmText,
  title = "ยืนยันการลบ",
  description,
  warning,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** ข้อความที่ผู้ใช้ต้องพิมพ์ให้ตรงเป๊ะถึงจะกดยืนยันได้ (ชื่อฟอนต์ภาษาอังกฤษ) */
  confirmText: string;
  title?: string;
  /** รายละเอียดของสิ่งที่กำลังจะลบ */
  description?: React.ReactNode;
  /** คำเตือนเพิ่มเติม เช่น ไฟล์ที่ไม่ถูกลบตาม */
  warning?: React.ReactNode;
  busy?: boolean;
}) {
  const [typed, setTyped] = useState("");

  // เคลียร์ทุกครั้งที่เปิดใหม่ — ไม่งั้นค่าที่พิมพ์ค้างจากฟอนต์ตัวก่อนจะปลดล็อกปุ่มทันที
  useEffect(() => { if (open) setTyped(""); }, [open]);

  const matched = typed.trim() === confirmText;

  return (
    <Modal open={open} onClose={onClose} title={title} className="w-full max-w-[440px]">
      <div className="p-5 flex flex-col gap-4 overflow-y-auto">
        {description}

        <div className="font-body text-body-sm text-black bg-warning px-3 py-2.5 leading-relaxed">
          ⚠️ ลบแล้วกู้คืนไม่ได้
          {warning}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-delete-input" className="font-body text-body-sm text-grey-600">
            พิมพ์ <span className="font-ui text-ui text-black">{confirmText}</span> เพื่อยืนยันการลบ
          </label>
          <input
            id="confirm-delete-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={confirmText}
            className="w-full px-3 py-2 h-[38px] bg-white font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <button
            onClick={onConfirm}
            disabled={!matched || busy}
            className="font-ui text-ui px-4 py-2 border-none transition-colors duration-150 ease-base bg-danger text-white hover:bg-danger-dark cursor-pointer disabled:bg-grey-200 disabled:text-grey-600 disabled:cursor-not-allowed"
          >
            {busy ? "กำลังลบ…" : "ลบฟอนต์"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
