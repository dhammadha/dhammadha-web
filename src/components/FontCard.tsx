"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";

export interface Font {
  id: string;
  name?: string;
  name_th?: string;
  slug?: string;
  designer_slug?: string;
  designer_name?: string;
  designer_business_name?: string;
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
  created_at?: string;
  updated_at?: string;
}

export function isNew(f: Font): boolean {
  if (!f.created_at) return false;
  return Date.now() - new Date(f.created_at).getTime() < 45 * 24 * 60 * 60 * 1000;
}

export default function FontCard({ font, compact, aspectRatio }: { font: Font; compact?: boolean; aspectRatio?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { isFavourite, toggle } = useFavourites();
  const faved = isFavourite(font.id);

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/auth/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    toggle(font.id);
  };

  const href = font.designer_slug
    ? `/fonts/${font.designer_slug}/${font.slug || font.id}/`
    : `/fonts/${font.slug || font.id}/`;
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
    : font.is_free
    ? { text: "FREE", cls: "bg-[#5ECEC8] text-white" }
    : newFlag
    ? { text: "NEW", cls: "bg-mint text-navy" }
    : null;

  return (
    <Link
      href={href}
      className="block bg-white rounded-lg overflow-hidden border border-[0.5px] border-border hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:border-transparent transition-all no-underline"
    >
      <div className={`${compact ? "h-[110px]" : "aspect-video"} relative flex items-center justify-center overflow-hidden rounded-t-lg`} style={{ ...bgStyle, ...(aspectRatio ? { aspectRatio, height: "auto" } : {}) }}>
        {badge && (
          <span className={`absolute top-2 left-2 text-[9px] px-[7px] py-0.5 rounded-full font-semibold tracking-[0.03em] ${badge.cls}`}>
            {badge.text}
          </span>
        )}
        <button
          className="absolute top-1.5 right-1.5 w-[26px] h-[26px] rounded-full bg-white/20 flex items-center justify-center hover:bg-white/35 transition-colors"
          onClick={handleFav}
          aria-label={faved ? "เลิกบันทึก" : "บันทึก"}
          aria-pressed={faved}
        >
          <svg viewBox="0 0 24 24" fill={faved ? "#5ECEC8" : "none"} stroke={faved ? "#5ECEC8" : "#fff"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <div className="text-[13px] font-semibold text-navy truncate">{font.name || "—"}</div>
        <div className="text-[11px] text-[#aaa] mt-0.5 mb-1.5 truncate">
          โดย{" "}
          {font.designer_slug ? (
            <span
              role="link"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/designer/${font.designer_slug}`; }}
              className="text-mint cursor-pointer hover:underline"
            >
              {font.designer_business_name || font.designer_name || "ธรรมดาสตูดิโอ"}
            </span>
          ) : (
            <span className="text-mint">{font.designer_business_name || font.designer_name || "ธรรมดาสตูดิโอ"}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#aaa]">
            {(() => {
              const n = font.weight_count
                || font.full_font_files?.length
                || font.free_font_files?.length
                || 0;
              return n > 0 ? `${n} style${n > 1 ? "s" : ""}` : "";
            })()}
          </span>
          {font.is_free ? (
            <span className="text-[12px] font-semibold text-[#0a8a84]">ฟรี</span>
          ) : font.is_sale && font.sale_price && font.price ? (
            <div className="flex items-baseline gap-1">
              <span className="text-[12px] font-semibold text-navy">฿{font.sale_price.toLocaleString()}</span>
              <span className="text-[10px] text-[#bbb] line-through">฿{font.price.toLocaleString()}</span>
            </div>
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
