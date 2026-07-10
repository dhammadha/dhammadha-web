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

// ── Quality checklist ก่อน publish ──────────────────────────────────────────

type Check = { label: string; ok: boolean; required: boolean; hint?: string };

function buildChecks(f: FontRow, privateFiles: string[] | null): Check[] {
  const base: Check[] = [
    { label: "ชื่อฟอนต์", ok: !!f.name, required: true },
    {
      label: "Designer ตั้ง slug หน้าร้านแล้ว",
      ok: !!f.designer_slug,
      required: true,
      hint: "ไม่มี slug ลิงก์หน้าฟอนต์จะพัง — ให้ designer ตั้งในหน้าตั้งค่าก่อน",
    },
    { label: "รูป Cover", ok: !!f.cover_image_url, required: true },
    { label: "รูปตัวอย่าง (preview)", ok: (f.preview_images?.length ?? 0) > 0, required: false },
  ];
  const files: Check[] = f.is_free
    ? [{ label: "ไฟล์ฟอนต์ฟรี", ok: (f.free_font_files?.length ?? 0) > 0, required: true }]
    : [
        { label: "ราคา", ok: Number(f.price ?? 0) > 0, required: true },
        {
          label: "ไฟล์เต็ม (private bucket)",
          ok: privateFiles === null ? false : privateFiles.length > 0,
          required: true,
          hint: privateFiles === null ? "กำลังตรวจสอบ…" : undefined,
        },
        {
          label: "Tester (obfuscated) + map",
          ok: (f.obfuscated_font_files?.length ?? 0) > 0 && !!f.obfuscated_map,
          required: false,
          hint: "ไม่มีก็ publish ได้ แต่ type tester จะ fallback ไปใช้ demo",
        },
        {
          label: "ไฟล์ Demo ให้ทดลอง",
          ok: (f.demo_font_files?.length ?? 0) > 0,
          required: false,
          hint: "ไม่มี demo ลูกค้าจะไม่มีไฟล์ทดลองก่อนซื้อ",
        },
      ];
  const extra: Check[] = [
    { label: "คำอธิบายภาษาไทย", ok: !!f.description_th, required: false },
    { label: "จำนวน weight (weight_count)", ok: (f.weight_count ?? 0) > 0, required: false },
    { label: "Specimen PDF", ok: (f.specimen_files?.length ?? 0) > 0, required: false },
  ];
  return [...base, ...files, ...extra];
}

function PublishChecklist({ font, privateFiles, publishing, onClose, onPublish }: {
  font: FontRow;
  privateFiles: string[] | null;
  publishing: boolean;
  onClose: () => void;
  onPublish: () => void;
}) {
  const checks = buildChecks(font, privateFiles);
  const requiredFailed = checks.filter((c) => c.required && !c.ok);
  const warnings = checks.filter((c) => !c.required && !c.ok);
  const canPublish = requiredFailed.length === 0 && privateFiles !== null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold text-navy">ตรวจก่อน Publish</h2>
        <p className="text-[13px] text-[#aaa] mt-0.5 mb-4">
          {font.name ?? font.slug} · {font.is_free ? "ฟอนต์ฟรี" : "ฟอนต์ขาย"}
        </p>

        <div className="flex flex-col gap-2 mb-4">
          {checks.map((c) => (
            <div key={c.label} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 text-[13px] leading-none ${
                  c.ok ? "text-green-500" : c.required ? "text-red-500" : "text-amber-500"
                }`}
              >
                {c.ok ? "✓" : c.required ? "✗" : "⚠"}
              </span>
              <div className="flex-1">
                <span className={`text-[13px] ${c.ok ? "text-[#888]" : "text-navy font-medium"}`}>
                  {c.label}
                  {!c.ok && !c.required && <span className="text-[11px] text-amber-600 ml-1.5">(ไม่บังคับ)</span>}
                </span>
                {!c.ok && c.hint && (
                  <p className="text-[11px] text-[#999] mt-0.5 leading-[1.5]">{c.hint}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {requiredFailed.length > 0 && (
          <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">
            ยังขาดข้อบังคับ {requiredFailed.length} ข้อ — แก้ผ่านปุ่ม &quot;ดูรายละเอียด&quot; ก่อน
          </p>
        )}
        {requiredFailed.length === 0 && warnings.length > 0 && (
          <p className="text-[12px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            มีคำเตือน {warnings.length} ข้อ — publish ได้ แต่แนะนำให้เติมให้ครบ
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-[13px] text-[#666] bg-white hover:bg-[#f5f5f2] cursor-pointer transition-colors"
          >
            ปิด
          </button>
          <button
            onClick={onPublish}
            disabled={!canPublish || publishing}
            className="px-5 py-2 rounded-xl bg-mint text-white text-[13px] font-medium border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? "กำลัง Publish…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminFontReviewPage() {
  const [fonts, setFonts] = useState<FontRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FontRow | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  // ฟอนต์ที่กำลังตรวจ checklist ก่อน publish + ไฟล์เต็มจากตาราง private
  const [reviewing, setReviewing] = useState<FontRow | null>(null);
  const [privateFiles, setPrivateFiles] = useState<string[] | null>(null);
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

  // เปิด checklist ตรวจคุณภาพก่อน publish (โหลดไฟล์เต็มจากตาราง private มาเช็คด้วย)
  const openReview = async (f: FontRow) => {
    setPrivateFiles(null);
    setReviewing(f);
    const { data } = await supabase
      .from("font_files_private")
      .select("full_font_files")
      .eq("font_id", f.id)
      .maybeSingle();
    setPrivateFiles((data?.full_font_files as string[] | null) ?? []);
  };

  const publishFont = async (f: FontRow) => {
    setPublishing(f.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("fonts").update({ published_at: now, is_active: true }).eq("id", f.id);
    if (error) showToast("เกิดข้อผิดพลาด: " + error.message);
    else {
      showToast(`✓ Publish "${f.name ?? f.slug}" แล้ว — อย่าลืม Publish เว็บไซต์เพื่อสร้างหน้า static`);
      load();
    }
    setPublishing(null);
    setReviewing(null);
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
                  onClick={() => openReview(f)}
                  disabled={publishing === f.id}
                  className="px-4 py-1.5 rounded-xl bg-mint text-white text-[13px] font-medium border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors disabled:opacity-50"
                >
                  {publishing === f.id ? "กำลัง…" : "ตรวจ & Publish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <PublishChecklist
          font={reviewing}
          privateFiles={privateFiles}
          publishing={publishing === reviewing.id}
          onClose={() => setReviewing(null)}
          onPublish={() => publishFont(reviewing)}
        />
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
