"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import FontForm from "@/components/admin/FontForm";
import type { Database } from "@/lib/database.types";

type FontRow = Database["public"]["Tables"]["fonts"]["Row"] & {
  designer_slug?: string | null;
  designer_business_name?: string | null;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function AdminFontReviewPage() {
  const [fonts, setFonts] = useState<FontRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FontRow | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fonts")
      .select("*, users!owner_id(designer_slug, business_name)")
      .is("published_at", null)
      .order("created_at", { ascending: false });
    type RawRow = FontRow & { users?: { designer_slug?: string; business_name?: string } | null };
    const flat = ((data ?? []) as unknown as RawRow[]).map((r) => ({
      ...r,
      designer_slug: r.users?.designer_slug ?? null,
      designer_business_name: r.users?.business_name ?? null,
      users: undefined,
    }));
    setFonts(flat as FontRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const publishFont = async (f: FontRow) => {
    if (!confirm(`Publish "${f.name ?? f.slug}" เลยไหม?`)) return;
    setPublishing(f.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("fonts").update({ published_at: now, is_active: true }).eq("id", f.id);
    if (error) showToast("เกิดข้อผิดพลาด: " + error.message);
    else {
      showToast(`✓ Publish "${f.name ?? f.slug}" แล้ว`);
      load();
    }
    setPublishing(null);
  };

  return (
    <div className="p-6 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-navy">Font Review</h1>
        <p className="text-[13px] text-[#aaa] mt-0.5">ฟอนต์ที่รอตรวจสอบและ Publish</p>
      </div>

      {loading ? (
        <div className="text-[#aaa] text-[14px]">กำลังโหลด…</div>
      ) : fonts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center gap-2">
          <div className="text-[15px] font-medium text-navy">ไม่มีฟอนต์รอ Publish</div>
          <div className="text-[13px] text-[#aaa]">ทุกฟอนต์ได้รับการ Publish แล้ว</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {fonts.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl border border-amber-200 p-4 flex items-center gap-4">
              {/* Cover */}
              <div className="w-12 h-12 rounded-xl bg-[#f5f5f2] overflow-hidden shrink-0">
                {f.cover_image_url && (
                  <img src={f.cover_image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-navy truncate">{f.name ?? f.slug}</div>
                <div className="text-[12px] text-[#aaa] mt-0.5">
                  {f.designer_business_name ?? f.designer_slug ?? "—"}
                  {" · "}เพิ่มเมื่อ {fmtDate(f.created_at)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditing(f)}
                  className="px-3 py-1.5 rounded-xl border border-border text-[13px] text-[#666] bg-white hover:bg-[#f5f5f2] cursor-pointer transition-colors"
                >
                  ดูรายละเอียด
                </button>
                <button
                  onClick={() => publishFont(f)}
                  disabled={publishing === f.id}
                  className="px-4 py-1.5 rounded-xl bg-mint text-white text-[13px] font-medium border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors disabled:opacity-50"
                >
                  {publishing === f.id ? "กำลัง…" : "Publish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <FontForm
          mode="panel"
          open={true}
          onClose={() => setEditing(null)}
          editingFont={editing}
          onSaved={() => { setEditing(null); load(); }}
          ownerId={editing.owner_id ?? undefined}
          isAdmin
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl bg-navy text-white text-[13px] font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
