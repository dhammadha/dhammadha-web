"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import FontForm from "@/components/admin/FontForm";
import type { Database } from "@/lib/database.types";

type FontRow = Database["public"]["Tables"]["fonts"]["Row"];
type Tab = "all" | "active" | "hidden" | "sale";

export default function AdminFontsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [fonts, setFonts] = useState<FontRow[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingFont, setEditingFont] = useState<FontRow | null>(null);
  const [toast, setToast] = useState("");
  const [publishing, setPublishing] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadFonts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("fonts").select("*, users!owner_id(designer_slug, business_name)").order("created_at", { ascending: false });
    type RawRow = { designer_slug?: string | null; users?: { designer_slug?: string; business_name?: string } | null } & FontRow;
    const flat = ((data ?? []) as unknown as RawRow[]).map((r) => ({ ...r, designer_slug: r.users?.designer_slug ?? null, designer_business_name: r.users?.business_name ?? null, users: undefined }));
    setFonts(flat as FontRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadFonts(); }, [loadFonts]);

  const filtered = fonts.filter((f) => {
    if (tab === "active") return f.is_active;
    if (tab === "hidden") return !f.is_active;
    if (tab === "sale") return f.is_sale;
    return true;
  });

  const toggleActive = async (f: FontRow) => {
    await supabase.from("fonts").update({ is_active: !f.is_active }).eq("id", f.id);
    showToast(f.is_active ? "ซ่อนฟอนต์แล้ว" : "แสดงฟอนต์แล้ว");
    loadFonts();
  };

  const deleteFont = async (f: FontRow) => {
    if (!confirm(`ลบฟอนต์ "${f.name}"?\n(ไม่สามารถกู้คืนได้)`)) return;
    await supabase.from("fonts").delete().eq("id", f.id);
    showToast("ลบเรียบร้อย");
    loadFonts();
  };

  const openAdd = () => router.push("/admin/add");
  const openEdit = (f: FontRow) => { setEditingFont(f); setPanelOpen(true); };

  // Fonts that have never been published
  const pendingFonts = fonts.filter((f) => !f.published_at);

  const handlePublish = async () => {
    if (!confirm(`Publish ตอนนี้เลยไหม?\n\nจะ deploy เว็บและ mark ฟอนต์ ${pendingFonts.length} ตัวว่า published`)) return;
    setPublishing(true);
    try {
      const hookUrl = process.env.NEXT_PUBLIC_CF_DEPLOY_HOOK;
      if (!hookUrl) throw new Error("NEXT_PUBLIC_CF_DEPLOY_HOOK not set");
      await fetch(hookUrl, { method: "POST", mode: "no-cors" });
      await supabase.rpc("publish_fonts");
      showToast("กำลัง deploy… หน้าเว็บจะอัปเดตใน ~2 นาที");
      loadFonts();
    } catch (e) {
      showToast("เกิดข้อผิดพลาด: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPublishing(false);
    }
  };

  const stats = [
    { label: "ฟอนต์ทั้งหมด", value: fonts.length },
    { label: "แสดงบนเว็บ", value: fonts.filter((f) => f.is_active).length },
    { label: "ฟรี", value: fonts.filter((f) => f.is_free).length },
    { label: "โปรโมชั่น", value: fonts.filter((f) => f.is_sale).length },
  ];

  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "active", label: "แสดงอยู่" },
    { key: "hidden", label: "ซ่อนอยู่" },
    { key: "sale", label: "โปรโมชั่น" },
  ];

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Publish Banner */}
      <div className={`mb-5 rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 ${pendingFonts.length > 0 ? "bg-[#fffbf0] border-[#f0c040]" : "bg-[#f5faf9] border-[#c0e8e4]"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${pendingFonts.length > 0 ? "bg-[#f0c040]" : "bg-mint"}`} />
          <div>
            {pendingFonts.length > 0 ? (
              <>
                <span className="text-[14px] font-semibold text-navy">มีฟอนต์รอ Publish {pendingFonts.length} ตัว</span>
                <div className="text-[12px] text-[#888] mt-0.5">{pendingFonts.map((f) => f.name).join(", ")}</div>
              </>
            ) : (
              <span className="text-[14px] font-medium text-[#555]">ฟอนต์ทุกตัว Publish แล้ว</span>
            )}
          </div>
        </div>
        <button
          onClick={handlePublish}
          disabled={publishing || pendingFonts.length === 0}
          className="flex-none px-5 py-2 rounded-xl bg-navy text-white text-[13px] font-semibold border-none cursor-pointer hover:bg-[#1a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {publishing ? "กำลัง Publish…" : "Publish"}
        </button>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-4">
            <div className="text-[28px] font-semibold leading-none mb-1 text-navy">{s.value}</div>
            <div className="text-[12px] text-[#aaa]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-white border border-border rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border-none cursor-pointer ${tab === t.key ? "bg-navy text-white" : "text-[#888] bg-transparent hover:bg-[#f5f5f2]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-mint text-white text-[14px] font-medium border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          เพิ่มฟอนต์
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-[52px_2fr_90px_1fr_90px_140px_80px_160px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
          <div></div><div>ฟอนต์</div><div>หมวดหมู่</div><div>Tags</div><div>ราคา</div><div>โปรโมชั่น</div><div>สถานะ</div><div>จัดการ</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">กำลังโหลด…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">ยังไม่มีฟอนต์ในหมวดนี้</div>
        ) : (
          filtered.map((f) => (
            <div key={f.id} className="grid grid-cols-[52px_2fr_90px_1fr_90px_140px_80px_160px] gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafaf8] transition-colors items-center">
              <div>
                {f.cover_image_url
                  ? <img src={f.cover_image_url} alt={f.name ?? ""} className="w-10 h-[22px] rounded object-cover" />
                  : <div className="w-10 h-[22px] rounded bg-[#eee]" />}
              </div>
              <div>
                <a href={(f as FontRow & { designer_slug?: string }).designer_slug ? `/fonts/${(f as FontRow & { designer_slug?: string }).designer_slug}/${f.slug}` : "#"} target="_blank" rel="noopener" className="text-[14px] font-semibold text-navy no-underline hover:text-mint">{f.name ?? "—"}</a>
                {f.name_th && <div className="text-[11px] text-[#aaa]">{f.name_th}</div>}
              </div>
              <div className="text-[12px] text-[#888] capitalize">{f.category ?? "—"}</div>
              <div className="text-[11px] text-[#aaa] truncate">{(f.tags ?? []).slice(0, 3).join(", ") || "—"}</div>
              <div className="text-[13px] font-medium text-navy">
                {f.is_free ? <span className="text-green-600">ฟรี</span> : f.price ? `฿${Number(f.price).toLocaleString()}` : "—"}
              </div>
              <div className="text-[11px] text-[#666]">
                {f.is_sale && f.discount_percent ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#e07000] font-semibold">ลด {f.discount_percent}%</span>
                    {f.sale_end ? (
                      <span className="text-[10px] text-[#aaa]">
                        ถึง {new Date(f.sale_end).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-[#ddd]">—</span>
                )}
              </div>
              <div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${f.is_active ? "bg-green-50 text-green-600" : "bg-[#f5f5f2] text-[#aaa]"}`}>
                  {f.is_active ? "แสดง" : "ซ่อน"}
                </span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => toggleActive(f)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${f.is_active ? "border-border text-[#666] bg-white hover:bg-[#f5f5f2]" : "border-mint text-mint bg-mint-light hover:bg-mint-mid"}`}>
                  {f.is_active ? "ซ่อน" : "แสดง"}
                </button>
                <button onClick={() => openEdit(f)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border text-[#666] bg-white hover:bg-[#f5f5f2] cursor-pointer transition-colors">
                  แก้ไข
                </button>
                <button onClick={() => deleteFont(f)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 cursor-pointer transition-colors">
                  ลบ
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <FontForm
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        editingFont={editingFont}
        onSaved={loadFonts}
        ownerId={user?.id}
        isAdmin
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl bg-navy text-white text-[13px] font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
