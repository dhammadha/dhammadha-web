"use client";

/**
 * ลิงก์ "สัญญาอนุญาต" ที่ชี้ไปฉบับที่ถูกต้องเสมอ
 *
 * มี PDF ของดีไซน์เนอร์ → ปุ่มเปิด `PdfLightbox` · ไม่มี → `<Link>` ไปฉบับกลาง `/agreement/`
 * เกณฑ์ว่า "มีหรือไม่มี" อยู่ที่ `designerLicensePdf()` ใน `lib/license.ts` ที่เดียว —
 * ที่นี่รับผลลัพธ์มาเรนเดอร์อย่างเดียว
 *
 * ถือ state เปิด/ปิด lightbox ไว้ในตัวเอง เพื่อให้หน้าที่เรียกไม่ต้องมี `pdfOpen` +
 * `<PdfLightbox>` ของตัวเองอีก (เดิมทั้ง 4 หน้าถือคนละชุด)
 *
 * ⚠️ `className` / `newTab` ต้องส่งเข้ามา **ห้ามตั้งค่ากลางให้เหมือนกันหมด** — แต่ละหน้า
 * วางลิงก์นี้ในบริบทต่างกัน (บางที่อยู่กลางประโยค บางที่เป็นลิงก์เดี่ยวมีลูกศร) และ
 * บางที่จงใจเปิดแท็บใหม่เพราะผู้ใช้กำลังจะจ่ายเงิน ไม่ควรถูกพาออกจากหน้า
 */

import { useState } from "react";
import Link from "next/link";
import PdfLightbox from "@/components/PdfLightbox";
import { DEFAULT_LICENSE_HREF } from "@/lib/license";
import { cn } from "@/lib/cn";

/** reset ของปุ่มให้หน้าตาเหมือนลิงก์ — ผู้เรียกส่งแต่คลาสที่มองเห็น (สี/ขนาด/hover) */
const BUTTON_RESET = "bg-transparent border-none cursor-pointer p-0";

interface LicenseLinkProps {
  /** URL สัญญาฉบับของดีไซน์เนอร์ — `null` = ใช้ฉบับกลาง (ผลจาก `designerLicensePdf()`) */
  pdfUrl: string | null;
  /** คลาสที่มองเห็น เช่น `font-body text-body-sm text-mint-text hover:underline` */
  className?: string;
  /** เปิดฉบับกลางในแท็บใหม่หรือไม่ (มีผลเฉพาะกรณีใช้ฉบับกลาง — PDF เปิดเป็น lightbox อยู่แล้ว) */
  newTab?: boolean;
  children?: React.ReactNode;
}

export default function LicenseLink({
  pdfUrl,
  className,
  newTab = false,
  children = "สัญญาอนุญาต",
}: LicenseLinkProps) {
  const [open, setOpen] = useState(false);

  if (pdfUrl) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={cn(BUTTON_RESET, className)}>
          {children}
        </button>
        <PdfLightbox open={open} url={pdfUrl} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <Link
      href={DEFAULT_LICENSE_HREF}
      className={cn("no-underline", className)}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
