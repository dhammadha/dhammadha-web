"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";

/**
 * Nav — ดีไซน์ใหม่ (docs/design/DESIGN.md §6.3, moodboard/nav bar.png + button.png)
 *
 * พื้นดำ · ลิงก์ขาวหนา · hover = บล็อก mint · ไม่มีเส้นขอบเลย
 *
 * ⚠️ search เดสก์ท็อปกับมือถือ **เขียนแยกกันเหมือนเดิม ห้ามรวม** — ทั้งคู่แชร์ state
 * `suggestions` ตัวเดียว การรวบเป็น refactor logic ที่เสี่ยงช่องค้นหาทุกหน้า (§8)
 */

interface FontOption {
  slug: string;
  designer_slug: string;
  name: string;
  name_th: string;
  category: string;
  tags: string[];
  is_free: boolean;
}

let cachedFonts: FontOption[] | null = null;

/**
 * หมวดหมู่ใน submenu — ค่าต้องตรงกับ `CATEGORIES` ใน fonts/page.tsx:11
 * (ซึ่งซ้ำอยู่ใน admin/FontForm.tsx:25 ด้วย — หนี้ของเดิม ไม่ใช่เรื่องของรอบนี้)
 *
 * moodboard/nav bar.png วาดไว้แค่ 4 หมวด ขาด `monospace` →
 * ใส่ครบ 5 เพราะถ้าตกไปฟอนต์ monospace จะเข้าถึงจาก submenu ไม่ได้เลย
 */
const CATEGORY_LINKS: { value: string; label: string }[] = [
  { value: "all", label: "ทุกหมวดหมู่" },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans Serif" },
  { value: "display", label: "Display" },
  { value: "handwriting", label: "Handwriting" },
  { value: "monospace", label: "Monospace" },
];

// ไอคอนทุกตัว 18×18 ตามสเปกเจ้าของ ("นับเฉพาะ icon" = ขนาด svg ไม่ใช่กล่องกด)
const SearchIcon = ({ className = "" }: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={className}>
    <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M12.5 12.5l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </svg>
);

const CartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2 3h2.5l2.4 12.4a1.6 1.6 0 0 0 1.6 1.3h9a1.6 1.6 0 0 0 1.6-1.3L22 7H5.6" />
  </svg>
);

// ลิงก์ nav — hover เป็นบล็อก mint ตาม moodboard/button.png (Nav_Button state hover)
// px-2 ที่จอ 768–1023 กันล้นขวา (เมนู+ค้นหา+ไอคอนรวมกันกว้างกว่า container ถ้าใช้ px-3 เต็ม) → px-3 คืนที่ lg 1024+
const NAV_LINK = cn(
  "font-ui text-ui text-white no-underline px-2 lg:px-3 py-2 whitespace-nowrap",
  "hover:bg-mint hover:text-black transition-colors duration-150 ease-base",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
);

export default function Nav() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<FontOption[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  // Load fonts once, cache globally
  useEffect(() => {
    if (cachedFonts) { setFonts(cachedFonts); return; }
    supabase
      .from("fonts")
      // embed ผ่าน view designer_profiles ไม่ใช่ users (ดู 0054 — anon อ่าน users ไม่ได้แล้ว)
      .select("slug, name, name_th, category, tags, is_free, designer_profiles!owner_id(designer_slug)")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .then(({ data }) => {
        if (!data) return;
        const mapped = (data as unknown as { slug: string; name: string | null; name_th: string | null; category: string | null; tags: string[] | null; is_free: boolean; designer_profiles?: { designer_slug?: string } | null }[]).map((f) => {
          const tags: string[] = [...(f.tags || [])];
          if (f.is_free && !tags.includes("free")) tags.push("free");
          return { slug: f.slug, designer_slug: f.designer_profiles?.designer_slug || "", name: f.name || "", name_th: f.name_th || "", category: f.category || "", tags, is_free: !!f.is_free };
        });
        cachedFonts = mapped;
        setFonts(mapped);
      });
  }, []);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleInput = useCallback((val: string) => {
    setSearchQuery(val);
    setActiveIdx(-1);
    if (!val.trim()) { setSuggestions([]); setSearchOpen(false); return; }
    const q = val.trim().toLowerCase();
    const matches = fonts.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.name_th.toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 8);
    setSuggestions(matches);
    setSearchOpen(true);
  }, [fonts]);

  const goToFont = (f: FontOption) => {
    setSearchQuery("");
    setSuggestions([]);
    setSearchOpen(false);
    setActiveIdx(-1);
    // route จริงคือ /fonts/[designer]/[slug] — ไม่มี designer_slug จะ 404
    router.push(f.designer_slug ? `/fonts/${f.designer_slug}/${f.slug}` : "/fonts/");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!searchOpen || !suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0) goToFont(suggestions[activeIdx]);
      else if (suggestions.length === 1) goToFont(suggestions[0]);
    }
    else if (e.key === "Escape") { setSearchOpen(false); inputRef.current?.blur(); }
  };

  const categoryHref = (v: string) => (v === "all" ? "/fonts/" : `/fonts/?category=${v}`);

  return (
    <nav
      className={cn(
        "bg-black sticky top-0 z-50 transition-shadow duration-200",
        scrolled && "shadow-md"
      )}
    >
      {/* สูง 70 ตายตัวตามสเปก — เดิมเป็น py-3 แล้วปล่อยความสูงลอยตามของข้างใน */}
      <Container className="flex items-center h-[70px]">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2.5 no-underline flex-shrink-0",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
          )}
        >
          <Image src="/logo_DHAMMADHA_192px.png" alt="Dhammadha Studio" width={36} height={36} className="object-cover" />
          {/* สองบรรทัดตาม moodboard/main page (update - closeup).png — DHAMMADHA เหนือ STUDIO
              translate-y-[2px] = ชดเชย optical: กล่องกึ่งกลางเป๊ะทางเรขาคณิต (บน/ล่าง 5.5px เท่ากัน)
              แต่ DHAMMADHA ตัวหนาเด่นดึงสายตาให้ดูลอยสูง → ขยับบล็อกลง 2px ให้ดูกึ่งกลางจริง */}
          <div className="hidden sm:flex flex-col justify-center gap-0.5 translate-y-[2px]">
            <span className="font-heading text-ui text-white tracking-wide leading-none">DHAMMADHA</span>
            <span className="font-heading text-logo-sub text-grey-400 leading-none">STUDIO</span>
          </div>
        </Link>

        {/* ลิงก์เดสก์ท็อป — flex-1 justify-center = กึ่งกลางระหว่างโลโก้กับแถบค้นหา */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          {/* "ฟอนต์" + submenu หมวดหมู่ — เปิดตอน hover ตาม moodboard/nav bar.png */}
          <div
            ref={fontMenuRef}
            className="relative"
            onMouseEnter={() => setFontMenuOpen(true)}
            onMouseLeave={() => setFontMenuOpen(false)}
          >
            <Link
              href="/fonts/"
              className={cn(NAV_LINK, fontMenuOpen && "bg-mint text-black")}
              onFocus={() => setFontMenuOpen(true)}
            >
              ฟอนต์
            </Link>
            {/* submenu = **แนวนอน** คั่นด้วย | ตาม moodboard/nav bar (update).png
                กึ่งกลางใต้ "ฟอนต์" เป๊ะ (left-1/2 -translate-x-1/2) + ลูกศรชี้ขึ้นตรงกลาง */}
            {fontMenuOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-1 z-50">
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-1 w-0 h-0
                    border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-surface"
                  aria-hidden
                />
                <div className="bg-surface shadow-lg flex items-center whitespace-nowrap px-2 py-1 mt-2">
                  {CATEGORY_LINKS.map((c, i) => (
                    <div key={c.value} className="flex items-center">
                      {i > 0 && <span className="font-ui text-ui text-grey-400 select-none" aria-hidden>|</span>}
                      <Link
                        href={categoryHref(c.value)}
                        onClick={() => setFontMenuOpen(false)}
                        className={cn(
                          "font-ui text-ui text-black no-underline px-3 py-1.5",
                          "hover:bg-mint transition-colors duration-150 ease-base",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black"
                        )}
                      >
                        {c.label}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/agreement/" className={NAV_LINK}>สัญญาอนุญาต</Link>
          <Link href="/#pricing" className={NAV_LINK}>ราคาและแผนบริการ</Link>
        </div>

        {/* กลุ่มขวา — ml-auto ดันไปชิดขอบขวา (แทน justify-between เดิมที่ถอดออกตอนล็อกสูง nav)
            ไอคอน 18px อยู่ในกล่องกด 32px → มีที่ว่างในตัวข้างละ 7px
            gap ค้นหา→ไอคอนคน ต้องได้ 64 ถึงขอบ svg ที่จอ ≥1280 → xl:ml-[57px] (57+7=64)
            จอแคบกว่าพื้นที่ไม่พอ (นับได้ล้นขวา 89px ที่ viewport 768 ตอนใช้ 57px เต็ม) → ml-1 (768–1023) / lg:ml-4 (1024–1279)
            gap ไอคอนคน→ตะกร้า = 20 ถึงขอบ svg → gap-1.5=6 (7+6+7=20) */}
        <div className="flex items-center ml-auto">
          {/* ช่องค้นหา — เดสก์ท็อป · 315×38 ที่จอกว้าง ≥1280 · หด 240 ที่ lg (1024–1279) · หด 180 ที่ md (768–1023) กันล้นขวา */}
          <div ref={searchRef} className="relative hidden md:block w-[180px] lg:w-[240px] xl:w-[315px]">
            <div className="flex items-center gap-2 px-3 h-[38px] bg-surface">
              <SearchIcon className="text-grey-600 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleInput(e.target.value)}
                onFocus={() => { if (suggestions.length) setSearchOpen(true); }}
                onKeyDown={handleKeyDown}
                placeholder="ค้นหาฟอนต์..."
                className="bg-transparent border-none outline-none font-body text-body-sm text-black placeholder:text-grey-400 w-full min-w-0"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSuggestions([]); setSearchOpen(false); inputRef.current?.focus(); }}
                  className="text-grey-400 hover:text-black bg-transparent border-none cursor-pointer text-body leading-none p-0"
                  aria-label="ล้างคำค้นหา"
                >×</button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {searchOpen && suggestions.length > 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-surface shadow-lg overflow-hidden z-50">
                {suggestions.map((f, i) => (
                  <div
                    key={f.slug}
                    onMouseDown={() => goToFont(f)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      "flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer transition-colors duration-150 ease-base",
                      i === activeIdx ? "bg-mint" : "hover:bg-grey-200/50"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-heading text-fc-heading text-black leading-snug truncate">{f.name}</div>
                      {f.name_th && <div className="font-body text-body-sm text-grey-600 leading-snug truncate">{f.name_th}</div>}
                      {(() => {
                        const q = searchQuery.trim().toLowerCase();
                        const matched = f.tags.filter((t) => t.toLowerCase().includes(q) && !f.name.toLowerCase().includes(q) && !f.name_th.toLowerCase().includes(q));
                        return matched.length > 0 ? (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {matched.slice(0, 3).map((t) => (
                              <span key={t} className="font-heading text-badge bg-black text-white px-1.5 py-0.5 leading-none">{t}</span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <span className="font-body text-body-sm text-grey-600 capitalize flex-shrink-0">{f.is_free ? "ฟรี" : f.category}</span>
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {searchOpen && searchQuery && suggestions.length === 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-surface shadow-lg px-4 py-3 font-body text-body-sm text-grey-600 z-50">
                ไม่พบฟอนต์ที่ตรงกับ &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1.5 ml-1 lg:ml-4 xl:ml-[57px]">
          {/* บัญชี — ระหว่างเช็ค session แสดง placeholder กันปุ่มกระพริบ */}
          {authLoading ? (
            <div className="w-8 h-8 bg-grey-800" aria-hidden />
          ) : user ? (
            // เปิดเมนูตอน hover เหมือน submenu "ฟอนต์" (เจ้าของสั่ง 2026-07-18)
            <div
              ref={userMenuRef}
              className="relative"
              onMouseEnter={() => setUserMenuOpen(true)}
              onMouseLeave={() => setUserMenuOpen(false)}
            >
              {/* avatar — สี่เหลี่ยม mint (เจ้าของสั่งให้เข้าโทนเว็บ 2026-07-18)
                  กล่อง w-8 h-8 เท่าไอคอนตอน logout เป๊ะ ไม่มี ml → nav ไม่ขยับตอนสลับสถานะ */}
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                onFocus={() => setUserMenuOpen(true)}
                className={cn(
                  // ตัวอักษรใช้ text-ui (Bold 700, 16px) ให้หนาเท่าเมนูใน submenu (เจ้าของ 2026-07-18)
                  "w-8 h-8 bg-mint flex items-center justify-center cursor-pointer leading-none",
                  "font-heading text-ui text-black transition-colors duration-150 ease-base",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
                )}
                title={user.email ?? ""}
                aria-expanded={userMenuOpen}
              >
                {(user.email?.[0] ?? "?").toUpperCase()}
              </button>
              {/* top-full + pt-2 = สะพานกันเมาส์หลุดช่วงว่างตอนขยับลงเมนู (hover ไม่ขาด) */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full pt-2 w-52 z-50">
                  <div className="bg-surface shadow-lg py-1">
                    <div className="px-4 py-2 font-body text-footnote text-grey-600 truncate">{user.email}</div>
                    {/* เส้นคั่นบาง ๆ ระหว่างเมนู (เจ้าของสั่ง — ยกเว้นกฎ §4.0 เฉพาะ submenu บัญชีนี้) */}
                    <Link
                      href="/account"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2.5 font-ui text-ui text-black no-underline border-t border-grey-200 hover:bg-mint transition-colors duration-150 ease-base"
                    >
                      เข้าหน้าโปรไฟล์
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); signOut().then(() => router.push("/")); }}
                      className="w-full text-left px-4 py-2.5 font-ui text-ui text-danger-dark bg-transparent border-t border-grey-200 cursor-pointer hover:bg-danger hover:text-white transition-colors duration-150 ease-base"
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ยังไม่ล็อกอิน = ไอคอนคน ตาม moodboard/main page (update - closeup).png
               (เดิมเป็นปุ่ม "เข้าสู่ระบบ" สีมิ้นต์ — moodboard วาดเป็นไอคอนคู่กับตะกร้า)
               ปลายทางเหมือนเดิม: /auth/login */
            <Link
              href="/auth/login"
              aria-label="เข้าสู่ระบบ"
              title="เข้าสู่ระบบ"
              className={cn(
                "flex items-center justify-center w-8 h-8 text-white",
                "hover:text-mint transition-colors duration-150 ease-base",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
              )}
            >
              <PersonIcon />
            </Link>
          )}

          {/* ตะกร้า — ตัวระบบจริงเป็น milestone แยก (money-path · DESIGN.md §10)
              ตอนนี้ลิงก์ไปหน้า /cart ที่บอกว่า "เร็ว ๆ นี้" → เห็นดีไซน์ครบ กดแล้วไม่ 404
              พอ milestone ตะกร้าเสร็จ ค่อยใส่ของจริงลงหน้านั้น */}
          <Link
            href="/cart/"
            aria-label="ตะกร้า"
            className={cn(
              "flex items-center justify-center w-8 h-8 text-white",
              "hover:text-mint transition-colors duration-150 ease-base",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
            )}
          >
            <CartIcon />
          </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-1 bg-transparent border-none cursor-pointer"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="เมนู"
            aria-expanded={menuOpen}
          >
            <span className={cn("block w-5 h-0.5 bg-white transition-all", menuOpen && "rotate-45 translate-y-2")} />
            <span className={cn("block w-5 h-0.5 bg-white transition-all", menuOpen && "opacity-0")} />
            <span className={cn("block w-5 h-0.5 bg-white transition-all", menuOpen && "-rotate-45 -translate-y-2")} />
          </button>
        </div>
      </Container>

      {/* เมนูมือถือ */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-black shadow-md flex flex-col md:hidden">
          <Link href="/" className="px-4 py-3.5 font-ui text-white no-underline hover:bg-mint hover:text-black transition-colors" onClick={() => setMenuOpen(false)}>
            หน้าแรก
          </Link>
          {CATEGORY_LINKS.map((c) => (
            <Link
              key={c.value}
              href={categoryHref(c.value)}
              className={cn(
                "px-4 py-3.5 font-ui no-underline transition-colors duration-150 ease-base",
                "hover:bg-mint hover:text-black",
                c.value === "all" ? "text-white" : "text-grey-400 pl-8"
              )}
              onClick={() => setMenuOpen(false)}
            >
              {c.value === "all" ? "ฟอนต์ทั้งหมด" : c.label}
            </Link>
          ))}
          <Link href="/agreement/" className="px-4 py-3.5 font-ui text-white no-underline hover:bg-mint hover:text-black transition-colors" onClick={() => setMenuOpen(false)}>
            สัญญาอนุญาต
          </Link>
          <Link href="/#pricing" className="px-4 py-3.5 font-ui text-white no-underline hover:bg-mint hover:text-black transition-colors" onClick={() => setMenuOpen(false)}>
            ราคาและแผนบริการ
          </Link>

          {/* บัญชี — มือถือ */}
          {authLoading ? null : user ? (
            <>
              <Link href="/account" className="px-4 py-3.5 font-ui text-white no-underline hover:bg-mint hover:text-black transition-colors" onClick={() => setMenuOpen(false)}>
                เข้าหน้าโปรไฟล์
              </Link>
              <button
                onClick={() => { signOut(); setMenuOpen(false); router.push("/"); }}
                className="w-full text-left px-4 py-3.5 font-ui text-danger bg-transparent border-none cursor-pointer hover:bg-danger hover:text-white transition-colors"
              >
                ออกจากระบบ
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="px-4 py-3.5 font-ui text-mint no-underline hover:bg-mint hover:text-black transition-colors" onClick={() => setMenuOpen(false)}>
              เข้าสู่ระบบ
            </Link>
          )}

          {/* ช่องค้นหา — มือถือ (เขียนแยกจากเดสก์ท็อปโดยตั้งใจ ดูหมายเหตุหัวไฟล์) */}
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface">
              <SearchIcon className="text-grey-600 flex-shrink-0" />
              <input
                type="text"
                placeholder="ค้นหาฟอนต์..."
                className="bg-transparent border-none outline-none font-body text-body-sm text-black placeholder:text-grey-400 w-full"
                onChange={(e) => {
                  const q = e.target.value.trim().toLowerCase();
                  if (!q) { setSuggestions([]); return; }
                  setSuggestions(fonts.filter(f =>
                    f.name.toLowerCase().includes(q) ||
                    f.name_th.toLowerCase().includes(q) ||
                    f.tags.some((t) => t.toLowerCase().includes(q))
                  ).slice(0, 5));
                }}
              />
            </div>
            {suggestions.map((f) => (
              <div
                key={f.slug}
                onMouseDown={() => { goToFont(f); setMenuOpen(false); }}
                className="px-2 py-2.5 font-ui text-white cursor-pointer hover:text-mint transition-colors"
              >
                {f.name}
                {f.name_th && <span className="font-body text-body-sm text-grey-400"> — {f.name_th}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
