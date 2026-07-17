"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

/**
 * Modal — overlay เหลี่ยม (docs/design/DESIGN.md §6.2)
 *
 * ใช้กับ specimen lightbox ใน FontDetail **ตัวเดียว**
 *
 * ⚠️ ตั้งใจไม่ย้าย modal เดิม 4 ตัวมาใช้ตัวนี้ (§8 หนี้ที่จงใจไม่แก้):
 *   PdfLightbox · PrintLightbox · IssueQuoteModal · ConfirmPaidModal
 * ทั้งหมดเป็นของ admin/designer ซึ่งอยู่นอกขอบเขตรอบนี้
 * การซ้ำ 4 ที่เป็นหนี้จริง แต่รวบมันคือ refactor โค้ดนอกขอบเขตที่ใส่ชุดดีไซน์มาหลอก
 *
 * พฤติกรรมที่ "เพิ่มใหม่" ไม่ใช่ของเดิม: ปิดด้วยปุ่ม Escape
 * modal ทั้ง 4 ตัวที่มีอยู่ไม่รองรับ Esc เลยสักตัว — ที่นี่ใส่เพราะเป็นความถูกต้อง
 * พื้นฐานของ modal และเป็นการเพิ่ม ไม่ได้ทำของเดิมพัง
 */
export default function Modal({
  open,
  onClose,
  title,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** ใส่แล้วจะมีแถบหัวพร้อมปุ่มปิด — ละไว้ถ้าอยากคุมเองทั้งหมด */
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn("bg-white overflow-hidden flex flex-col max-h-[90vh]", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-grey-200 shrink-0">
            <span className="font-heading font-bold text-body text-black">{title}</span>
            <button
              onClick={onClose}
              aria-label="ปิด"
              className={cn(
                "text-grey-400 hover:text-black bg-transparent border-none cursor-pointer",
                "text-body leading-none px-1",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              )}
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
