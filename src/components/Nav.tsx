"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/Button";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface FontOption {
  slug: string;
  name: string;
  name_th: string;
  category: string;
  tags: string[];
  is_free: boolean;
}

let cachedFonts: FontOption[] | null = null;

export default function Nav() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<FontOption[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
      .select("slug, name, name_th, category, tags, is_free")
      .eq("is_active", true)
      .then(({ data }) => {
        if (!data) return;
        const mapped = (data as { slug: string; name: string | null; name_th: string | null; category: string | null; tags: string[] | null; is_free: boolean }[]).map((f) => {
          const tags: string[] = [...(f.tags || [])];
          if (f.is_free && !tags.includes("free")) tags.push("free");
          return { slug: f.slug, name: f.name || "", name_th: f.name_th || "", category: f.category || "", tags, is_free: !!f.is_free };
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

  const goToFont = (slug: string) => {
    setSearchQuery("");
    setSuggestions([]);
    setSearchOpen(false);
    setActiveIdx(-1);
    router.push(`/fonts/${slug}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!searchOpen || !suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0) goToFont(suggestions[activeIdx].slug);
      else if (suggestions.length === 1) goToFont(suggestions[0].slug);
    }
    else if (e.key === "Escape") { setSearchOpen(false); inputRef.current?.blur(); }
  };

  return (
    <nav
      className={`flex items-center justify-between px-8 py-3.5 bg-white sticky top-0 z-50 transition-shadow duration-200 ${
        scrolled ? "shadow-[0_2px_12px_rgba(0,0,0,0.08)]" : ""
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5 no-underline flex-shrink-0">
        <Image
          src="/logo_DHAMMADHA_2025_simple.png"
          alt="Dhammadha Studio"
          width={36}
          height={36}
          className="rounded-md object-cover"
        />
        <div className="flex flex-col justify-center gap-px h-9">
          <span className="text-base font-semibold text-navy tracking-[0.05em] leading-none">
            DHAMMADHA
          </span>
          <span className="text-xs text-[#aaa] tracking-[0.06em] leading-none">STUDIO</span>
        </div>
      </Link>

      {/* Desktop nav links */}
      <div className="hidden md:flex gap-6 text-[15px] text-[#555]">
        <Link href="/" className="no-underline text-inherit hover:text-mint transition-colors">
          หน้าแรก
        </Link>
        <Link href="/fonts/" className="no-underline text-inherit hover:text-mint transition-colors">
          ฟอนต์ทั้งหมด
        </Link>
        <Link href="/agreement/" className="no-underline text-inherit hover:text-mint transition-colors">
          สัญญาอนุญาต
        </Link>
        <Link href="/#pricing" className="no-underline text-inherit hover:text-mint transition-colors">
          ราคาและแผนบริการ
        </Link>
      </div>

      <div className="flex gap-2.5 items-center">
        {/* Auth button */}
        {user ? (
          <div ref={userMenuRef} className="hidden md:block relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-mint-light border border-mint-mid flex items-center justify-center text-[13px] font-semibold text-mint cursor-pointer hover:bg-mint-mid transition-colors"
              title={user.email ?? ""}
            >
              {(user.email?.[0] ?? "?").toUpperCase()}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-10 w-48 bg-white rounded-xl border border-border shadow-lg py-1 z-50">
                <div className="px-3 py-2 text-[11px] text-[#aaa] truncate border-b border-[#f0f0f0]">{user.email}</div>
                <Link
                  href="/account"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-3 py-2.5 text-[13px] text-[#444] no-underline hover:bg-[#f8f8f6] transition-colors"
                >
                  เข้าหน้าโปรไฟล์
                </Link>
                <button
                  onClick={() => { setUserMenuOpen(false); signOut().then(() => router.push("/")); }}
                  className="w-full text-left px-3 py-2.5 text-[13px] text-red-500 bg-transparent border-none cursor-pointer hover:bg-red-50 transition-colors"
                >
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button as="link" href="/auth/login" size="sm" className="hidden md:inline-flex">
            เข้าสู่ระบบ
          </Button>
        )}
        {/* Search box */}
        <div ref={searchRef} className="relative hidden md:block">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-150 bg-[#f8f8f6] ${
            searchOpen ? "border-mint shadow-[0_0_0_3px_#5ECEC820]" : "border-transparent"
          }`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-[#aaa] flex-shrink-0">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => { if (suggestions.length) setSearchOpen(true); }}
              onKeyDown={handleKeyDown}
              placeholder="ค้นหาฟอนต์..."
              className="bg-transparent border-none outline-none text-[14px] text-[#333] placeholder-[#bbb] w-[180px] font-[inherit]"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSuggestions([]); setSearchOpen(false); inputRef.current?.focus(); }}
                className="text-[#bbb] hover:text-[#888] bg-transparent border-none cursor-pointer text-base leading-none p-0"
              >×</button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {searchOpen && suggestions.length > 0 && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-[300px] bg-white rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden z-50">
              {suggestions.map((f, i) => (
                <div
                  key={f.slug}
                  onMouseDown={() => goToFont(f.slug)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors border-b border-[#f8f8f8] last:border-0 ${
                    i === activeIdx ? "bg-[#f0fffe]" : "hover:bg-[#fafaf8]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-navy leading-snug">{f.name}</div>
                    {f.name_th && <div className="text-[12px] text-[#aaa] leading-snug">{f.name_th}</div>}
                    {(() => {
                      const q = searchQuery.trim().toLowerCase();
                      const matched = f.tags.filter((t) => t.toLowerCase().includes(q) && !f.name.toLowerCase().includes(q) && !f.name_th.toLowerCase().includes(q));
                      return matched.length > 0 ? (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {matched.slice(0, 3).map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0fffe] text-[#0a8a84] border border-[0.5px] border-mint">{t}</span>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <span className="text-[11px] text-[#bbb] capitalize flex-shrink-0 ml-2">{f.is_free ? "ฟรี" : f.category}</span>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {searchOpen && searchQuery && suggestions.length === 0 && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-[240px] bg-white rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#f0f0f0] px-4 py-4 text-[13px] text-[#aaa] z-50">
              ไม่พบฟอนต์ที่ตรงกับ &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1 bg-transparent border-none cursor-pointer"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="เมนู"
        >
          <span className={`block w-5 h-0.5 bg-navy transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-navy transition-all ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-navy transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-t border-[#eee] shadow-md flex flex-col md:hidden">
          {[
            { href: "/", label: "หน้าแรก" },
            { href: "/fonts/", label: "ฟอนต์ทั้งหมด" },
            { href: "/agreement/", label: "สัญญาอนุญาต" },
            { href: "/#pricing", label: "ราคาและแผนบริการ" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-8 py-4 text-[15px] text-[#555] border-b border-[#f0f0f0] no-underline hover:text-mint transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {/* Mobile auth */}
          {user ? (
            <>
              <Link href="/account" className="px-8 py-4 border-b border-[#f0f0f0] text-[14px] text-navy no-underline block" onClick={() => setMenuOpen(false)}>
                เข้าหน้าโปรไฟล์
              </Link>
              <button
                onClick={() => { signOut(); setMenuOpen(false); router.push("/"); }}
                className="w-full text-left px-8 py-4 border-b border-[#f0f0f0] text-[14px] text-red-500 bg-transparent border-x-0 cursor-pointer"
              >
                ออกจากระบบ
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="px-8 py-4 border-b border-[#f0f0f0] text-[15px] text-mint no-underline font-medium"
              onClick={() => setMenuOpen(false)}
            >
              เข้าสู่ระบบ
            </Link>
          )}
          {/* Mobile search */}
          <div className="px-8 py-4 border-b border-[#f0f0f0]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#eee] bg-[#f8f8f6]">
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="text-[#aaa]">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="ค้นหาฟอนต์..."
                className="bg-transparent border-none outline-none text-[14px] text-[#333] placeholder-[#bbb] w-full font-[inherit]"
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
              <div key={f.slug} onMouseDown={() => { goToFont(f.slug); setMenuOpen(false); }}
                className="px-2 py-2.5 text-[14px] text-navy border-b border-[#f5f5f5] cursor-pointer hover:text-mint">
                {f.name} {f.name_th && <span className="text-[#aaa] text-[12px]">— {f.name_th}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
