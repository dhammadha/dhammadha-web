"use client";

// ตัวดูเอกสารก่อนส่ง — แสดง **ไฟล์ PDF ตัวจริง** ที่จะแนบอีเมล ไม่ใช่ตัวอย่าง HTML
//
// เดิมที่นี่วาดเอกสารด้วย HTML/Tailwind แล้วมี pdf-lib วาดซ้ำอีกตัวสำหรับอีเมล
// สองตัวนั้นเพี้ยนไม่ตรงกัน (ดูคอมเมนต์หัวไฟล์ src/lib/doc-layout.ts) ตอนนี้เหลือ
// ตัวเรนเดอร์เดียว หน้านี้จึง gen PDF แล้วโชว์ใน iframe — สิ่งที่เห็น = ไฟล์ที่ลูกค้าได้
// และ bytes ชุดเดียวกันนี้ถูกส่งต่อให้ onSendEmail เลย ไม่ gen ซ้ำ

import { useCallback, useEffect, useRef, useState } from "react";
import type { QuoteDocData } from "@/lib/quote-doc";

/** โครงสร้างเดียวกับที่ตัววาดรับ — ไม่ประกาศซ้ำ กันเพี้ยนแบบเดิม */
export type PrintData = QuoteDocData;

const DOC_LABEL: Record<QuoteDocData["type"], string> = {
  quotation: "ใบเสนอราคา",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จรับเงิน",
};

interface Props {
  open: boolean;
  data: PrintData | null;
  onClose: () => void;
  /** ส่งอีเมลถึงลูกค้าพร้อมแนบ PDF ที่เห็นอยู่ — ต้องกดยืนยันเอง ไม่ auto-send */
  onSendEmail?: (pdfBytes: Uint8Array) => Promise<void>;
}

export default function PrintLightbox({ open, data, onClose, onSendEmail }: Props) {
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState("");
  const [docState, setDocState] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [docError, setDocError] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const pdfBytes = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // สร้าง PDF ใหม่ทุกครั้งที่เปิด lightbox หรือเปลี่ยนเอกสาร
  useEffect(() => {
    if (!open || !data) return;
    let cancelled = false;
    let url = "";

    setEmailState("idle");
    setEmailError("");
    setDocState("building");
    setDocError("");
    pdfBytes.current = null;

    (async () => {
      try {
        const { generateQuotePdf } = await import("@/lib/quote-doc");
        const bytes = await generateQuotePdf(data);
        if (cancelled) return;
        pdfBytes.current = bytes;
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        setPdfUrl(url);
        setDocState("ready");
      } catch (e) {
        if (cancelled) return;
        setDocError(e instanceof Error ? e.message : "สร้างเอกสารไม่สำเร็จ");
        setDocState("error");
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setPdfUrl("");
    };
  }, [open, data]);

  const handleSend = useCallback(async () => {
    const bytes = pdfBytes.current;
    if (!onSendEmail || !bytes || emailState === "sending" || emailState === "sent") return;
    setEmailState("sending");
    setEmailError("");
    try {
      await onSendEmail(bytes);
      setEmailState("sent");
    } catch (e) {
      setEmailState("error");
      setEmailError(e instanceof Error ? e.message : "ส่งอีเมลไม่สำเร็จ");
    }
  }, [onSendEmail, emailState]);

  if (!open || !data) return null;

  const docLabel = DOC_LABEL[data.type];
  const canSend = docState === "ready" && !!data.email;

  return (
    <div className="fixed inset-0 z-[200] bg-grey-800 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black flex-shrink-0 flex-wrap gap-2">
        <span className="font-ui text-ui text-white">
          {docLabel} {data.doc_no}
        </span>
        <div className="flex gap-2 items-center flex-wrap">
          <a
            href={pdfUrl || undefined}
            download={`${data.doc_no}.pdf`}
            aria-disabled={docState !== "ready"}
            className={`font-ui text-ui px-4 py-1.5 bg-grey-800 text-white no-underline transition-colors duration-150 ease-base ${
              docState === "ready" ? "cursor-pointer hover:bg-grey-600" : "opacity-50 pointer-events-none"
            }`}
          >
            ดาวน์โหลด PDF
          </a>
          {onSendEmail && (
            <button
              onClick={handleSend}
              disabled={!canSend || emailState === "sending" || emailState === "sent"}
              title={!data.email ? "เอกสารนี้ไม่มีอีเมลลูกค้า" : `ส่งถึง ${data.email}`}
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

      {((emailState === "error" && emailError) || docState === "error" || (onSendEmail && !data.email)) && (
        <div className="px-6 py-2 bg-danger text-white font-body text-footnote flex-shrink-0 flex flex-col gap-0.5">
          {docState === "error" && <div>สร้างเอกสารไม่สำเร็จ: {docError} — ปิดแล้วเปิดใหม่เพื่อลองอีกครั้ง</div>}
          {emailState === "error" && emailError && <div>ส่งอีเมลไม่สำเร็จ: {emailError} — กดปุ่มเพื่อลองใหม่ได้</div>}
          {onSendEmail && !data.email && <div>เอกสารนี้ไม่มีอีเมลลูกค้า — ส่งอีเมลไม่ได้</div>}
        </div>
      )}

      <div className="flex-1 min-h-0 p-6 flex items-center justify-center">
        {docState === "ready" && pdfUrl ? (
          <iframe src={pdfUrl} title={`${docLabel} ${data.doc_no}`} className="w-full h-full max-w-[900px] border-none bg-white" />
        ) : (
          <p className="font-body text-body-sm text-white/70">
            {docState === "error" ? "สร้างเอกสารไม่สำเร็จ" : "กำลังสร้างเอกสาร…"}
          </p>
        )}
      </div>
    </div>
  );
}
