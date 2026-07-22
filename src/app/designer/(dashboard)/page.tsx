"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import FontForm from "@/components/admin/FontForm";
import Button from "@/components/ui/Button";
import type { Database } from "@/lib/database.types";

type FontRow = Database["public"]["Tables"]["fonts"]["Row"];
type Tab = "all" | "active" | "hidden" | "sale";

export default function DesignerFontsPage() {
  const { user, role } = useAuth();
  const [fonts, setFonts] = useState<FontRow[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingFont, setEditingFont] = useState<FontRow | null>(null);
  const [toast, setToast] = useState("");
  const [designerSlug, setDesignerSlug] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadFonts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fonts")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { showToast("โหลดรายการฟอนต์ไม่สำเร็จ"); setLoading(false); return; }
    setFonts((data as FontRow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadFonts();
    if (user) {
      supabase.from("users").select("designer_slug").eq("id", user.id).single()
        .then(({ data }) => setDesignerSlug(data?.designer_slug ?? null));
    }
  }, [user, loadFonts]);

  const filtered = fonts.filter((f) => {
    if (tab === "active") return !!f.published_at && f.is_active;
    if (tab === "hidden") return !!f.published_at && !f.is_active;
    if (tab === "sale") return f.is_sale;
    return true;
  });

  const toggleActive = async (f: FontRow) => {
    const { error } = await supabase.from("fonts").update({ is_active: !f.is_active }).eq("id", f.id);
    showToast(error ? "เกิดข้อผิดพลาด: " + error.message : f.is_active ? "ซ่อนฟอนต์แล้ว" : "แสดงฟอนต์แล้ว");
    loadFonts();
  };

  const openEdit = (f: FontRow) => { setEditingFont(f); setPanelOpen(true); };

  const stats = [
    { label: "ฟอนต์ทั้งหมด", value: fonts.length },
    { label: "แสดงบนเว็บ", value: fonts.filter((f) => !!f.published_at && f.is_active).length },
    { label: "รอ Publish", value: fonts.filter((f) => !f.published_at).length },
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
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface p-4">
            <div className="font-heading text-h2 text-black leading-none mb-1">{s.value}</div>
            <div className="font-body text-footnote text-grey-600">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 font-ui text-ui border-none cursor-pointer transition-colors duration-150 ease-base ${tab === t.key ? "bg-mint text-black" : "text-grey-600 bg-transparent hover:bg-grey-200"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button as="link" href="/designer/add">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          เพิ่มฟอนต์
        </Button>
      </div>

      {/* Table */}
      <div className="bg-surface overflow-hidden">
        <div className="grid grid-cols-[52px_2fr_90px_1fr_90px_140px_100px_130px] gap-3 px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]">
          <div /><div>ฟอนต์</div><div>หมวดหมู่</div><div>Tags</div><div>ราคา</div><div>โปรโมชั่น</div><div>สถานะ</div><div>จัดการ</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">กำลังโหลด…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="font-body text-body-sm text-grey-600">ยังไม่มีฟอนต์ในหมวดนี้</p>
            {tab === "all" && (
              <Button as="link" href="/designer/add" size="sm">เพิ่มฟอนต์แรก →</Button>
            )}
          </div>
        ) : filtered.map((f) => (
          <div key={f.id} className="grid grid-cols-[52px_2fr_90px_1fr_90px_140px_100px_130px] gap-3 px-4 py-3 hover:bg-grey-200 transition-colors duration-150 ease-base items-center">
            <div>
              {f.cover_image_url
                ? <img src={f.cover_image_url} alt={f.name ?? ""} className="w-10 h-[22px] object-cover" />
                : <div className="w-10 h-[22px] bg-grey-200" />}
            </div>
            <div>
              {designerSlug && f.published_at ? (
                <a href={`/fonts/${designerSlug}/${f.slug}`} target="_blank" rel="noopener" className="font-ui text-ui text-black no-underline hover:text-mint-text">{f.name ?? "—"}</a>
              ) : (
                <div className="font-ui text-ui text-black">{f.name ?? "—"}</div>
              )}
              {f.name_th && <div className="font-body text-footnote text-grey-600">{f.name_th}</div>}
            </div>
            <div className="font-body text-footnote text-grey-600 capitalize">{f.category ?? "—"}</div>
            <div className="font-body text-footnote text-grey-600 truncate">{(f.tags ?? []).slice(0, 3).join(", ") || "—"}</div>
            <div className="font-body text-body-sm text-black">
              {f.is_free ? <span className="text-success">ฟรี</span> : f.price ? `฿${Number(f.price).toLocaleString()}` : "—"}
            </div>
            <div className="font-body text-footnote text-grey-600">
              {f.is_sale && f.discount_percent ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-black font-ui text-ui">ลด {f.discount_percent}%</span>
                  {f.sale_end && (
                    <span className="font-body text-footnote text-grey-600">
                      ถึง {new Date(f.sale_end).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                    </span>
                  )}
                </div>
              ) : <span className="text-grey-600">—</span>}
            </div>
            <div>
              {f.published_at ? (
                <span className={`text-badge font-heading px-2 py-0.5 ${f.is_active ? "bg-success text-white" : "bg-surface text-grey-600"}`}>
                  {f.is_active ? "แสดงบนเว็บ" : "ซ่อน"}
                </span>
              ) : (
                <span className="text-badge font-heading px-2 py-0.5 bg-warning text-black">รอ Publish</span>
              )}
            </div>
            <div className="flex gap-1.5">
              {f.published_at && (
                <button
                  onClick={() => toggleActive(f)}
                  className={`font-ui text-ui px-2.5 py-1 border-none cursor-pointer transition-colors duration-150 ease-base ${f.is_active ? "bg-surface text-black hover:bg-black hover:text-white" : "bg-mint text-black hover:bg-black hover:text-white"}`}
                >
                  {f.is_active ? "ซ่อน" : "แสดง"}
                </button>
              )}
              <button onClick={() => openEdit(f)} className="font-ui text-ui px-2.5 py-1 bg-surface text-black hover:bg-black hover:text-white transition-colors duration-150 ease-base border-none cursor-pointer">
                แก้ไข
              </button>
            </div>
          </div>
        ))}
      </div>

      <FontForm
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        editingFont={editingFont}
        onSaved={loadFonts}
        ownerId={user?.id}
        lockIdentity={role !== "admin"}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-4 py-3 bg-black text-white font-body text-body-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
