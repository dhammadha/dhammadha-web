"use client";

// "ดาวน์โหลดของฉัน" — ฟอนต์ทุกตัวที่ลูกค้ามีสิทธิ์ (จาก entitlements หลังยืนยันรับชำระ)
// ดาวน์โหลดผ่าน Edge Function download-font ซึ่งตรวจสิทธิ์ + stamp license ลงไฟล์

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import { licenseLabel } from "@/lib/license";

type Entitlement = {
  id: string;
  font_id: string;
  license_type: string;
  created_at: string;
  fonts: { name: string | null; name_th: string | null; slug: string; cover_image_url: string | null } | null;
  orders: { order_no: string } | null;
};

type FileEntry = { index: number; name: string };

const ERR_TH: Record<string, string> = {
  no_files: "ยังไม่มีไฟล์ฟอนต์สำหรับดาวน์โหลด — กรุณาติดต่อผู้ขาย",
  no_entitlement: "ไม่พบสิทธิ์ดาวน์โหลด หรือคำสั่งซื้อยังไม่ชำระเงิน",
  download_limit_reached: "เกินจำนวนดาวน์โหลดต่อวัน กรุณาลองใหม่พรุ่งนี้",
  file_not_found: "ไม่พบไฟล์ในระบบ — กรุณาติดต่อผู้ขาย",
  invalid_file_index: "ไม่พบไฟล์ที่เลือก กรุณาลองใหม่",
  entitlement_lookup_failed: "ระบบตรวจสอบสิทธิ์ขัดข้อง กรุณาลองใหม่",
  unauthorized: "กรุณาเข้าสู่ระบบใหม่",
};
function errMsg(code?: string, fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่") {
  return (code && ERR_TH[code]) || fallback;
}

export default function MyDownloads() {
  const { user } = useAuth();
  const [items, setItems] = useState<Entitlement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, FileEntry[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    // ผูก entitlement ที่ออกด้วยอีเมลนี้เข้ากับบัญชี (กรณีซื้อก่อนสมัครสมาชิก)
    await supabase.rpc("claim_my_entitlements");
    const { data } = await supabase
      .from("entitlements")
      .select("id, font_id, license_type, created_at, fonts(name, name_th, slug, cover_image_url), orders(order_no)")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setItems((data as unknown as Entitlement[]) ?? []);
    setLoaded(true);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggleOpen = async (ent: Entitlement) => {
    setError("");
    if (openId === ent.id) { setOpenId(null); return; }
    setOpenId(ent.id);
    if (files[ent.id]) return;
    const { data, error: fnError } = await supabase.functions.invoke("download-font", {
      body: { action: "list", font_id: ent.font_id },
    });
    if (fnError || !data?.files) {
      setError(errMsg(data?.error, "โหลดรายการไฟล์ไม่สำเร็จ กรุณาลองใหม่"));
      return;
    }
    setFiles((prev) => ({ ...prev, [ent.id]: data.files as FileEntry[] }));
  };

  const download = async (ent: Entitlement, file: FileEntry) => {
    setError("");
    setBusy(`${ent.id}:${file.index}`);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("download-font", {
        body: { action: "download", font_id: ent.font_id, file_index: file.index },
      });
      if (fnError || !(data instanceof Blob)) {
        console.error("download-font failed", { fnError, data });
        setError(
          errMsg(
            typeof data === "object" && data && "error" in data ? (data as { error?: string }).error : undefined,
            "ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่ — หากยังไม่ได้ กรุณาติดต่อผู้ขาย"
          )
        );
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-heading text-h2 text-black mb-1">ดาวน์โหลดของฉัน</h2>
      <p className="font-body text-body-sm text-grey-600 mb-4">
        ไฟล์ฟอนต์ที่คุณมีสิทธิ์ใช้งาน — ดาวน์โหลดซ้ำได้ตลอด ไฟล์ถูกประทับข้อมูลสิทธิ์ของคุณ
      </p>

      <div className="flex flex-col gap-2">
        {items.map((ent) => {
          const fontName = ent.fonts?.name ?? ent.fonts?.name_th ?? "ฟอนต์";
          const isOpen = openId === ent.id;
          return (
            <div key={ent.id} className="bg-surface overflow-hidden">
              <button
                onClick={() => toggleOpen(ent)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer text-left hover:bg-grey-200/40 transition-colors"
              >
                {ent.fonts?.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ent.fonts.cover_image_url} alt="" className="w-14 h-9 object-cover" />
                ) : (
                  <div className="w-14 h-9 bg-grey-200" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-body text-body text-black truncate">{fontName}</div>
                  <div className="font-body text-footnote text-grey-600">
                    สิทธิ์: {licenseLabel(ent.license_type)}
                    {ent.orders?.order_no ? ` · ${ent.orders.order_no}` : ""}
                  </div>
                </div>
                <span className="text-grey-600 font-body text-footnote">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 pt-3 bg-grey-200/40 flex flex-col gap-1.5">
                  {!files[ent.id] ? (
                    <span className="font-body text-body-sm text-grey-600 py-2">กำลังโหลดรายการไฟล์…</span>
                  ) : files[ent.id].map((f) => (
                    <div key={f.index} className="flex items-center justify-between gap-3">
                      <span className="font-body text-body-sm text-grey-800 truncate">{f.name}</span>
                      <Button
                        onClick={() => download(ent, f)}
                        disabled={busy !== null}
                        size="sm"
                        className="flex-shrink-0"
                      >
                        {busy === `${ent.id}:${f.index}` ? "กำลังเตรียมไฟล์…" : "ดาวน์โหลด"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="font-body text-body-sm text-danger-dark mt-3">{error}</p>}
    </section>
  );
}
