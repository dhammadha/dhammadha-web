"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("TH");
  const [menuOpen, setMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <nav
      className={`flex items-center justify-between px-8 py-3.5 bg-white sticky top-0 z-50 transition-shadow duration-200 ${
        scrolled ? "shadow-[0_2px_12px_rgba(0,0,0,0.08)]" : ""
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5 no-underline">
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
        <Link href="/#fonts" className="no-underline text-inherit hover:text-mint transition-colors">
          ฟอนต์ทั้งหมด
        </Link>
        <Link href="#" className="no-underline text-inherit hover:text-mint transition-colors">
          สัญญาอนุญาต
        </Link>
        <Link href="/#pricing" className="no-underline text-inherit hover:text-mint transition-colors">
          ราคาและแผนบริการ
        </Link>
      </div>

      <div className="flex gap-2.5 items-center">
        {/* Language selector */}
        <div className="relative select-none cursor-pointer" ref={langRef}>
          <button
            className="flex items-center gap-1 text-[13px] text-[#555] px-1 py-1.5 bg-transparent border-none"
            onClick={() => setLangOpen((v) => !v)}
          >
            <span>{lang}</span>
            <span className="text-[10px] text-[#999]">▾</span>
          </button>
          {langOpen && (
            <div className="absolute top-[calc(100%+6px)] right-0 bg-white border border-[0.5px] border-[#ddd] rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.1)] min-w-[150px] overflow-hidden z-50">
              {[
                { code: "TH", label: "TH - ไทย" },
                { code: "EN", label: "EN - English" },
              ].map((item) => (
                <div
                  key={item.code}
                  onClick={() => {
                    setLang(item.code);
                    setLangOpen(false);
                  }}
                  className={
                    lang === item.code
                      ? "bg-navy text-white rounded-lg mx-1.5 my-1 px-3 py-2 text-[13px] cursor-pointer"
                      : "px-4 py-3 text-[13px] text-[#333] cursor-pointer hover:bg-bg"
                  }
                >
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="text-[13px] px-[18px] py-2 border-none rounded-lg bg-navy text-white font-medium hover:bg-mint transition-colors">
          เข้าสู่ระบบ
        </button>

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
            { href: "/#fonts", label: "ฟอนต์ทั้งหมด" },
            { href: "#", label: "สัญญาอนุญาต" },
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
        </div>
      )}
    </nav>
  );
}
