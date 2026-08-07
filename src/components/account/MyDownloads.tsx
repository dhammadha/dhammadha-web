"use client";

// "ดาวน์โหลดของฉัน" — ฟอนต์ทุกตัวที่ลูกค้ามีสิทธิ์ (จาก entitlements หลังยืนยันรับชำระ)
// ดาวน์โหลดผ่าน Edge Function download-font ซึ่งตรวจสิทธิ์ + stamp license ลงไฟล์

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import LicenseLink from "@/components/LicenseLink";
import { licenseLabel, designerLicensePdfMap } from "@/lib/license";

type Entitlement = {
  id: string;
  font_id: string;
  license_type: string;
  created_at: string;
  fonts: { name: string | null; name_th: string | null; slug: string; cover_image_url: string | null; owner_id: string | null } | null;
  // ฟิลด์ชุดหลังใช้ออกใบเสร็จรับเงินของการขายรายชุด (ดู lib/retail-receipt.ts)
  // ใบเสร็จเป็นของ "ทั้งคำสั่งซื้อ" ไม่ใช่ของฟอนต์ตัวเดียว — ตะกร้าหลายตัวจึงได้ใบเดียวกัน
  orders: {
    order_no: string;
    receipt_no: string | null;
    customer_name: string | null;
    customer_email: string | null;
    company_name: string | null;
    items: Array<{ name?: string | null; license_type?: string | null; price?: number | null }> | null;
    discount: number | null;
    paid_at: string | null;
  } | null;
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

/**
 * จัดกลุ่มไฟล์ตามนามสกุล (OTF / TTF / …) เพื่อการแสดงผลเท่านั้น — วิธีเดียวกับ
 * `FontFileSection` ในหน้าเพิ่มฟอนต์ · ห้ามเรียงใหม่หรือแตะ `file.index`
 * เพราะ index คือตัวชี้ไฟล์ที่ Edge Function `download-font` ใช้ตรวจสิทธิ์
 */
function groupByExt(files: FileEntry[]): [string, FileEntry[]][] {
  const groups = new Map<string, FileEntry[]>();
  for (const f of files) {
    const ext = f.name.split(".").pop()?.toUpperCase() || "อื่น ๆ";
    if (!groups.has(ext)) groups.set(ext, []);
    groups.get(ext)!.push(f);
  }
  return Array.from(groups.entries());
}

export default function MyDownloads() {
  const { user } = useAuth();
  const [items, setItems] = useState<Entitlement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, FileEntry[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // แถบหมวดหมู่ไฟล์ที่กางอยู่ — คีย์ "<entitlementId>:<ext>" (ปิดไว้ก่อนให้ดูเป็นระเบียบ)
  const [openExt, setOpenExt] = useState<Record<string, boolean>>({});
  /** designer_id → URL สัญญาฉบับของดีไซน์เนอร์เอง (เฉพาะคนที่ไม่ใช้ฉบับกลางของเว็บ) */
  const [licensePdfs, setLicensePdfs] = useState<Record<string, string>>({});
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);

  // เรนเดอร์ใบเสร็จในเบราว์เซอร์แล้วเปิดแท็บใหม่ — ไม่ต้องเก็บไฟล์ไว้ที่ไหน
  // (webhook สร้าง PDF เองไม่ได้ ตัวเรนเดอร์ pdf-lib ทำงานฝั่ง client เท่านั้น)
  const openReceipt = useCallback(async (ent: Entitlement) => {
    const order = ent.orders;
    if (!order?.receipt_no) return;
    setReceiptBusy(ent.id);
    setError("");
    try {
      const { buildRetailReceiptData } = await import("@/lib/retail-receipt");
      const data = buildRetailReceiptData(order);
      if (!data) return;
      const { generateQuotePdf } = await import("@/lib/quote-doc");
      const bytes = await generateQuotePdf(data);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      window.open(url, "_blank");
      // ปล่อย object URL ทีหลัง — revoke ทันทีแท็บใหม่จะโหลดไม่ทัน
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("สร้างใบเสร็จไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setReceiptBusy(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    // ผูก entitlement ที่ออกด้วยอีเมลนี้เข้ากับบัญชี (กรณีซื้อก่อนสมัครสมาชิก)
    await supabase.rpc("claim_my_entitlements");
    const { data } = await supabase
      .from("entitlements")
      .select("id, font_id, license_type, created_at, fonts(name, name_th, slug, cover_image_url, owner_id), orders(order_no, receipt_no, customer_name, customer_email, company_name, items, discount, paid_at)")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    const rows = (data as unknown as Entitlement[]) ?? [];
    setItems(rows);
    setLoaded(true);

    // สัญญาของดีไซน์เนอร์ — ยิงรวมทีเดียวทุกเจ้าของในลิสต์ ไม่ยิงต่อฟอนต์
    const ownerIds = [...new Set(rows.map((r) => r.fonts?.owner_id).filter((v): v is string => !!v))];
    if (ownerIds.length === 0) return;
    const { data: configs } = await supabase
      .from("designer_license_config")
      .select("designer_id, use_default, license_pdf_url")
      .in("designer_id", ownerIds);
    setLicensePdfs(designerLicensePdfMap(configs));
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

  // อยู่คอลัมน์ขวาของ /account — โชว์หัวข้อเสมอแม้ยังไม่เคยซื้อ ไม่งั้นคอลัมน์จะว่างเปล่า
  return (
    <section className="mt-10 lg:mt-0">
      <h2 className="font-heading text-h2 text-black mb-1">ดาวน์โหลดของฉัน</h2>
      <p className="font-body text-body-sm text-grey-600 mb-1">
        ไฟล์ฟอนต์ที่คุณมีสิทธิ์ใช้งาน — ดาวน์โหลดซ้ำได้ตลอด ไฟล์ถูกประทับข้อมูลสิทธิ์ของคุณ
      </p>
      <p className="font-body text-body-sm text-grey-600 mb-4">
        ดูรายละเอียด{" "}
        <Link href="/agreement/" target="_blank" rel="noopener noreferrer" className="link-accent">
          สัญญาอนุญาต
        </Link>
      </p>

      {!loaded ? (
        <p className="font-body text-body-sm text-grey-600">กำลังโหลด…</p>
      ) : items.length === 0 ? (
        <div className="bg-surface px-4 py-6 text-center">
          <p className="font-body text-body-sm text-grey-600">ยังไม่มีคำสั่งซื้อ</p>
          <Link href="/fonts/" className="font-body text-body-sm link-accent no-underline mt-1 inline-block">
            เลือกดูฟอนต์
          </Link>
        </div>
      ) : (
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
                <div className="px-4 pb-3 pt-3 bg-grey-200/40 flex flex-col">
                  {/* ฟอนต์ที่เจ้าของใช้สัญญาของตัวเอง — ฉบับกลางด้านบนไม่ได้ครอบฟอนต์ตัวนี้ */}
                  {ent.fonts?.owner_id && licensePdfs[ent.fonts.owner_id] && (
                    <p className="font-body text-footnote text-grey-600 mb-2">
                      ฟอนต์นี้ใช้สัญญาอนุญาตของผู้ออกแบบ —{" "}
                      <LicenseLink
                        pdfUrl={licensePdfs[ent.fonts.owner_id]}
                        className="link-accent font-body text-footnote hover:underline"
                      />
                    </p>
                  )}
                  {/* ใบเสร็จเป็นของทั้งคำสั่งซื้อ — ตะกร้าหลายฟอนต์จะเห็นเลขเดียวกันทุกแถว
                      ซึ่งถูกต้องแล้ว ไม่ใช่ใบซ้ำ */}
                  {ent.orders?.receipt_no && (
                    <p className="font-body text-footnote text-grey-600 mb-2">
                      <button
                        onClick={() => openReceipt(ent)}
                        disabled={receiptBusy === ent.id}
                        className="bg-transparent border-none p-0 cursor-pointer font-body text-footnote link-accent hover:underline disabled:opacity-50"
                      >
                        {receiptBusy === ent.id ? "กำลังสร้างใบเสร็จ…" : `ใบเสร็จรับเงิน ${ent.orders.receipt_no}`}
                      </button>
                      <span className="text-grey-600"> · ของทั้งคำสั่งซื้อ {ent.orders.order_no}</span>
                    </p>
                  )}
                  {!files[ent.id] ? (
                    <span className="font-body text-body-sm text-grey-600 py-2">กำลังโหลดรายการไฟล์…</span>
                  ) : groupByExt(files[ent.id]).map(([ext, group]) => {
                    const key = `${ent.id}:${ext}`;
                    const expanded = !!openExt[key];
                    return (
                      <div key={ext} className="mt-1.5 first:mt-0">
                        <button
                          onClick={() => setOpenExt((prev) => ({ ...prev, [key]: !prev[key] }))}
                          aria-expanded={expanded}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-page border-none cursor-pointer text-left hover:bg-grey-200/60 transition-colors duration-150 ease-base"
                        >
                          <span className="font-ui text-ui text-black flex-1">{ext}</span>
                          <span className="font-body text-footnote text-grey-600">{group.length} ไฟล์</span>
                          <span className="font-body text-footnote text-grey-600">{expanded ? "▲" : "▼"}</span>
                        </button>
                        {expanded && (
                          <div className="flex flex-col gap-1.5 px-3 pt-2 pb-1">
                            {group.map((f) => (
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
              )}
            </div>
          );
        })}
      </div>
      )}

      {error && <p className="font-body text-body-sm text-danger-dark mt-3">{error}</p>}
    </section>
  );
}
