"use client";

import Link from "next/link";
import { Timestamp } from "firebase/firestore";

export interface Font {
  id: string;
  name?: string;
  name_th?: string;
  slug?: string;
  designer_name?: string;
  category?: string;
  tags?: string[];
  description_th?: string;
  description_en?: string;
  price?: number;
  sale_price?: number;
  discount_percent?: number;
  is_sale?: boolean;
  sale_label?: string;
  sale_end?: string;
  is_active?: boolean;
  is_free?: boolean;
  is_subscription?: boolean;
  is_popular?: boolean;
  cover_image_url?: string;
  preview_images?: string[];
  full_font_files?: string[];
  demo_font_files?: string[];
  free_font_files?: string[];
  specimen_files?: string[];
  has_demo?: boolean;
  weight_count?: number;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export function isNew(f: Font): boolean {
  if (!f.created_at) return false;
  return Date.now() - f.created_at.toDate().getTime() < 45 * 24 * 60 * 60 * 1000;
}

export default function FontCard({ font }: { font: Font }) {
  const href = `/fonts/${font.slug || font.id}/`;
  const bgStyle: React.CSSProperties = font.cover_image_url
    ? {
        backgroundImage: `url('${font.cover_image_url}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: "#2B1B3D" };

  const newFlag = isNew(font);
  const badge = font.is_sale
    ? { text: font.sale_label || "Sale", cls: "bg-[#f0c040] text-[#5a3800]" }
    : newFlag
    ? { text: "NEW", cls: "bg-mint text-navy" }
    : null;

  return (
    <Link
      href={href}
      className="block bg-white rounded-lg overflow-hidden border border-[0.5px] border-border hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:border-transparent transition-all no-underline"
    >
      <div className="aspect-video relative flex items-center justify-center overflow-hidden" style={bgStyle}>
        {badge && (
          <span className={`absolute top-2 left-2 text-[9px] px-[7px] py-0.5 rounded-full font-semibold tracking-[0.03em] ${badge.cls}`}>
            {badge.text}
          </span>
        )}
        <button
          className="absolute top-1.5 right-1.5 w-[26px] h-[26px] rounded-full bg-white/20 flex items-center justify-center hover:bg-white/35 transition-colors"
          onClick={(e) => e.preventDefault()}
          aria-label="บันทึก"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <div className="text-[13px] font-semibold text-navy truncate">{font.name || "—"}</div>
        <div className="text-[11px] text-[#aaa] mt-0.5 mb-1.5 truncate">
          โดย <span className="text-mint">{font.designer_name || "ธรรมดาสตูดิโอ"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#aaa]">
            {font.weight_count ? `${font.weight_count} styles` : ""}
          </span>
          {font.is_free ? (
            <span className="text-[12px] font-semibold text-[#0a8a84]">ฟรี</span>
          ) : font.price ? (
            <span className="text-[12px] font-semibold text-navy">฿{font.price.toLocaleString()}</span>
          ) : (
            <span className="text-[12px] font-semibold text-navy">—</span>
          )}
        </div>
      </div>
    </Link>
  );
}
