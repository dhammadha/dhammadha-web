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
        className="bg-white w-full max-w-[480px] max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-ui text-ui text-black">ตรวจก่อน Publish</h2>
        <p className="font-body text-body-sm text-grey-600 mt-0.5 mb-4">
          {font.name ?? font.slug} · {font.is_free ? "ฟอนต์ฟรี" : "ฟอนต์ขาย"}
        </p>

        <div className="flex flex-col gap-2 mb-4">
          {checks.map((c) => (
            <div key={c.label} className="flex items-start gap-2.5">
              <span className={`mt-0.5 font-body text-body-sm leading-none ${c.ok ? "text-success" : c.required ? "text-danger-dark" : "text-warning"}`}>
                {c.ok ? "✓" : c.required ? "✗" : "⚠"}
              </span>
              <div className="flex-1">
                <span className={`font-body text-body-sm ${c.ok ? "text-grey-600" : "text-black"}`}>
                  {c.label}
                  {!c.ok && !c.required && <span className="font-body text-footnote text-warning ml-1.5">(ไม่บังคับ)</span>}
                </span>
                {!c.ok && c.hint && (
                  <p className="font-body text-footnote text-grey-600 mt-0.5 leading-[1.5]">{c.hint}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {requiredFailed.length > 0 && (
          <p className="font-body text-footnote text-danger-dark bg-surface px-3 py-2 mb-3">
            ยังขาดข้อบังคับ {requiredFailed.length} ข้อ — แก้ผ่านปุ่ม &quot;แก้ไข&quot; ก่อน
          </p>
        )}
        {requiredFailed.length === 0 && warnings.length > 0 && (
          <p className="font-body text-footnote text-warning bg-surface px-3 py-2 mb-3">
            มีคำเตือน {warnings.length} ข้อ — publish ได้ แต่แนะนำให้เติมให้ครบ
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="font-ui text-ui px-4 py-2 bg-surface text-black hover:bg-black hover:text-white transition-colors duration-150 ease-base border-none cursor-pointer"
          >
            ปิด
          </button>
          <button
            onClick={onPublish}
            disabled={!canPublish || publishing}
            className="font-ui text-ui px-5 py-2 bg-mint text-black border-none cursor-pointer hover:bg-black hover:text-white transition-colors duration-150 ease-base disabled:opacity-50 disabled:cursor-not-allowed"
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
    //
    // ยิงผ่าน /api/deploy แทนการยิง Cloudflare deploy hook ตรงจาก client —
    // hook URL เก็บเป็น secret ฝั่ง server เท่านั้น (ไม่ใช่ NEXT_PUBLIC_) กัน
    // ไม่ให้หลุดไปอยู่ใน JS bundle สาธารณะ endpoint จะตรวจสิทธิ์ admin ให้เอง
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const result = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && result?.ok) {
        showToast(`✓ Publish "${f.name ?? f.slug}" แล้ว — กำลัง deploy หน้าเว็บจะอัปเดตใน ~2 นาที`);
      } else {
        showToast(`✓ Publish "${f.name ?? f.slug}" แล้ว แต่สั่ง deploy ไม่สำเร็จ ต้อง deploy เอง (${result?.error ?? res.status})`);
      }
    } catch (e) {
      showToast(`✓ Publish "${f.name ?? f.slug}" แล้ว แต่สั่ง deploy ไม่สำเร็จ ต้อง deploy เอง: ${e instanceof Error ? e.message : String(e)}`);
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

  const GRID = "grid grid-cols-[52px_2fr_110px_90px_1fr_90px_140px_90px_170px] gap-3";

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-h2 text-black">Fonts</h1>
          <p className="font-body text-body-sm text-grey-600 mt-0.5">ฟอนต์ทั้งหมดจากทุก designer</p>
        </div>
        <div className="font-ui text-ui text-black bg-surface px-4 py-2">
          {fonts.length} ฟอนต์
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 font-ui text-ui border-none cursor-pointer transition-colors duration-150 ease-base flex items-center gap-1.5 ${tab === t.key ? "bg-mint text-black" : "bg-surface text-grey-600 hover:bg-grey-200"}`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className={`text-badge font-heading px-1.5 py-0.5 leading-none ${tab === t.key ? "bg-black/20 text-black" : "bg-danger text-white"}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface overflow-hidden">
        <div className={`${GRID} px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]`}>
          <div /><div>ฟอนต์</div><div>Designer</div><div>หมวดหมู่</div><div>Tags</div><div>ราคา</div><div>โปรโมชั่น</div><div>สถานะ</div><div>จัดการ</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">กำลังโหลด…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">ไม่มีฟอนต์ในหมวดนี้</div>
        ) : filtered.map((f) => (
          <div key={f.id} className={`${GRID} px-4 py-3 hover:bg-grey-200 transition-colors duration-150 ease-base items-center`}>
            <div>
              {f.cover_image_url
                ? <img src={f.cover_image_url} alt={f.name ?? ""} className="w-10 h-[22px] object-cover" />
                : <div className="w-10 h-[22px] bg-white" />}
            </div>
            <div>
              {f.designer_slug && f.published_at ? (
                <a href={`/fonts/${f.designer_slug}/${f.slug}`} target="_blank" rel="noopener" className="font-ui text-ui text-black no-underline hover:text-mint-text">{f.name ?? "—"}</a>
              ) : (
                <div className="font-ui text-ui text-black">{f.name ?? "—"}</div>
              )}
              {f.name_th && <div className="font-body text-footnote text-grey-600">{f.name_th}</div>}
            </div>
            <div className="font-body text-footnote text-grey-600 truncate">
              {f.designer_slug ? (
                <Link href={`/designer/${f.designer_slug}`} target="_blank" className="text-mint-text no-underline hover:underline">
                  {f.designer_slug}
                </Link>
              ) : <span className="text-grey-600">—</span>}
            </div>
            <div className="font-body text-body-sm text-grey-600 capitalize">{f.category ?? "—"}</div>
            <div className="font-body text-footnote text-grey-600 truncate">{(f.tags ?? []).slice(0, 3).join(", ") || "—"}</div>
            <div className="font-body text-body-sm text-black">
              {f.is_free ? <span className="text-mint-text">ฟรี</span> : f.price ? `฿${Number(f.price).toLocaleString()}` : "—"}
            </div>
            <div className="font-body text-footnote text-grey-600">
              {f.is_sale && f.discount_percent ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-warning font-ui text-ui">ลด {f.discount_percent}%</span>
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
                <span className={`text-badge font-heading px-2 py-0.5 ${f.is_active ? "bg-success text-white" : "bg-white text-grey-600"}`}>
                  {f.is_active ? "แสดงบนเว็บ" : "ซ่อน"}
                </span>
              ) : (
                <span className="text-badge font-heading px-2 py-0.5 bg-warning text-black">รอ Publish</span>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {f.published_at && (
                <button
                  onClick={() => toggleActive(f)}
                  className="font-ui text-ui px-2.5 py-1 bg-white text-black hover:bg-black hover:text-white transition-colors duration-150 ease-base border-none cursor-pointer"
                >
                  {f.is_active ? "ซ่อน" : "แสดง"}
                </button>
              )}
              {!f.published_at ? (
                <button
                  onClick={() => openReview(f)}
                  disabled={publishing === f.id}
                  className="font-ui text-ui px-2.5 py-1 bg-mint text-black border-none cursor-pointer hover:bg-black hover:text-white transition-colors duration-150 ease-base disabled:opacity-50"
                >
                  {publishing === f.id ? "…" : "ตรวจ & Publish"}
                </button>
              ) : (
                <button
                  onClick={() => setEditing(f)}
                  className="font-ui text-ui px-2.5 py-1 bg-white text-black hover:bg-black hover:text-white transition-colors duration-150 ease-base border-none cursor-pointer"
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
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-4 py-3 bg-black text-white font-body text-body-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
