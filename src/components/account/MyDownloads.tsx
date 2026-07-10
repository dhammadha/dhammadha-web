"use client";

// "ดาวน์โหลดของฉัน" — ฟอนต์ทุกตัวที่ลูกค้ามีสิทธิ์ (จาก entitlements หลังยืนยันรับชำระ)
// ดาวน์โหลดผ่าน Edge Function download-font ซึ่งตรวจสิทธิ์ + stamp license ลงไฟล์

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Entitlement = {
  id: string;
  font_id: string;
  license_type: string;
  created_at: string;
  fonts: { name: string | null; name_th: string | null; slug: string; cover_image_url: string | null } | null;
  orders: { order_no: string } | null;
};

type FileEntry = { index: number; name: string };

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
      setError("โหลดรายการไฟล์ไม่สำเร็จ กรุณาลองใหม่");
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
        setError("ดาวน์โหลดไม่สำเร็จ — หากเกินจำนวนครั้งต่อวัน กรุณาลองพรุ่งนี้");
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
    <div className="bg-white rounded-2xl border border-border p-6 mt-6">
      <h2 className="text-[16px] font-semibold text-navy mb-1">ดาวน์โหลดของฉัน</h2>
      <p className="text-[12px] text-[#aaa] mb-4">
        ไฟล์ฟอนต์ที่คุณมีสิทธิ์ใช้งาน — ดาวน์โหลดซ้ำได้ตลอด ไฟล์ถูกประทับข้อมูลสิทธิ์ของคุณ
      </p>

      <div className="flex flex-col gap-2">
        {items.map((ent) => {
          const fontName = ent.fonts?.name ?? ent.fonts?.name_th ?? "ฟอนต์";
          const isOpen = openId === ent.id;
          return (
            <div key={ent.id} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggleOpen(ent)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer text-left hover:bg-[#fafaf8] transition-colors"
              >
                {ent.fonts?.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ent.fonts.cover_image_url} alt="" className="w-14 h-9 object-cover rounded-lg border border-border" />
                ) : (
                  <div className="w-14 h-9 rounded-lg bg-[#f5f5f2]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-navy truncate">{fontName}</div>
                  <div className="text-[12px] text-[#aaa]">
                    สิทธิ์: {ent.license_type}
                    {ent.orders?.order_no ? ` · ${ent.orders.order_no}` : ""}
                  </div>
                </div>
                <span className="text-[#aaa] text-[12px]">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 pt-1 border-t border-[#f4f4f0] flex flex-col gap-1.5">
                  {!files[ent.id] ? (
                    <span className="text-[13px] text-[#aaa] py-2">กำลังโหลดรายการไฟล์…</span>
                  ) : files[ent.id].map((f) => (
                    <div key={f.index} className="flex items-center justify-between gap-3">
                      <span className="text-[13px] text-[#555] truncate">{f.name}</span>
                      <button
                        onClick={() => download(ent, f)}
                        disabled={busy !== null}
                        className="text-[12px] px-3 py-1.5 rounded-lg bg-mint text-white border-none cursor-pointer hover:bg-navy transition-colors disabled:opacity-50 disabled:cursor-wait flex-shrink-0"
                      >
                        {busy === `${ent.id}:${f.index}` ? "กำลังเตรียมไฟล์…" : "ดาวน์โหลด"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-[12px] text-red-500 mt-3">{error}</p>}
    </div>
  );
}
