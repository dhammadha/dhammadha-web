"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { effectiveSale } from "@/lib/sale";

/**
 * FontCard — ดีไซน์ใหม่ (docs/design/DESIGN.md §6.3, moodboard/font card.png)
 *
 * หน่วยซ้ำบน 5 พื้นผิว: / · /fonts · /designer/[designer] · favourites · related fonts
 * → ROI สูงสุดของงานนี้ และเดิม **ไม่มี breakpoint สักตัว**
 *
 * ⚠️ ตั้งใจไม่แตะ logic (DESIGN.md §8):
 * - ternary คิดราคาข้างล่าง restyle ในที่ ไม่ extract — โหมดพังคือลูกค้าเห็นราคาผิด
 * - ปุ่มหัวใจ + ลิงก์นักออกแบบต้องคง preventDefault/stopPropagation ไว้เป๊ะ
 *   (nested interactive รับน้ำหนักอยู่ — การ์ดทั้งใบเป็น <Link> จะซ้อน <a> ใน <a>
 *   ไม่ได้ ชื่อนักออกแบบเลยต้องเป็น span + onClick ซึ่งเป็น workaround ที่ตั้งใจ)
 *
 * หมายเหตุ: props `compact` / `aspectRatio` **ไม่มีใครเรียกใช้เลย** (ตรวจทั้ง 7 จุด
 * ที่ใช้ <FontCard> — ส่งแค่ font={f}) คงไว้เพื่อไม่ให้ API เปลี่ยน แต่เป็นโค้ดตาย
 * ถ้าจะตัดควรทำเป็นงาน cleanup แยก ไม่ใช่ในรอบดีไซน์
 */

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
  owner_id?: string | null;
  shop_discount_percent?: number | null;
  shop_sale_end?: string | null;
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
  style_count?: number;
  formats?: string[];
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
  const eff = effectiveSale(font);
  const saleActive = eff.active;
  const badge = saleActive
    ? { text: eff.saleLabel, variant: "sale" as const }
    : font.is_free
    ? { text: "FREE", variant: "free" as const }
    : newFlag
    ? { text: "NEW", variant: "new" as const }
    : null;

  const designerName = font.designer_business_name || font.designer_name || "ธรรมดาสตูดิโอ";

  return (
    <Link
      href={href}
      className={cn(
        // ไม่มีเส้นขอบ (§4.1) — แถบรายละเอียดใช้พื้น surface #F8F8F8
        // ซึ่งลอยขึ้นมาจาก body ที่เป็น #FFFFFF เอง ไม่ต้องพึ่งกรอบ
        "group block bg-surface overflow-hidden no-underline",
        "transition-shadow duration-150 ease-base hover:shadow-md",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      )}
    >
      {/* cover = 270×150 = 9:5 (เจ้าของปรับ 2026-07-18 · docs/design/moodboard/font-card-redesign.png)
          เดิม 270×135 (2:1) — cover สูงขึ้น 15px แถบล่างลด 15px รายละเอียดเหลือ 2 บรรทัด รวมการ์ดเท่าเดิม */}
      <div
        className={cn(compact ? "h-[110px]" : "aspect-[9/5]", "relative flex items-center justify-center overflow-hidden")}
        style={{ ...bgStyle, ...(aspectRatio ? { aspectRatio, height: "auto" } : {}) }}
      >
        {badge && (
          <Badge variant={badge.variant} size="sm" className="absolute top-2 left-2">
            {badge.text}
          </Badge>
        )}
        {/* ปุ่มหัวใจ — ยังกลม (DESIGN.md §4.1 ของที่กลมจริงยังกลม)
            24×24 ตามที่เจ้าของออกแบบ (2026-07-18) — เดิม 32×32 · icon ย่อตามสัดส่วน 16→12 */}
        <button
          className={cn(
            // พื้นวงกลมเข้มขึ้น — /25 จางเกินไปบนรูป cover จริง (เจ้าของ 2026-07-18)
            "absolute top-2 right-2 w-6 h-6 rounded-full bg-white/55 hover:bg-white/75",
            "flex items-center justify-center transition-colors duration-150 ease-base",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          )}
          onClick={handleFav}
          aria-label={faved ? "เลิกบันทึก" : "บันทึก"}
          aria-pressed={faved}
        >
          <svg
            viewBox="0 0 24 24"
            fill={faved ? "#5ECEC8" : "none"}
            stroke={faved ? "#5ECEC8" : "#fff"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3 h-3"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* แถบรายละเอียด — 3 ชิ้นวางแยกกันแบบ Figma (font-card-redesign.png)
          ⚠️ leading-none ทั้ง 3 ชิ้น: line-height 1.5 ที่สืบทอดมาทำให้ line-box ของราคา (24px)
          สูง 36px แล้วดันบรรทัด "โดย" ให้ห่างจากชื่อฟอนต์ ~17px (เจ้าของจับได้ 2026-07-18)
          ตัด leading ทิ้ง = กล่องเท่าขนาดตัวอักษร ระยะกระชับตามต้นแบบ */}
      {/* pt-3 (เดิม py-2): บรรทัด "โดย" เล็กลงเหลือ 10px แล้วดันชื่อฟอนต์ลงมาให้บาลานซ์ (เจ้าของ 2026-07-20) */}
      <div className="px-3.5 pt-3 pb-2 md:px-4">
        {/* ชื่อฟอนต์ = fc-heading (Font Card Heading) — สไตล์นี้มีไว้สำหรับตรงนี้โดยเฉพาะ */}
        <div className="font-heading text-fc-heading text-black truncate leading-none">{font.name || "—"}</div>

        <div className="flex items-baseline justify-between gap-2">
          <div className="font-body text-fc-byline text-grey-600 truncate min-w-0 leading-0">
            โดย{" "}
            {font.designer_slug ? (
              <span
                role="link"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/designer/${font.designer_slug}`;
                }}
                className="text-mint-text cursor-pointer hover:underline"
              >
                {designerName}
              </span>
            ) : (
              <span className="text-mint-text">{designerName}</span>
            )}
          </div>

          {/* ⚠️ ternary ราคา — restyle ในที่ ห้าม extract (DESIGN.md §8) · baseline ตรงกับบรรทัด "โดย" */}
          <div className="shrink-0 leading-none">
            {font.is_free ? (
              <span className="font-heading text-h2 text-success">ฟรี</span>
            ) : saleActive && eff.salePrice > 0 && font.price ? (
              /* ราคาจริง (ขีดฆ่า) หน้า → ราคาลด (ปัจจุบัน) ขวาสุด = ตำแหน่งเดียวกับการ์ดราคาปกติ
                 ราคาลดใช้สีเดียวกับ "ฟรี" (success) ตามที่เจ้าของสั่ง 2026-07-18 */
              <span className="flex items-baseline gap-1.5">
                <span className="font-body text-body-sm text-grey-400 line-through">฿{font.price.toLocaleString()}</span>
                <span className="font-heading text-h2 text-success">฿{eff.salePrice.toLocaleString()}</span>
              </span>
            ) : font.price ? (
              <span className="font-heading text-h2 text-black">฿{font.price.toLocaleString()}</span>
            ) : (
              <span className="font-heading text-h2 text-black">—</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
