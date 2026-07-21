"use client";

interface PdfLightboxProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

export default function PdfLightbox({ open, url, onClose }: PdfLightboxProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white overflow-hidden flex flex-col w-full max-w-[780px] h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 bg-grey-200/40 shrink-0">
          <span className="font-heading font-bold text-body text-black">สัญญาอนุญาตการใช้งาน</span>
          <button
            onClick={onClose}
            className="text-grey-600 hover:text-black bg-transparent border-none cursor-pointer text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <iframe
          src={url}
          className="flex-1 w-full border-none"
          title="สัญญาอนุญาต"
        />
      </div>
    </div>
  );
}
