"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayISO } from "@/lib/sale";
import { uploadFile, uploadProtectedFile, storagePath, type StorageBucket } from "@/lib/storage";
import { readFontFileMeta, summarizeFontMeta, type FontFileMeta, type FontMetaSummary } from "@/lib/font-meta";
import type { Database } from "@/lib/database.types";

type FontRow = Database["public"]["Tables"]["fonts"]["Row"];

interface Props {
  open: boolean;
  onClose: () => void;
  editingFont: FontRow | null;
  onSaved: () => void;
  ownerId?: string;
  mode?: "panel" | "page";
  /** ล็อกฟิลด์ระบุตัวตนฟอนต์ (ชื่อ EN/TH, slug, นักออกแบบ) ตอนแก้ไข — ใช้กับ designer กันแก้พลาด */
  lockIdentity?: boolean;
}

type PreviewItem = { type: "ex"; url: string } | { type: "new"; file: File; objectUrl: string };

type FontFileEntry = { type: "ex"; url: string; name: string } | { type: "new"; file: File; name: string };

const CATEGORIES = ["serif", "sans-serif", "display", "handwriting", "monospace"];

function Toast({ msg, error }: { msg: string; error?: boolean }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 font-body text-body-sm shadow-lg ${error ? "bg-danger text-white" : "bg-black text-white"}`}>
      {msg}
    </div>
  );
}

// ดาวน์โหลดไฟล์ที่อัปโหลดไว้แล้ว (type "ex") มาเป็น File เพื่ออ่าน metadata ข้างในไฟล์
// fonts-full เป็น private bucket เก็บเป็น storage path — ดาวน์โหลดได้เฉพาะเจ้าของ/แอดมิน (RLS 0059)
// free font เก็บเป็น public URL อยู่แล้ว — fetch ตรงได้เลย
// ไม่ throw — คืน null ถ้าดาวน์โหลดไม่ได้ ให้ผู้เรียกนับเป็นไฟล์ที่อ่านไม่ได้แทน
async function materializeFontFile(entry: FontFileEntry, bucket: "fonts-full" | "fonts-free"): Promise<File | null> {
  if (entry.type === "new") return entry.file;
  try {
    if (bucket === "fonts-full") {
      const { data, error } = await supabase.storage.from("fonts-full").download(entry.url);
      if (error || !data) return null;
      return new File([data], entry.name);
    }
    const res = await fetch(entry.url);
    if (!res.ok) return null;
    return new File([await res.blob()], entry.name);
  } catch {
    return null;
  }
}

// อ่าน metadata ของไฟล์ฟอนต์ทั้งชุด (ทั้งไฟล์ใหม่ที่เพิ่งเลือกและไฟล์ที่อัปโหลดไว้แล้ว) แล้วสรุปผล
async function computeMetaSummary(entries: FontFileEntry[], bucket: "fonts-full" | "fonts-free"): Promise<FontMetaSummary> {
  const metas: FontFileMeta[] = await Promise.all(
    entries.map(async (e) => {
      const file = await materializeFontFile(e, bucket);
      if (!file) {
        const dot = e.name.lastIndexOf(".");
        return {
          filename: e.name,
          family: null,
          subfamily: null,
          weightClass: null,
          italic: false,
          format: dot === -1 ? "" : e.name.slice(dot + 1).toUpperCase(),
          ok: false,
        };
      }
      return readFontFileMeta(file);
    })
  );
  return summarizeFontMeta(metas);
}

export default function FontForm({ open, onClose, editingFont, onSaved, ownerId, mode = "panel", lockIdentity = false }: Props) {
  // ล็อกเฉพาะตอนแก้ไข — ตอนเพิ่มฟอนต์ใหม่ยังต้องกรอกชื่อ/slug ได้
  const identityLocked = lockIdentity && !!editingFont;
  // role ใช้แค่แสดงหัว panel ให้ตรงกับคนเปิด (admin/designer ใช้ฟอร์มเดียวกัน)
  const { role } = useAuth();
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
  const [genProgress, setGenProgress] = useState<string | null>(null);
  // true ระหว่างรอ query font_files_private ตอนแก้ไขฟอนต์เดิม
  const [fullFontsLoading, setFullFontsLoading] = useState(false);

  // สรุป weight/style/format ที่อ่านได้จากข้างในไฟล์ฟอนต์ (ดู src/lib/font-meta.ts)
  const [metaSummary, setMetaSummary] = useState<FontMetaSummary | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  // ตัวเลขที่ designer แก้ไขได้ — เติมค่าอัตโนมัติให้ก่อน แล้วแก้ทับได้เสมอ
  const [weightOverride, setWeightOverride] = useState("");
  const [styleOverride, setStyleOverride] = useState("");

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
    setMetaSummary(null); setMetaLoading(false); setWeightOverride(""); setStyleOverride("");
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
    // เติมค่าเดิมจาก DB ไว้ก่อน — พออ่านไฟล์จริงเสร็จ (effect ด้านล่าง) จะเขียนทับด้วยค่าที่ถูกต้อง
    setWeightOverride(f.weight_count != null ? String(f.weight_count) : "");
    setStyleOverride(f.style_count != null ? String(f.style_count) : "");
    setMetaSummary(null);
    setCoverFile(null); setCoverUrl(f.cover_image_url ?? "");
    setPreviewItems((f.preview_images ?? []).map((url) => ({ type: "ex", url })));
    // ไฟล์ฟอนต์เต็มอยู่ในตาราง font_files_private (เก็บเป็น storage path)
    // อ่านได้เฉพาะเจ้าของ/แอดมินภายใต้ RLS
    // โหลดแบบ async — ต้องกันบันทึกระหว่างรอ ไม่งั้น validation จะเห็น fullFonts
    // ว่าง ๆ แล้วบล็อกทั้งที่ฟอนต์มีไฟล์อยู่จริง
    setFullFonts([]);
    setFullFontsLoading(true);
    supabase
      .from("font_files_private")
      .select("full_font_files")
      .eq("font_id", f.id)
      .maybeSingle()
      .then(({ data }) => {
        const paths = data?.full_font_files ?? [];
        setFullFonts(paths.map((p) => ({ type: "ex", url: p, name: p.split("/").pop() ?? p })));
        setFullFontsLoading(false);
      });
    setDemoFonts((f.demo_font_files ?? []).map((url) => ({ type: "ex", url, name: url.split("/").pop() ?? url })));
    setFreeFonts((f.free_font_files ?? []).map((url) => ({ type: "ex", url, name: url.split("/").pop() ?? url })));
    setSpecimens((f.specimen_files ?? []).map((url) => ({ type: "ex", url, name: url.split("/").pop() ?? url })));
  }, [open, editingFont, resetForm]);

  // อ่าน weight/style/format จากไฟล์จริง — ใช้ Full Family (ฟอนต์ขาย) หรือ Free Font
  // (ฟอนต์ฟรี) แล้วแต่ isFree, คำนวณใหม่ทุกครั้งที่รายการไฟล์เปลี่ยน (ไม่ใช่ทุก keystroke)
  useEffect(() => {
    if (!open) return;
    if (fullFontsLoading) return; // รอไฟล์เดิมโหลดจาก font_files_private ก่อน ไม่งั้นจะเห็นว่างแล้วเคลียร์ summary ผิด ๆ
    const relevant = isFree ? freeFonts : fullFonts;
    const bucket: "fonts-full" | "fonts-free" = isFree ? "fonts-free" : "fonts-full";
    if (!relevant.length) { setMetaSummary(null); setMetaLoading(false); return; }
    let cancelled = false;
    setMetaLoading(true);
    computeMetaSummary(relevant, bucket).then((summary) => {
      if (cancelled) return;
      setMetaSummary(summary);
      setMetaLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, isFree, fullFonts, freeFonts, fullFontsLoading]);

  // เติมช่องแก้ไขได้ให้ตรงกับผลอ่านอัตโนมัติล่าสุดเสมอ (designer แก้ทับเองได้หลังจากนี้)
  useEffect(() => {
    if (!metaSummary) return;
    setWeightOverride(String(metaSummary.weightCount));
    setStyleOverride(String(metaSummary.styleCount));
  }, [metaSummary]);

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

  // สร้าง demo อัตโนมัติจากไฟล์เต็ม — ประมวลผลในเบราว์เซอร์ด้วย fonttools
  // ผ่าน Pyodide (ดู src/lib/font-pipeline.ts) — ไม่บังคับ
  // คืน null พร้อม toast ถ้ายังไม่พร้อม generate
  const genInputs = (): { files: File[]; family: string } | null => {
    const files = fullFonts.flatMap((f) => (f.type === "new" ? [f.file] : []));
    if (!files.length) {
      showToast("ต้องมีไฟล์ Full Family ที่เลือกจากเครื่องก่อน (ไฟล์ที่อัปโหลดไว้แล้วใช้ generate ซ้ำไม่ได้)", true);
      return null;
    }
    const family = name.trim() || nameTh.trim();
    if (!family) {
      showToast("กรอกชื่อฟอนต์ก่อน generate (ใช้ตั้งชื่อไฟล์ DEMO)", true);
      return null;
    }
    return { files, family };
  };

  const handleGenerateDemo = async () => {
    const input = genInputs();
    if (!input) return;
    setGenProgress("เริ่มประมวลผล…");
    try {
      const { generateDemoFile } = await import("@/lib/font-pipeline");
      const demoFile = await generateDemoFile(input.files, input.family, setGenProgress);
      setDemoFonts([{ type: "new" as const, file: demoFile, name: demoFile.name }]);
      showToast("สร้าง demo เรียบร้อย — 1 ไฟล์");
    } catch (e) {
      showToast("สร้าง Demo ไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e)), true);
    } finally {
      setGenProgress(null);
    }
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
    // ส่วนลดต้องมีวันหมดอายุเสมอ — ไม่งั้นโปรฯ ไม่มีวันสิ้นสุดจริง (ดู isSaleActive ใน lib/sale)
    if (!isFree && (parseInt(discount) || 0) > 0 && !saleEnd) {
      showToast("กรุณาใส่วันสิ้นสุดโปรโมชั่น (ส่วนลดต้องมีวันหมดอายุ)", true); return;
    }
    if (fullFontsLoading) { showToast("กำลังโหลดรายการไฟล์เดิม รอสักครู่แล้วลองใหม่", true); return; }

    // ตรวจไฟล์ให้ครบ *ก่อน* เริ่มอัปโหลด — นับรวมไฟล์ที่อัปโหลดไว้แล้ว (type "ex")
    // ด้วย จึงแก้ไขฟอนต์เดิมที่มีไฟล์อยู่แล้วได้โดยไม่ต้องเลือกไฟล์ใหม่
    if (isFree) {
      if (!freeFonts.length) { showToast("ต้องแนบไฟล์ Free Font ก่อนบันทึก", true); return; }
    } else {
      if (!fullFonts.length) { showToast("ต้องแนบไฟล์ Full Family ก่อนบันทึก", true); return; }
    }

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

      // weight/style: ใช้ตัวเลขที่ designer แก้ไข ถ้ามี ไม่งั้นใช้ค่าที่อ่านอัตโนมัติจากไฟล์จริง
      // (ดู src/lib/font-meta.ts) — formats ไม่มี override เพราะดึงจากนามสกุลไฟล์ตรง ๆ อยู่แล้ว
      const weightCountVal = parseInt(weightOverride) || metaSummary?.weightCount || 0;
      const styleCountVal = parseInt(styleOverride) || metaSummary?.styleCount || 0;
      const formatsVal = metaSummary?.formats.length ? metaSummary.formats : null;

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
        // หน้า detail อ่าน full_font_files เองไม่ได้ (อยู่ใน private table) จึงต้องคำนวณเก็บไว้ตรงนี้
        weight_count: weightCountVal || null,
        style_count: styleCountVal || null,
        formats: formatsVal,
        owner_id: ownerId ?? null,
      };

      // เขียนผ่าน RLS ทางเดียวทั้ง admin และ designer (admin มี policy "admin full access fonts",
      // designer มี "designer insert/update own fonts") — เลิกใช้ RPC admin_upsert_font แล้ว
      let fontId: string | null = editingFont?.id ?? null;
      if (editingFont) {
        const updatePayload = { ...payload } as Database["public"]["Tables"]["fonts"]["Update"];
        if (identityLocked) {
          // ฟิลด์ identity ถูกล็อกใน UI — ตัดออกจาก payload ด้วย กันหลุดทุกทาง
          delete updatePayload.name;
          delete updatePayload.name_th;
          delete updatePayload.slug;
          delete updatePayload.designer_name;
        }
        const { error } = await supabase.from("fonts").update(updatePayload).eq("id", editingFont.id);
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

  const handleCancel = () => {
    if (!editingFont) localStorage.removeItem(DRAFT_KEY);
    onClose();
  };

  const leftCol = (
    <div className="flex flex-col gap-6">
      {/* ข้อมูลพื้นฐาน */}
      <section>
        <h3 className="font-ui text-ui text-black mb-3">ข้อมูลพื้นฐาน</h3>
        <div className="bg-surface p-5">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="ชื่อฟอนต์ (EN) *">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น SURATANA" className={inputCls} disabled={identityLocked} />
            </FormField>
            <FormField label="ชื่อฟอนต์ (TH)">
              <input value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder="เช่น สุรัตนา" className={inputCls} disabled={identityLocked} />
            </FormField>
            <FormField label="Slug (URL) *">
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="เช่น suratana" className={inputCls} disabled={identityLocked} />
            </FormField>
            <FormField label="นักออกแบบ">
              <input value={designerName} onChange={(e) => setDesignerName(e.target.value)} className={inputCls} disabled={identityLocked} />
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
          {identityLocked && (
            <p className="font-body text-footnote text-grey-600 mt-2">
              ชื่อฟอนต์ · Slug · นักออกแบบ แก้ไขไม่ได้ — หากต้องการเปลี่ยน กรุณาติดต่อแอดมิน
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 mt-3">
            <FormField label="คำอธิบาย (TH)">
              <textarea value={descTh} onChange={(e) => setDescTh(e.target.value)} className={textareaCls} placeholder="คำอธิบายภาษาไทย..." />
            </FormField>
            <FormField label="คำอธิบาย (EN)">
              <textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} className={textareaCls} placeholder="English description..." />
            </FormField>
          </div>
        </div>
      </section>

      {/* ราคาและโปรโมชั่น */}
      <section>
        <h3 className="font-ui text-ui text-black mb-3">ราคาและโปรโมชั่น</h3>
        <div className="bg-surface p-5">
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
                  <FormField label="วันสิ้นสุดโปรโมชั่น *">
                    <input type="date" value={saleEnd} min={todayISO()} onChange={(e) => setSaleEnd(e.target.value)} className={inputCls} />
                  </FormField>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* การแสดงผล */}
      <section>
        <h3 className="font-ui text-ui text-black mb-3">การแสดงผล</h3>
        <div className="bg-surface p-5">
          <div className="flex flex-col gap-3">
            <Toggle label="แสดงบนเว็บ" desc="ปิดเพื่อซ่อนโดยไม่ลบข้อมูล" checked={isActive} onChange={setIsActive} />
            <Toggle label="อยู่ใน Subscription" desc="รวมในแพลนรายเดือน — รับส่วนแบ่งจาก pool ตามยอดใช้งาน" checked={isSub} onChange={setIsSub} />
          </div>
        </div>
      </section>

    </div>
  );

  const rightCol = (
    <div className="flex flex-col gap-6">
      {/* รูปภาพ */}
      <section>
        <h3 className="font-ui text-ui text-black mb-3">รูปภาพ</h3>
        <div className="bg-surface p-5">
          <FormField label="Cover Image * — 1280×720 (16:9)">
            {coverUrl ? (
              <div className="relative inline-block">
                <img src={coverUrl} alt="cover" className="w-full object-cover aspect-video" />
                <button onClick={() => { setCoverFile(null); setCoverUrl(""); }} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-[12px] border-none cursor-pointer flex items-center justify-center">✕</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-6 bg-white cursor-pointer hover:bg-grey-200 transition-colors duration-150 ease-base">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-grey-400"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                <span className="font-body text-body-sm text-grey-600">คลิกเพื่อเลือกรูป Cover</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCoverFile(e.target.files[0])} />
              </label>
            )}
          </FormField>
          <FormField label="รูป Preview (ลากเพื่อเรียงลำดับ)" className="mt-3">
            <label className="flex items-center gap-2 px-4 py-2 bg-white cursor-pointer hover:bg-grey-200 transition-colors duration-150 ease-base w-fit font-body text-body-sm text-grey-600">
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
                    className={`relative aspect-video overflow-hidden cursor-grab select-none transition-all duration-150 ease-base ${
                      draggingIdx === i ? "opacity-40 outline outline-2 outline-dashed outline-mint" :
                      dragOverIdx === i ? "outline outline-2 outline-mint" :
                      "bg-white"
                    }`}
                  >
                    <img src={item.type === "ex" ? item.url : item.objectUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
                    <span className="absolute top-1 left-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 leading-none">{i + 1}</span>
                    <button onClick={() => removePreviewItem(i)} className="absolute top-1 right-1 w-[22px] h-[22px] rounded-full bg-black/60 text-white text-[11px] border-none cursor-pointer flex items-center justify-center hover:bg-danger transition-colors duration-150 ease-base">✕</button>
                    <div className="absolute bottom-1 left-1 text-[11px] bg-black/50 text-white px-1.5 py-0.5 leading-none select-none">⠿</div>
                  </div>
                ))}
              </div>
            )}
          </FormField>
        </div>
      </section>

      {/* ไฟล์ฟอนต์ */}
      <section>
        <h3 className="font-ui text-ui text-black mb-3">ไฟล์ฟอนต์</h3>
        {!isFree && (
          <>
            <FontFileSection label="Full Family *" badge="Protected" badgeColor="bg-danger text-white" files={fullFonts} onAdd={(f) => addFontFiles(f, setFullFonts)} onRemove={(i) => removeFontFile(i, setFullFonts)} accept=".otf,.ttf,.woff,.woff2" />

            <FontMetaSummaryBlock
              loading={metaLoading}
              summary={metaSummary}
              weightOverride={weightOverride}
              styleOverride={styleOverride}
              onWeightChange={setWeightOverride}
              onStyleChange={setStyleOverride}
            />

            {/* Auto-generate demo จากไฟล์เต็ม (ประมวลผลในเบราว์เซอร์) */}
            <div className="mt-2.5 bg-surface p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleGenerateDemo}
                  disabled={!!genProgress}
                  className="font-ui text-ui px-3.5 py-2 bg-white text-black cursor-pointer hover:bg-black hover:text-white transition-colors duration-150 ease-base disabled:opacity-50 border-none"
                >
                  สร้าง Demo
                </button>
                {genProgress && (
                  <span className="font-body text-footnote text-success animate-pulse">{genProgress}</span>
                )}
              </div>
              <p className="font-body text-footnote text-grey-600 mt-2 leading-[1.6]">
                สร้างจากไฟล์ Full Family ที่เลือกไว้ด้านบน เติมลงช่องด้านล่างให้อัตโนมัติ<br />
                <b>สร้าง Demo</b> — ได้ demo ภาษาไทย (Regular) 1 ไฟล์ <b>ไม่บังคับ</b> ข้ามได้ ถ้าไม่ต้องการแจก demo<br />
                ประมวลผลในเบราว์เซอร์ทั้งหมด ครั้งแรกจะโหลดเครื่องมือ ~10MB
              </p>
            </div>

            <FontFileSection label="Demo Font (ให้ลูกค้าดาวน์โหลดทดลอง) — ไม่บังคับ" badge="Public" badgeColor="bg-success text-white" files={demoFonts} onAdd={(f) => addFontFiles(f, setDemoFonts)} onRemove={(i) => removeFontFile(i, setDemoFonts)} accept=".otf,.ttf,.woff,.woff2" className="mt-3" />
          </>
        )}
        {isFree && (
          <>
            <FontFileSection label="Free Font*" badge="Public" badgeColor="bg-success text-white" files={freeFonts} onAdd={(f) => addFontFiles(f, setFreeFonts)} onRemove={(i) => removeFontFile(i, setFreeFonts)} accept=".otf,.ttf,.woff,.woff2" />
            <FontMetaSummaryBlock
              loading={metaLoading}
              summary={metaSummary}
              weightOverride={weightOverride}
              styleOverride={styleOverride}
              onWeightChange={setWeightOverride}
              onStyleChange={setStyleOverride}
            />
          </>
        )}
        <FontFileSection label="Font Specimen PDF" badge="Public" badgeColor="bg-success text-white" files={specimens} onAdd={(f) => addFontFiles(f, setSpecimens)} onRemove={(i) => removeFontFile(i, setSpecimens)} accept=".pdf" className="mt-3" />
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
        <div className="flex-1 overflow-y-auto p-6 w-full">
          <h1 className="font-heading text-h2 text-black mb-6">{editingFont ? "แก้ไขฟอนต์" : "เพิ่มฟอนต์"}</h1>
          <div className="grid grid-cols-2 gap-8 max-w-[1200px]">
            {leftCol}
            {rightCol}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white px-6 py-4 flex justify-end gap-2 max-w-[1200px] w-full">
          {saving && <span className="font-body text-body-sm text-grey-600 mr-auto self-center">⏳ กำลังบันทึก…</span>}
          <button onClick={handleCancel} disabled={saving} className="font-ui text-ui px-4 py-2 bg-surface text-black hover:bg-black hover:text-white transition-colors duration-150 ease-base disabled:opacity-50 border-none cursor-pointer">
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving} className="font-ui text-ui px-5 py-2 bg-mint text-black hover:bg-black hover:text-white transition-colors duration-150 ease-base disabled:opacity-50 border-none cursor-pointer">
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
        <div className="flex items-center justify-between px-6 py-4 bg-surface flex-shrink-0">
          <div>
            <span className="font-body text-footnote text-grey-600 tracking-wide">{role === "admin" ? "Admin" : "Designer"} → </span>
            <span className="font-ui text-ui text-black">{editingFont ? `แก้ไข — ${editingFont.name}` : "เพิ่มฟอนต์ใหม่"}</span>
          </div>
          <button onClick={handleCancel} className="text-grey-600 hover:text-black text-xl bg-transparent border-none cursor-pointer leading-none transition-colors duration-150 ease-base">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {formSections}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface flex-shrink-0">
          {saving && <span className="font-body text-body-sm text-grey-600">⏳ กำลังบันทึก…</span>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} disabled={saving} className="font-ui text-ui px-4 py-2 bg-white text-black hover:bg-black hover:text-white transition-colors duration-150 ease-base disabled:opacity-50 border-none cursor-pointer">
              ยกเลิก
            </button>
            <button onClick={handleSave} disabled={saving} className="font-ui text-ui px-5 py-2 bg-mint text-black hover:bg-black hover:text-white transition-colors duration-150 ease-base disabled:opacity-50 border-none cursor-pointer">
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

const inputCls = "w-full px-3 py-2 h-[42px] bg-white font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base disabled:bg-grey-200 disabled:text-grey-600 disabled:cursor-not-allowed";

// เหมือน inputCls แต่เอา h-[42px] ออก (ไม่งั้นมัน override rows) + สูงขั้นต่ำ 170px (ลดลงจาก 210px ~20%) + ลากขยายได้
const textareaCls = "w-full px-3 py-2 min-h-[170px] bg-white font-body text-body-sm text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-colors duration-150 ease-base resize-y";

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="font-body text-body-sm text-grey-600">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="font-body text-body-sm text-black">{label}</div>
        <div className="font-body text-footnote text-grey-600">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors duration-150 ease-base border-none cursor-pointer flex-shrink-0 ${checked ? "bg-mint" : "bg-grey-200"}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-150 ease-base ${checked ? "left-5" : "left-1"}`} />
      </button>
    </div>
  );
}

// สรุปผลอ่าน weight/style/format จากข้างในไฟล์ฟอนต์ + ช่องแก้ไขตัวเลขเอง (ยังบันทึกได้แม้อ่านไม่ครบ)
function FontMetaSummaryBlock({
  loading, summary, weightOverride, styleOverride, onWeightChange, onStyleChange,
}: {
  loading: boolean;
  summary: FontMetaSummary | null;
  weightOverride: string;
  styleOverride: string;
  onWeightChange: (v: string) => void;
  onStyleChange: (v: string) => void;
}) {
  if (loading) {
    return <p className="font-body text-body-sm text-grey-600 mt-2.5">กำลังอ่านข้อมูลจากไฟล์ฟอนต์…</p>;
  }
  if (!summary) return null;
  return (
    <div className="mt-2.5 bg-surface p-3">
      <p className="font-ui text-ui text-black">
        {summary.weightCount} weights · {summary.styleCount} styles
        {summary.formats.length > 0 && <> · {summary.formats.join(", ")}</>}
      </p>
      {summary.families.length > 1 && (
        <p className="font-body text-footnote text-grey-600 mt-1">
          {summary.families.length} ตระกูล: {summary.families.join(", ")}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 mt-2.5">
        <FormField label="จำนวน Weight (อ่านอัตโนมัติ แก้ไขได้)">
          <input type="number" min="0" value={weightOverride} onChange={(e) => onWeightChange(e.target.value)} className={`${inputCls} bg-white`} />
        </FormField>
        <FormField label="จำนวน Style (อ่านอัตโนมัติ แก้ไขได้)">
          <input type="number" min="0" value={styleOverride} onChange={(e) => onStyleChange(e.target.value)} className={`${inputCls} bg-white`} />
        </FormField>
      </div>
      {summary.failed.length > 0 && (
        <p className="font-body text-footnote text-black bg-warning px-3 py-2 mt-2.5">
          ⚠ อ่านข้อมูลจากไฟล์นี้ไม่ได้: {summary.failed.join(", ")} — กรุณาตรวจสอบ/กรอกจำนวน weight และ style เองด้านบน
        </p>
      )}
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
    <div className={`bg-surface p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-ui text-ui text-black">{label}</span>
        <span className={`text-badge font-heading px-2 py-0.5 ${badgeColor}`}>{badge}</span>
      </div>
      <label className="flex items-center gap-2 px-3 py-1.5 bg-white cursor-pointer hover:bg-grey-200 transition-colors duration-150 ease-base w-fit font-body text-footnote text-grey-600">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        เลือกไฟล์
        <input type="file" accept={accept} multiple className="hidden" onChange={(e) => e.target.files && onAdd(Array.from(e.target.files))} />
      </label>
      {files.length > 0 && (() => {
        // จัดกลุ่มไฟล์ตามนามสกุลเพื่อแสดงผลเท่านั้น — ไม่แก้ลำดับ/ไม่แตะ array ต้นฉบับ
        // เก็บ index เดิมของแต่ละไฟล์ไว้คู่กัน เพื่อให้ onRemove ลบตัวที่ถูกต้องใน files ต้นฉบับ
        const groups = new Map<string, { f: FontFileEntry; originalIndex: number }[]>();
        files.forEach((f, i) => {
          const ext = f.name.split(".").pop()?.toUpperCase() ?? "";
          if (!groups.has(ext)) groups.set(ext, []);
          groups.get(ext)!.push({ f, originalIndex: i });
        });
        return (
          <div className="mt-2 flex flex-col gap-1">
            {Array.from(groups.entries()).map(([ext, items]) => (
              <div key={ext}>
                <div className="font-body text-footnote text-grey-600 mt-2 mb-1">{ext}</div>
                <div className="flex flex-col gap-1">
                  {items.map(({ f, originalIndex }) => (
                    <div key={originalIndex} className="flex items-center justify-between px-2 py-1 bg-white font-body text-footnote text-grey-600">
                      <span className="truncate mr-2">{f.name}</span>
                      <button onClick={() => onRemove(originalIndex)} className="text-grey-600 hover:text-danger-dark bg-transparent border-none cursor-pointer text-[14px] leading-none flex-shrink-0 transition-colors duration-150 ease-base">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
