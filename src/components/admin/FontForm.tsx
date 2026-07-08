"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { uploadFile, uploadProtectedFile, storagePath, type StorageBucket } from "@/lib/storage";
import type { Database } from "@/lib/database.types";

type FontRow = Database["public"]["Tables"]["fonts"]["Row"];

interface Props {
  open: boolean;
  onClose: () => void;
  editingFont: FontRow | null;
  onSaved: () => void;
  ownerId?: string;
  isAdmin?: boolean;
  mode?: "panel" | "page";
}

type PreviewItem = { type: "ex"; url: string } | { type: "new"; file: File; objectUrl: string };

type FontFileEntry = { type: "ex"; url: string; name: string } | { type: "new"; file: File; name: string };

const CATEGORIES = ["serif", "sans-serif", "display", "handwriting", "monospace"];

function Toast({ msg, error }: { msg: string; error?: boolean }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl text-[13px] font-medium shadow-lg transition-all ${error ? "bg-red-500 text-white" : "bg-navy text-white"}`}>
      {msg}
    </div>
  );
}

export default function FontForm({ open, onClose, editingFont, onSaved, ownerId, isAdmin = true, mode = "panel" }: Props) {
  const [name, setName] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [slug, setSlug] = useState("");
  const [designerName, setDesignerName] = useState("");
  const [category, setCategory] = useState("serif");
  const [tags, setTags] = useState("");
  const [descTh, setDescTh] = useState("");
  const [descEn, setDescEn] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [saleLabel, setSaleLabel] = useState("");
  const [saleEnd, setSaleEnd] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFree, setIsFree] = useState(false);
  const [isSub, setIsSub] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  // Images
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const [dragOverIdx, setDragOverIdx] = useState(-1);
  const dragIdx = useRef(-1);

  // Font files
  const [fullFonts, setFullFonts] = useState<FontFileEntry[]>([]);
  const [demoFonts, setDemoFonts] = useState<FontFileEntry[]>([]);
  const [freeFonts, setFreeFonts] = useState<FontFileEntry[]>([]);
  const [specimens, setSpecimens] = useState<FontFileEntry[]>([]);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = useCallback(() => {
    setName(""); setNameTh(""); setSlug(""); setDesignerName("");
    setCategory("serif"); setTags(""); setDescTh(""); setDescEn("");
    setPrice(""); setDiscount(""); setSaleLabel(""); setSaleEnd("");
    setIsActive(true); setIsFree(false); setIsSub(true);
    setCoverFile(null); setCoverUrl(""); setPreviewItems([]);
    setFullFonts([]); setDemoFonts([]); setFreeFonts([]); setSpecimens([]);
  }, []);

  // Load designer name from user's business_name when adding new font
  useEffect(() => {
    if (!open || editingFont || !ownerId) return;
    supabase.from("users").select("business_name, name").eq("id", ownerId).single().then(({ data }) => {
      if (data) setDesignerName(data.business_name || data.name || "");
    });
  }, [open, editingFont, ownerId]);

  useEffect(() => {
    if (!open) return;
    if (!editingFont) { resetForm(); return; }
    const f = editingFont;
    setName(f.name ?? ""); setNameTh(f.name_th ?? "");
    setSlug(f.slug); setDesignerName(f.designer_name ?? "ธรรมดาสตูดิโอ");
    setCategory(f.category ?? "serif");
    setTags((f.tags ?? []).join(", "));
    setDescTh(f.description_th ?? ""); setDescEn(f.description_en ?? "");
    setPrice(f.price?.toString() ?? "");
    setDiscount(f.discount_percent?.toString() ?? "");
    setSaleLabel(f.sale_label ?? ""); setSaleEnd(f.sale_end ?? "");
    setIsActive(f.is_active); setIsFree(f.is_free); setIsSub(f.is_subscription);
    setCoverFile(null); setCoverUrl(f.cover_image_url ?? "");
    setPreviewItems((f.preview_images ?? []).map((url) => ({ type: "ex", url })));
    // ไฟล์ฟอนต์เต็มอยู่ในตาราง font_files_private (เก็บเป็น storage path)
    // อ่านได้เฉพาะเจ้าของ/แอดมินภายใต้ RLS
    setFullFonts([]);
    supabase
      .from("font_files_private")
      .select("full_font_files")
      .eq("font_id", f.id)
      .maybeSingle()
      .then(({ data }) => {
        const paths = data?.full_font_files ?? [];
        setFullFonts(paths.map((p) => ({ type: "ex", url: p, name: p.split("/").pop() ?? p })));
      });
    setDemoFonts((f.demo_font_files ?? []).map((url) => ({ type: "ex", url, name: url.split("/").pop() ?? url })));
    setFreeFonts((f.free_font_files ?? []).map((url) => ({ type: "ex", url, name: url.split("/").pop() ?? url })));
    setSpecimens((f.specimen_files ?? []).map((url) => ({ type: "ex", url, name: url.split("/").pop() ?? url })));
  }, [open, editingFont, resetForm]);

  // localStorage draft cache (new font only, text fields)
  const DRAFT_KEY = "font_form_draft";
  useEffect(() => {
    if (editingFont) return;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.name) setName(d.name);
      if (d.nameTh) setNameTh(d.nameTh);
      if (d.slug) setSlug(d.slug);
      if (d.designerName) setDesignerName(d.designerName);
      if (d.category) setCategory(d.category);
      if (d.tags) setTags(d.tags);
      if (d.descTh) setDescTh(d.descTh);
      if (d.descEn) setDescEn(d.descEn);
      if (d.price) setPrice(d.price);
      if (d.discount) setDiscount(d.discount);
      if (d.saleLabel) setSaleLabel(d.saleLabel);
      if (d.saleEnd) setSaleEnd(d.saleEnd);
      if (typeof d.isActive === "boolean") setIsActive(d.isActive);
      if (typeof d.isFree === "boolean") setIsFree(d.isFree);
      if (typeof d.isSub === "boolean") setIsSub(d.isSub);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingFont]);

  useEffect(() => {
    if (editingFont) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, nameTh, slug, designerName, category, tags, descTh, descEn, price, discount, saleLabel, saleEnd, isActive, isFree, isSub }));
  }, [name, nameTh, slug, designerName, category, tags, descTh, descEn, price, discount, saleLabel, saleEnd, isActive, isFree, isSub, editingFont]);

  // Auto-fill slug from name EN (new font only)
  useEffect(() => {
    if (editingFont) return;
    const auto = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
    setSlug(auto);
  }, [name, editingFont]);

  // Auto-fill sale label when discount changes
  useEffect(() => {
    const d = parseInt(discount) || 0;
    setSaleLabel(d > 0 ? `ลด ${d}%` : "");
  }, [discount]);

  const handleCoverFile = (f: File) => {
    setCoverFile(f); setCoverUrl(URL.createObjectURL(f));
  };

  const addFontFiles = (files: File[], setter: React.Dispatch<React.SetStateAction<FontFileEntry[]>>) => {
    setter((prev) => [...prev, ...Array.from(files).map((f) => ({ type: "new" as const, file: f, name: f.name }))]);
  };

  const removeFontFile = (idx: number, setter: React.Dispatch<React.SetStateAction<FontFileEntry[]>>) => {
    setter((prev) => prev.filter((_, i) => i !== idx));
  };

  const addPreviewFiles = (files: FileList) => {
    const items: PreviewItem[] = Array.from(files).map((f) => ({ type: "new", file: f, objectUrl: URL.createObjectURL(f) }));
    setPreviewItems((prev) => [...prev, ...items]);
  };

  const removePreviewItem = (idx: number) => setPreviewItems((prev) => prev.filter((_, i) => i !== idx));

  const onDragStart = (idx: number) => { dragIdx.current = idx; setDraggingIdx(idx); };
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current !== -1 && dragIdx.current !== idx) {
      setPreviewItems((prev) => {
        const arr = [...prev];
        const [moved] = arr.splice(dragIdx.current, 1);
        arr.splice(idx, 0, moved);
        return arr;
      });
    }
    dragIdx.current = -1; setDraggingIdx(-1); setDragOverIdx(-1);
  };
  const onDragEnd = () => { dragIdx.current = -1; setDraggingIdx(-1); setDragOverIdx(-1); };

  async function uploadFontFiles(entries: FontFileEntry[], bucket: StorageBucket, slugVal: string): Promise<string[]> {
    const results: string[] = [];
    for (const e of entries) {
      if (e.type === "ex") { results.push(e.url); continue; }
      const path = storagePath(slugVal, bucket, e.name);
      // fonts-full เป็น private bucket — เก็บเป็น path, ที่เหลือเป็น public URL
      const url = bucket === "fonts-full"
        ? await uploadProtectedFile(bucket, path, e.file)
        : await uploadFile(bucket, path, e.file);
      results.push(url);
    }
    return results;
  }

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) { showToast("กรุณาใส่ชื่อฟอนต์และ Slug", true); return; }
    setSaving(true);
    try {
      const slugVal = slug.trim().toLowerCase();

      // Upload cover
      let finalCover = coverUrl;
      if (coverFile) {
        try {
          finalCover = await uploadFile("covers", storagePath(slugVal, "covers", coverFile.name), coverFile);
        } catch (e) { throw new Error("[Cover upload] " + (e instanceof Error ? e.message : String(e))); }
      }

      // Upload preview images
      const finalPreviews: string[] = [];
      for (const item of previewItems) {
        if (item.type === "ex") { finalPreviews.push(item.url); continue; }
        try {
          const url = await uploadFile("previews", storagePath(slugVal, "previews", item.file.name), item.file);
          finalPreviews.push(url);
        } catch (e) { throw new Error("[Preview upload] " + (e instanceof Error ? e.message : String(e))); }
      }

      // Upload font files
      let finalFull: string[], finalDemo: string[], finalFree: string[], finalSpec: string[];
      try { finalFull = await uploadFontFiles(fullFonts, "fonts-full", slugVal); } catch (e) { throw new Error("[Full font upload] " + (e instanceof Error ? e.message : String(e))); }
      try { finalDemo = await uploadFontFiles(demoFonts, "fonts-demo", slugVal); } catch (e) { throw new Error("[Demo font upload] " + (e instanceof Error ? e.message : String(e))); }
      try { finalFree = await uploadFontFiles(freeFonts, "fonts-free", slugVal); } catch (e) { throw new Error("[Free font upload] " + (e instanceof Error ? e.message : String(e))); }
      try { finalSpec = await uploadFontFiles(specimens, "specimens", slugVal); } catch (e) { throw new Error("[Specimen upload] " + (e instanceof Error ? e.message : String(e))); }

      const discountVal = parseInt(discount) || 0;
      const priceVal = parseFloat(price) || null;

      const payload = {
        name: name.trim(),
        name_th: nameTh.trim() || null,
        slug: slugVal,
        designer_name: designerName.trim() || null,
        category,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        description_th: descTh.trim() || null,
        description_en: descEn.trim() || null,
        price: priceVal,
        discount_percent: discountVal || null,
        sale_price: priceVal && discountVal ? Math.round(priceVal * (1 - discountVal / 100)) : null,
        is_sale: discountVal > 0,
        sale_label: saleLabel.trim() || null,
        sale_end: saleEnd || null,
        is_active: isActive,
        is_free: isFree,
        is_subscription: isSub,
        cover_image_url: finalCover || null,
        preview_images: finalPreviews.length ? finalPreviews : null,
        demo_font_files: finalDemo.length ? finalDemo : null,
        free_font_files: finalFree.length ? finalFree : null,
        specimen_files: finalSpec.length ? finalSpec : null,
        has_demo: finalDemo.length > 0,
        weight_count: finalFull.length || finalFree.length || null,
        owner_id: ownerId ?? null,
      };

      let fontId: string | null = editingFont?.id ?? null;
      if (isAdmin) {
        // Use SECURITY DEFINER RPC to bypass RLS for admin operations
        const { data, error } = await supabase.rpc("admin_upsert_font", {
          p_id: editingFont?.id ?? null,
          p_data: payload,
        });
        if (error) throw error;
        fontId = (data as { id?: string } | null)?.id ?? fontId;
      } else if (editingFont) {
        const { error } = await supabase.from("fonts").update(payload as Database["public"]["Tables"]["fonts"]["Update"]).eq("id", editingFont.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("fonts").insert(payload as Database["public"]["Tables"]["fonts"]["Insert"]).select("id").single();
        if (error) throw error;
        fontId = (data as { id: string } | null)?.id ?? null;
      }

      // ไฟล์ฟอนต์เต็ม (storage paths) เก็บแยกในตาราง RLS เฉพาะเจ้าของ/แอดมิน
      if (fontId) {
        const { error: filesError } = await supabase.from("font_files_private").upsert({
          font_id: fontId,
          full_font_files: finalFull.length ? finalFull : null,
        });
        if (filesError) throw new Error("[Full font files] " + filesError.message);
      }
      showToast(editingFont ? "✓ อัปเดตฟอนต์เรียบร้อย" : "✓ เพิ่มฟอนต์เรียบร้อย");
      if (!editingFont) localStorage.removeItem(DRAFT_KEY);
      onSaved();
      onClose();

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as Record<string, unknown>)?.message as string ?? String(e);
      const hint = (e as Record<string, unknown>)?.hint as string ?? "";
      const details = (e as Record<string, unknown>)?.details as string ?? "";
      showToast("เกิดข้อผิดพลาด: " + [msg, hint, details].filter(Boolean).join(" | "), true);
    } finally {
      setSaving(false);
    }
  };

  const movePreview = (from: number, to: number) => {
    setPreviewItems((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const handleCancel = () => {
    if (!editingFont) localStorage.removeItem(DRAFT_KEY);
    onClose();
  };

  const leftCol = (
    <div className="flex flex-col gap-6">
      {/* ข้อมูลพื้นฐาน */}
      <section>
        <h3 className="text-[11px] font-semibold text-[#aaa] tracking-[0.07em] uppercase mb-3 pb-2 border-b border-border">ข้อมูลพื้นฐาน</h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="ชื่อฟอนต์ (EN)*">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น SURATANA" className={inputCls} />
          </FormField>
          <FormField label="ชื่อฟอนต์ (TH)">
            <input value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder="เช่น สุรัตนา" className={inputCls} />
          </FormField>
          <FormField label="Slug (URL)*">
            <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="เช่น suratana" className={inputCls} />
          </FormField>
          <FormField label="นักออกแบบ">
            <input value={designerName} onChange={(e) => setDesignerName(e.target.value)} className={inputCls} />
          </FormField>
          <FormField label="หมวดหมู่">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Tags (คั่นด้วย comma)">
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="thai, display, bold" className={inputCls} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-3 mt-3">
          <FormField label="คำอธิบาย (TH)">
            <textarea value={descTh} onChange={(e) => setDescTh(e.target.value)} rows={4} className={inputCls} placeholder="คำอธิบายภาษาไทย..." />
          </FormField>
          <FormField label="คำอธิบาย (EN)">
            <textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={4} className={inputCls} placeholder="English description..." />
          </FormField>
        </div>
      </section>

      {/* ราคาและโปรโมชั่น */}
      <section>
        <h3 className="text-[11px] font-semibold text-[#aaa] tracking-[0.07em] uppercase mb-3 pb-2 border-b border-border">ราคาและโปรโมชั่น</h3>
        <Toggle label="ฟอนต์ฟรี" desc="ดาวน์โหลดได้เลยโดยไม่ต้องชำระเงิน" checked={isFree} onChange={setIsFree} />
        {!isFree && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ราคาปกติ (฿)">
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" min="0" className={inputCls} />
              </FormField>
              <FormField label="ส่วนลด %">
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="เช่น 30" min="0" max="100" className={inputCls} />
              </FormField>
            </div>
            {parseInt(discount) > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="ข้อความโปรโมชั่น (badge)">
                  <input value={saleLabel} onChange={(e) => setSaleLabel(e.target.value)} placeholder="เช่น ลด 30%" className={inputCls} />
                </FormField>
                <FormField label="วันสิ้นสุดโปรโมชั่น">
                  <input type="date" value={saleEnd} onChange={(e) => setSaleEnd(e.target.value)} className={inputCls} />
                </FormField>
              </div>
            )}
          </div>
        )}
      </section>

      {/* การแสดงผล */}
      <section>
        <h3 className="text-[11px] font-semibold text-[#aaa] tracking-[0.07em] uppercase mb-3 pb-2 border-b border-border">การแสดงผล</h3>
        <div className="flex flex-col gap-3">
          <Toggle label="แสดงบนเว็บ" desc="ปิดเพื่อซ่อนโดยไม่ลบข้อมูล" checked={isActive} onChange={setIsActive} />
          <Toggle label="อยู่ใน Subscription" desc="รวมอยู่ในแพลนรายเดือน" checked={isSub} onChange={setIsSub} />
        </div>
      </section>

    </div>
  );

  const rightCol = (
    <div className="flex flex-col gap-6">
      {/* รูปภาพ */}
      <section>
        <h3 className="text-[11px] font-semibold text-[#aaa] tracking-[0.07em] uppercase mb-3 pb-2 border-b border-border">รูปภาพ</h3>
        <FormField label="Cover Image* — 1280×720 (16:9)">
          {coverUrl ? (
            <div className="relative inline-block">
              <img src={coverUrl} alt="cover" className="w-full rounded-xl object-cover aspect-video" />
              <button onClick={() => { setCoverFile(null); setCoverUrl(""); }} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-[12px] border-none cursor-pointer flex items-center justify-center">✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-[#ddd] bg-[#fafaf8] cursor-pointer hover:border-mint transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#ccc]"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              <span className="text-[13px] text-[#aaa]">คลิกเพื่อเลือกรูป Cover</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCoverFile(e.target.files[0])} />
            </label>
          )}
        </FormField>
        <FormField label="รูป Preview (ลากเพื่อเรียงลำดับ)" className="mt-3">
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-[#fafaf8] cursor-pointer hover:border-mint transition-colors w-fit text-[13px] text-[#666]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            เพิ่มรูป Preview
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addPreviewFiles(e.target.files)} />
          </label>
          {previewItems.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {previewItems.map((item, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragOver={(e) => onDragOver(e, i)}
                  onDrop={(e) => onDrop(e, i)}
                  onDragEnd={onDragEnd}
                  className={`relative aspect-video rounded-lg overflow-hidden border cursor-grab select-none transition-all ${
                    draggingIdx === i ? "opacity-40 border-dashed border-mint border-2" :
                    dragOverIdx === i ? "border-mint border-2 shadow-[0_0_0_3px_#5ECEC840]" :
                    "border-border"
                  }`}
                >
                  <img src={item.type === "ex" ? item.url : item.objectUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
                  <span className="absolute top-1 left-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded font-medium leading-none">{i + 1}</span>
                  <button onClick={() => removePreviewItem(i)} className="absolute top-1 right-1 w-[22px] h-[22px] rounded-full bg-black/60 text-white text-[11px] border-none cursor-pointer flex items-center justify-center hover:bg-red-600 transition-colors">✕</button>
                  <div className="absolute bottom-1 left-1 text-[11px] bg-black/50 text-white px-1.5 py-0.5 rounded leading-none select-none">⠿</div>
                </div>
              ))}
            </div>
          )}
        </FormField>
      </section>

      {/* ไฟล์ฟอนต์ */}
      <section>
        <h3 className="text-[11px] font-semibold text-[#aaa] tracking-[0.07em] uppercase mb-3 pb-2 border-b border-border">ไฟล์ฟอนต์</h3>
        {!isFree && (
          <>
            <FontFileSection label="Full Family*" badge="🔒 Protected" badgeColor="bg-red-50 text-red-600" files={fullFonts} onAdd={(f) => addFontFiles(f, setFullFonts)} onRemove={(i) => removeFontFile(i, setFullFonts)} accept=".otf,.ttf,.woff,.woff2" />
            <FontFileSection label="Demo Font" badge="🌐 Public" badgeColor="bg-mint-light text-mint" files={demoFonts} onAdd={(f) => addFontFiles(f, setDemoFonts)} onRemove={(i) => removeFontFile(i, setDemoFonts)} accept=".otf,.ttf,.woff,.woff2" className="mt-3" />
          </>
        )}
        {isFree && (
          <FontFileSection label="Free Font*" badge="🌐 Public" badgeColor="bg-mint-light text-mint" files={freeFonts} onAdd={(f) => addFontFiles(f, setFreeFonts)} onRemove={(i) => removeFontFile(i, setFreeFonts)} accept=".otf,.ttf,.woff,.woff2" />
        )}
        <FontFileSection label="Font Specimen PDF" badge="🌐 Public" badgeColor="bg-mint-light text-mint" files={specimens} onAdd={(f) => addFontFiles(f, setSpecimens)} onRemove={(i) => removeFontFile(i, setSpecimens)} accept=".pdf" className="mt-3" />
      </section>
    </div>
  );

  const formSections = (
    <>
      {leftCol}
      {rightCol}
    </>
  );

  if (mode === "page") {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <div className="flex-1 overflow-y-auto px-6 py-5 w-full">
          <div className="grid grid-cols-2 gap-8 max-w-[1100px] mx-auto">
            {leftCol}
            {rightCol}
          </div>
        </div>
        <div className="sticky bottom-0 border-t border-border bg-white px-6 py-4 flex justify-end gap-2 max-w-[720px] mx-auto w-full">
          {saving && <span className="text-[13px] text-[#aaa] mr-auto self-center">⏳ กำลังบันทึก…</span>}
          <button onClick={handleCancel} disabled={saving} className="px-4 py-2 rounded-xl border border-border text-[14px] text-[#666] bg-white hover:bg-[#f5f5f2] cursor-pointer transition-colors disabled:opacity-50">
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-mint text-white text-[14px] font-medium border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors disabled:opacity-50">
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
        {toast && <Toast msg={toast.msg} error={toast.error} />}
      </div>
    );
  }

  return (
    <>
      {/* Overlay — no click-to-close to prevent accidental data loss */}
      <div
        className={`fixed inset-0 z-[90] bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-full max-w-[680px] bg-white z-[100] flex flex-col shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <span className="text-[11px] text-[#aaa] tracking-wide">Admin → </span>
            <span className="text-[14px] font-semibold text-navy">{editingFont ? `แก้ไข — ${editingFont.name}` : "เพิ่มฟอนต์ใหม่"}</span>
          </div>
          <button onClick={handleCancel} className="text-[#aaa] hover:text-navy text-xl bg-transparent border-none cursor-pointer leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {formSections}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0 bg-white">
          {saving && <span className="text-[13px] text-[#aaa]">⏳ กำลังบันทึก…</span>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-border text-[14px] text-[#666] bg-white hover:bg-[#f5f5f2] cursor-pointer transition-colors disabled:opacity-50">
              ยกเลิก
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-mint text-white text-[14px] font-medium border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} error={toast.error} />}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 h-[42px] rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]";

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[12px] font-medium text-[#666]">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#f5f5f2] last:border-0">
      <div>
        <div className="text-[14px] text-navy font-medium">{label}</div>
        <div className="text-[12px] text-[#aaa]">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors border-none cursor-pointer flex-shrink-0 ${checked ? "bg-mint" : "bg-[#ddd]"}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-1"}`} />
      </button>
    </div>
  );
}

function FontFileSection({
  label, badge, badgeColor, files, onAdd, onRemove, accept, className = ""
}: {
  label: string; badge: string; badgeColor: string;
  files: FontFileEntry[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void;
  accept: string; className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[13px] font-medium text-navy">{label}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
      </div>
      <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-[#fafaf8] cursor-pointer hover:border-mint transition-colors w-fit text-[12px] text-[#666]">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        เลือกไฟล์
        <input type="file" accept={accept} multiple className="hidden" onChange={(e) => e.target.files && onAdd(Array.from(e.target.files))} />
      </label>
      {files.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-1 rounded-lg bg-[#fafaf8] text-[12px] text-[#555]">
              <span className="truncate mr-2">{f.name}</span>
              <button onClick={() => onRemove(i)} className="text-[#bbb] hover:text-red-500 bg-transparent border-none cursor-pointer text-[14px] leading-none flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
