"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import FontForm from "@/components/admin/FontForm";
import type { Database } from "@/lib/database.types";

type FontRow = Database["public"]["Tables"]["fonts"]["Row"] & {
  designer_slug?: string | null;
  designer_business_name?: string | null;
};

type Tab = "all" | "active" | "hidden" | "pending" | "sale";

// ── Quality checklist ────────────────────────────────────────────────────────

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
              <span className={`mt-0.5 text-[13px] leading-none ${c.ok ? "text-green-500" : c.required ? "text-red-500" : "text-amber-500"}`}>
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
            ยังขาดข้อบังคับ {requiredFailed.length} ข้อ — แก้ผ่านปุ่ม &quot;แก้ไข&quot; ก่อน
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

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminAllFontsPage() {
  const [fonts, setFonts] = useState<FontRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<FontRow | null>(null);
  const [reviewing, setReviewing] = useState<FontRow | null>(null);
  const [privateFiles, setPrivateFiles] = useState<string[] | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fonts")
      .select("*, users!owner_id(designer_slug, business_name)")
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

  const filtered = fonts.filter((f) => {
    if (tab === "active") return !!f.published_at && f.is_active;
    if (tab === "hidden") return !!f.published_at && !f.is_active;
    if (tab === "pending") return !f.published_at;
    if (tab === "sale") return f.is_sale;
    return true;
  });

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
    const { error } = await supabase
      .from("fonts")
      .update({ published_at: new Date().toISOString(), is_active: true })
      .eq("id", f.id);
    if (error) {
      showToast("เกิดข้อผิดพลาด: " + error.message);
      setPublishing(null);
      setReviewing(null);
      return;
    }

    // ต้อง deploy ทุกครั้งที่ publish — หน้ารายการดึงข้อมูลสดจาก Supabase
    // (ฟอนต์โผล่ทันที) แต่หน้ารายละเอียดเป็น SSG สร้างตอน build เท่านั้น
    // ถ้าไม่ build ใหม่ ลูกค้าคลิกจากหน้ารายการแล้วจะเจอ 404
    const hookUrl = process.env.NEXT_PUBLIC_CF_DEPLOY_HOOK;
    if (!hookUrl) {
      showToast(`✓ Publish "${f.name ?? f.slug}" แล้ว — แต่ NEXT_PUBLIC_CF_DEPLOY_HOOK ไม่ได้ตั้งไว้ ต้อง deploy เอง`);
    } else {
      try {
        // no-cors: deploy hook ไม่ส่ง CORS header กลับ — ยิงแล้วอ่าน response ไม่ได้
        // แต่ Cloudflare รับ request ไปแล้ว (fetch จะ throw เฉพาะตอนยิงไม่ออกจริง ๆ)
        await fetch(hookUrl, { method: "POST", mode: "no-cors" });
        showToast(`✓ Publish "${f.name ?? f.slug}" แล้ว — กำลัง deploy หน้าเว็บจะอัปเดตใน ~2 นาที`);
      } catch (e) {
        showToast(`✓ Publish แล้ว แต่สั่ง deploy ไม่สำเร็จ ต้อง deploy เอง: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    load();
    setPublishing(null);
    setReviewing(null);
  };

  const toggleActive = async (f: FontRow) => {
    const { error } = await supabase.from("fonts").update({ is_active: !f.is_active }).eq("id", f.id);
    showToast(error ? "เกิดข้อผิดพลาด: " + error.message : f.is_active ? "ซ่อนฟอนต์แล้ว" : "แสดงฟอนต์แล้ว");
    load();
  };

  const pendingCount = fonts.filter((f) => !f.published_at).length;

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "active", label: "แสดงอยู่" },
    { key: "hidden", label: "ซ่อนอยู่" },
    { key: "pending", label: "รอ Publish", badge: pendingCount },
    { key: "sale", label: "โปรโมชั่น" },
  ];

  return (
    <div className="p-6 max-w-[1300px]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-navy">Fonts</h1>
          <p className="text-[13px] text-[#aaa] mt-0.5">ฟอนต์ทั้งหมดจากทุก designer</p>
        </div>
        <div className="text-[13px] font-medium text-navy bg-white border border-border rounded-xl px-4 py-2">
          {fonts.length} ฟอนต์
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 mb-4 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border-none cursor-pointer flex items-center gap-1.5 ${tab === t.key ? "bg-mint text-white" : "text-[#888] bg-transparent hover:bg-[#f5f5f2]"}`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${tab === t.key ? "bg-white/30 text-white" : "bg-red-500 text-white"}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-[52px_2fr_110px_90px_1fr_90px_140px_90px_170px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
          <div /><div>ฟอนต์</div><div>Designer</div><div>หมวดหมู่</div><div>Tags</div><div>ราคา</div><div>โปรโมชั่น</div><div>สถานะ</div><div>จัดการ</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">กำลังโหลด…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">ไม่มีฟอนต์ในหมวดนี้</div>
        ) : filtered.map((f) => (
          <div key={f.id} className="grid grid-cols-[52px_2fr_110px_90px_1fr_90px_140px_90px_170px] gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 hover:bg-[#fafaf8] transition-colors items-center">
            <div>
              {f.cover_image_url
                ? <img src={f.cover_image_url} alt={f.name ?? ""} className="w-10 h-[22px] rounded object-cover" />
                : <div className="w-10 h-[22px] rounded bg-[#eee]" />}
            </div>
            <div>
              {f.designer_slug && f.published_at ? (
                <a href={`/fonts/${f.designer_slug}/${f.slug}`} target="_blank" rel="noopener" className="text-[14px] font-semibold text-navy no-underline hover:text-mint">{f.name ?? "—"}</a>
              ) : (
                <div className="text-[14px] font-semibold text-navy">{f.name ?? "—"}</div>
              )}
              {f.name_th && <div className="text-[11px] text-[#aaa]">{f.name_th}</div>}
            </div>
            <div className="text-[12px] truncate">
              {f.designer_slug ? (
                <Link href={`/designer/${f.designer_slug}`} target="_blank" className="text-mint no-underline hover:underline">
                  {f.designer_slug}
                </Link>
              ) : <span className="text-[#ddd]">—</span>}
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
                  {f.sale_end && (
                    <span className="text-[10px] text-[#aaa]">
                      ถึง {new Date(f.sale_end).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                    </span>
                  )}
                </div>
              ) : <span className="text-[#ddd]">—</span>}
            </div>
            <div>
              {f.published_at ? (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${f.is_active ? "bg-green-50 text-green-600" : "bg-[#f5f5f2] text-[#aaa]"}`}>
                  {f.is_active ? "แสดงบนเว็บ" : "ซ่อน"}
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">รอ Publish</span>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {f.published_at && (
                <button
                  onClick={() => toggleActive(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${f.is_active ? "border-border text-[#666] bg-white hover:bg-[#f5f5f2]" : "border-mint text-mint hover:bg-[#f0fffe]"}`}
                >
                  {f.is_active ? "ซ่อน" : "แสดง"}
                </button>
              )}
              {!f.published_at ? (
                <button
                  onClick={() => openReview(f)}
                  disabled={publishing === f.id}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border-none bg-mint text-white cursor-pointer hover:bg-[#4dbfb9] transition-colors disabled:opacity-50"
                >
                  {publishing === f.id ? "…" : "ตรวจ & Publish"}
                </button>
              ) : (
                <button
                  onClick={() => setEditing(f)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border text-[#666] bg-white hover:bg-[#f5f5f2] cursor-pointer transition-colors"
                >
                  แก้ไข
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

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
