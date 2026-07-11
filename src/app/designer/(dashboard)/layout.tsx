"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useDesignerSetup } from "@/components/designer/SetupGate";

function NavItem({ href, label, icon, badge, isActive, onClick }: {
  href: string; label: string; icon: React.ReactNode;
  badge?: number; isActive: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] no-underline transition-colors ${
        isActive ? "bg-navy text-white" : "text-[#666] hover:bg-[#f5f5f2] hover:text-navy"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">{badge}</span>
      )}
    </Link>
  );
}

export default function DesignerLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingQuotes, setPendingQuotes] = useState(0);
  const [designerSlug, setDesignerSlug] = useState("");
  const setup = useDesignerSetup();

  const loadPending = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("quotes")
      .select("id")
      .eq("designer_id", user.id)
      .is("quote_no" as never, null);
    setPendingQuotes(data?.length ?? 0);
  }, [user]);

  useEffect(() => {
    if (!loading && (!user || (role !== "designer" && role !== "admin"))) {
      router.replace(user ? "/" : "/auth/login");
    }
  }, [loading, user, role, router]);

  useEffect(() => {
    if (!setup.loading && !setup.complete) {
      router.replace("/designer/onboarding");
    }
  }, [setup.loading, setup.complete, router]);

  useEffect(() => {
    if (user && (role === "designer" || role === "admin")) {
      loadPending();
      supabase
        .from("users")
        .select("designer_slug")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.designer_slug) setDesignerSlug(data.designer_slug);
        });
    }
  }, [user, role, loadPending]);

  if (loading || !user || (role !== "designer" && role !== "admin")) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="text-[#aaa] text-[14px]">กำลังโหลด…</span>
      </div>
    );
  }

  const p = pathname.replace(/\/$/, "");
  const isActive = (href: string) =>
    href === "/designer" ? p === "/designer" : p === href || p.startsWith(href + "/");

  const NAV = [
    {
      href: "/designer/add",
      label: "เพิ่มฟอนต์",
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    },
    {
      href: "/designer",
      label: "ฟอนต์ของฉัน",
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L6 3l4 10M3.5 10h5M10 3h4M12 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      href: "/designer/quotes",
      label: "ใบเสนอราคา",
      badge: pendingQuotes,
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    },
    {
      href: "/designer/pricing",
      label: "ราคาและโปรโมชั่น",
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M8 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/></svg>,
    },
    {
      href: "/designer/revenue",
      label: "รายได้",
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l3-4 3 2 3-5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      href: "/designer/analytics",
      label: "สถิติ",
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>,
    },
    {
      href: "/designer/settings",
      label: "ตั้งค่า",
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    },
  ];

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-[220px] min-h-screen bg-white border-r border-border sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-border">
          <span className="text-[13px] font-semibold text-navy tracking-[0.05em] block">
            {designerSlug ? designerSlug.toUpperCase() : "DESIGNER"}
          </span>
          <span className="text-[10px] text-[#aaa] tracking-[0.06em]">DESIGNER</span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} isActive={isActive(item.href)} />
          ))}
        </nav>
        <div className="p-3 border-t border-border flex flex-col gap-1">
          {role === "admin" && (
            <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] no-underline transition-colors text-[#666] hover:bg-[#f5f5f2] hover:text-navy">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
              <span>Admin Panel</span>
            </Link>
          )}
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] no-underline transition-colors text-[#666] hover:bg-[#f5f5f2] hover:text-navy">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L8 2l6 6M3.5 6.5V14h3v-3h3v3h3V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>กลับหน้าแรก</span>
          </Link>
          <div className="px-3 pt-2 border-t border-border mt-1">
            <div className="text-[11px] text-[#aaa] mb-2 truncate">{user.email}</div>
            <button
              onClick={() => signOut().then(() => router.push("/"))}
              className="w-full text-left text-[13px] text-[#aaa] hover:text-navy bg-transparent border-none cursor-pointer transition-colors p-0"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-border flex items-center justify-between px-4 py-3">
        <span className="text-[13px] font-semibold text-navy tracking-[0.05em]">
          {designerSlug ? designerSlug.toUpperCase() : "DESIGNER"}
        </span>
        <button onClick={() => setMenuOpen((v) => !v)} className="bg-transparent border-none cursor-pointer p-1 text-navy">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMenuOpen(false)}>
          <div className="w-[220px] bg-white h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-5 border-b border-border">
              <span className="text-[13px] font-semibold text-navy">{designerSlug ? designerSlug.toUpperCase() : "DESIGNER"}</span>
            </div>
            <nav className="flex flex-col gap-1 p-3 flex-1">
              {NAV.map((item) => (
                <NavItem key={item.href} {...item} isActive={isActive(item.href)} onClick={() => setMenuOpen(false)} />
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 md:min-w-0 pt-[52px] md:pt-0">
        {children}
      </main>
    </div>
  );
}
