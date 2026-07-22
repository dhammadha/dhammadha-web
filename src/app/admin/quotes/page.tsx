"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  licenseLabel,
  parseLicenseSettings,
  parseDesignerTiers,
  findTier,
  type LicenseTier,
} from "@/lib/license";
import PrintLightbox, { type PrintData } from "@/components/admin/PrintLightbox";
import ConfirmPaidModal, { type ConfirmQuote } from "@/components/ConfirmPaidModal";
import IssueQuoteModal, { type IssueQuote, type InitialItem } from "@/components/IssueQuoteModal";
import type { Database } from "@/lib/database.types";
import Button from "@/components/ui/Button";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"] & {
  quote_no?: string | null;
  receipt_no?: string | null;
  quote_issued_at?: string | null;
  receipt_issued_at?: string | null;
  total_amount?: number | null;
  fonts_detail?: Array<{ name: string; price: number; license_type: string; font_id?: string | null }> | null;
};

type SellerInfo = {
  name: string; business_name: string | null; entity_type: string;
  tax_id: string | null; address: string | null;
  phone: string | null; email: string | null;
  bank: { bank_name?: string; account_name?: string; account_number?: string } | null;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

const SELLER_FIELDS = "name, business_name, entity_type, tax_id, address, phone, email, bank";

// chunk-safe Uint8Array → base64 (avoids String.fromCharCode(...bigArray) spread overflow)
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export default function AdminQuotesPage() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QuoteRow | null>(null);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [printQuoteId, setPrintQuoteId] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [orders, setOrders] = useState<Record<string, { id: string; order_no: string }>>({});
  const [confirming, setConfirming] = useState<QuoteRow | null>(null);
  const [issuing, setIssuing] = useState<QuoteRow | null>(null);
  const [issuingItems, setIssuingItems] = useState<InitialItem[]>([]);
  const [toast, setToast] = useState("");
  const [defaultTiers, setDefaultTiers] = useState<LicenseTier[]>(() => parseLicenseSettings(null));
  const [customTiers, setCustomTiers] = useState<LicenseTier[]>([]);
  // ผู้ขายต่างกันตาม designer ของแต่ละ quote — cache กันดึงซ้ำ (key: designer_id ?? "self")
  const sellerCacheRef = useRef<Record<string, SellerInfo>>({});

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "licensing").single().then(({ data }) => {
      setDefaultTiers(parseLicenseSettings(data?.value));
    });
  }, []);

  // quotes ในหน้านี้ถูกกรองด้วย designer_id = user.id อยู่แล้ว จึงมี designer เดียว
  // โหลด custom tiers ครั้งเดียวพอ ไม่ต้องดึงซ้ำต่อ quote
  useEffect(() => {
    if (!user) return;
    supabase
      .from("designer_license_config")
      .select("use_default, tiers")
      .eq("designer_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCustomTiers(data && !data.use_default ? parseDesignerTiers(data.tiers) : []);
      });
  }, [user]);

  // custom ของ designer มาก่อน default ของเว็บ — ถ้าชื่อชนกันต้องได้ราคาของ designer
  const allTiers = useMemo(() => [...customTiers, ...defaultTiers], [customTiers, defaultTiers]);

  const loadQuotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data }, { data: orderData }] = await Promise.all([
      supabase.from("quotes").select("*").eq("designer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("id, quote_id, order_no").eq("designer_id", user.id),
    ]);
    setQuotes((data as QuoteRow[]) ?? []);
    const byQuote: Record<string, { id: string; order_no: string }> = {};
    for (const o of (orderData as Array<{ id: string; quote_id: string | null; order_no: string }>) ?? []) {
      if (o.quote_id) byQuote[o.quote_id] = { id: o.id, order_no: o.order_no };
    }
    setOrders(byQuote);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  // ดึงราคาและ label ของ license_type — หา tier จาก custom ของ designer ก่อน
  // แล้วค่อย default ของเว็บ (findTier รองรับทั้ง id / ชื่อ / custom_<N> ของแถวเก่า)
  const getLicenseItems = useCallback(async (
    _designerId: string | null,
    licenseType: string,
    fontNames: string[],
  ): Promise<Array<{ name: string; license_type: string; price: number }>> => {
    const tier = findTier(licenseType, allTiers);
    // หา tier ไม่เจอ (ถูกลบไปแล้ว) — คงค่าที่บันทึกไว้เดิม ราคา 0 ให้ผู้ใช้แก้เอง
    const label = tier?.name ?? licenseLabel(licenseType, allTiers);
    const price = tier?.price ?? 0;
    return fontNames.map((name) => ({ name, license_type: label, price }));
  }, [allTiers]);

  // ดึงข้อมูลผู้ขาย (สำหรับพิมพ์/ออกเอกสาร) ของ designer เจ้าของ quote นั้น ๆ
  // ถ้า designer_id เป็น null หรือดึงแถวของ designer ไม่ได้ (RLS) → fallback เป็นผู้ใช้ที่ login อยู่
  const getSeller = useCallback(async (designerId: string | null): Promise<SellerInfo | null> => {
    const key = designerId ?? "self";
    if (sellerCacheRef.current[key]) return sellerCacheRef.current[key];

    const targetId = designerId ?? user?.id;
    if (!targetId) return null;

    const { data, error } = await supabase.from("users").select(SELLER_FIELDS).eq("id", targetId).single();
    if (!error && data) {
      // cache เฉพาะแถวของเจ้าตัวจริงเท่านั้น — ห้าม cache ค่า fallback ใต้ key ของ designer
      // ไม่งั้น error ชั่วคราวครั้งเดียวจะทำให้เอกสารของ designer คนนั้นใช้ชื่อ/เลขภาษี admin ไปตลอด
      sellerCacheRef.current[key] = data as SellerInfo;
      return data as SellerInfo;
    }

    if (designerId && user) {
      const { data: own } = await supabase.from("users").select(SELLER_FIELDS).eq("id", user.id).single();
      return own ? (own as SellerInfo) : null;
    }
    return null;
  }, [user]);

  // สร้าง PrintData สำหรับใบเสนอราคา/ใบเสร็จ — ใช้ราคาที่บันทึกไว้ (fonts_detail) ถ้ามี
  const buildPrintData = useCallback(async (
    q: QuoteRow,
    type: "quotation" | "receipt",
  ): Promise<PrintData | null> => {
    const docNo = type === "quotation" ? q.quote_no : q.receipt_no;
    if (!docNo) return null;
    const sellerInfo = await getSeller(q.designer_id ?? null);
    if (!sellerInfo) { showToast("ไม่พบข้อมูลผู้ขาย"); return null; }

    let items: Array<{ name: string; license_type: string; price: number }>;
    if (q.fonts_detail && q.fonts_detail.length > 0) {
      items = q.fonts_detail.map((d) => ({
        name: d.name,
        license_type: licenseLabel(d.license_type, allTiers),
        price: d.price,
      }));
    } else {
      items = await getLicenseItems(q.designer_id ?? null, q.license_type, q.fonts);
    }

    // ใช้วันที่ออกเอกสารจริงจาก DB — พิมพ์/ส่งซ้ำภายหลังต้องได้วันที่เดิม ไม่ใช่วันนี้
    const issuedAt = type === "quotation" ? q.quote_issued_at : q.receipt_issued_at;
    return {
      type,
      doc_no: docNo,
      date: new Date(issuedAt ?? Date.now()).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }),
      contact_name: q.contact_name,
      company_name: q.company_name,
      address: q.address,
      tax_id: q.tax_id,
      email: q.email,
      note: q.note,
      items,
      discount: q.discount ?? 0,
      seller: sellerInfo,
    };
  }, [getSeller, getLicenseItems, allTiers]);

  const openPrint = useCallback(async (q: QuoteRow, type: "quotation" | "receipt") => {
    const data = await buildPrintData(q, type);
    if (!data) return;
    setPrintData(data);
    setPrintQuoteId(q.id);
    setPrintOpen(true);
  }, [buildPrintData]);

  // เปิด modal ออกใบเสนอราคา — ตั้งราคาเริ่มต้นจาก fonts_detail (ถ้าเคยตั้ง) หรือ license config
  const openIssueModal = async (q: QuoteRow) => {
    let initial: InitialItem[];
    if (q.fonts_detail && q.fonts_detail.length > 0) {
      initial = q.fonts_detail.map((d) => ({ name: d.name, license_type: d.license_type, price: d.price }));
    } else {
      initial = await getLicenseItems(q.designer_id ?? null, q.license_type, q.fonts);
    }
    setIssuingItems(initial);
    setIssuing(q);
  };

  // หลังยืนยันรับชำระ: สร้าง PDF ใบเสร็จ + ส่งอีเมล delivery พร้อมแนบไฟล์ให้ลูกค้า
  const sendReceiptEmail = useCallback(async (
    q: QuoteRow,
    orderId: string,
    receiptNo: string | null,
  ): Promise<boolean> => {
    if (!orderId) return false;
    let pdf_base64: string | undefined;
    let filename: string | undefined;
    if (receiptNo) {
      const data = await buildPrintData(
        { ...q, receipt_no: receiptNo, receipt_issued_at: new Date().toISOString() },
        "receipt",
      );
      if (data) {
        const { generateQuotePdf } = await import("@/lib/quote-doc");
        const bytes = await generateQuotePdf(data);
        pdf_base64 = uint8ToBase64(bytes);
        filename = `${receiptNo}.pdf`;
      }
    }
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        type: "delivery",
        payload: {
          order_id: orderId,
          ...(pdf_base64 ? { pdf_base64, filename, receipt_no: receiptNo } : {}),
        },
      }),
    }).catch(() => null);
    return !!res?.ok;
  }, [buildPrintData]);

  const handleSendEmail = useCallback(async () => {
    if (!printData || !printQuoteId) return;
    const { generateQuotePdf } = await import("@/lib/quote-doc");
    const bytes = await generateQuotePdf(printData);
    const base64 = uint8ToBase64(bytes);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        type: "document",
        payload: {
          quote_id: printQuoteId,
          doc_type: printData.type,
          pdf_base64: base64,
          filename: `${printData.doc_no}.pdf`,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null as { error?: string } | null);
      throw new Error(body?.error ?? "ส่งอีเมลไม่สำเร็จ");
    }
  }, [printData, printQuoteId]);

  const deleteQuote = async (q: QuoteRow) => {
    if (!confirm(`ลบใบเสนอราคาของ "${q.company_name}"?`)) return;
    // .select() เพื่อให้รู้ว่าลบได้จริงกี่แถว — RLS ที่บล็อก delete ไม่คืน error
    // แต่คืน 0 แถวเงียบ ๆ (0061 ห้ามลบใบที่ออกใบเสร็จแล้ว) ถ้าไม่เช็คจะขึ้น "ลบเรียบร้อย" ทั้งที่ยังอยู่
    const { data, error } = await supabase.from("quotes").delete().eq("id", q.id).select("id");
    if (error) { showToast(`ลบไม่สำเร็จ: ${error.message}`); return; }
    if (!data?.length) {
      showToast("ลบไม่สำเร็จ: ใบเสนอราคาที่ออกใบเสร็จแล้วลบไม่ได้");
      return;
    }
    showToast("ลบเรียบร้อย");
    setSelected(null);
    loadQuotes();
  };

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-h2 text-black">ใบเสนอราคา</h1>
          {quotes.filter((q) => !q.quote_no).length > 0 && (
            <p className="font-body text-body-sm text-warning mt-0.5">⚠️ {quotes.filter((q) => !q.quote_no).length} รายการรอดำเนินการ</p>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Quote list */}
        <div className="flex-1 bg-surface overflow-hidden">
          <div className="grid grid-cols-[100px_1.2fr_1.5fr_1fr_80px_80px] gap-3 px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]">
            <div>วันที่</div><div>ชื่อผู้ติดต่อ</div><div>บริษัท/องค์กร</div><div>รูปแบบสิทธิ์</div><div>ใบเสนอราคา</div><div>ใบเสร็จ</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">กำลังโหลด…</div>
          ) : quotes.length === 0 ? (
            <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">ยังไม่มีใบเสนอราคา</div>
          ) : quotes.map((q) => (
            <div
              key={q.id}
              onClick={() => setSelected(selected?.id === q.id ? null : q)}
              className={`grid grid-cols-[100px_1.2fr_1.5fr_1fr_80px_80px] gap-3 px-4 py-3 cursor-pointer transition-colors duration-150 ease-base items-center ${selected?.id === q.id ? "bg-mint/20" : "hover:bg-grey-200"}`}
            >
              <div className="font-body text-footnote text-grey-600">{fmtDate(q.created_at)}</div>
              <div className="font-ui text-ui text-black truncate">{q.contact_name}</div>
              <div className="font-body text-body-sm text-grey-600 truncate">{q.company_name}</div>
              <div className="font-body text-footnote text-grey-600 truncate">{licenseLabel(q.license_type, allTiers)}</div>
              <div>
                {q.quote_no
                  ? <span className="text-badge font-heading px-2 py-0.5 bg-success text-white">{q.quote_no}</span>
                  : <span className="text-badge font-heading px-2 py-0.5 bg-warning text-black">รอดำเนินการ</span>}
              </div>
              <div>
                {q.receipt_no
                  ? <span className="text-badge font-heading px-2 py-0.5 bg-success text-white">{q.receipt_no}</span>
                  : <span className="font-body text-footnote text-grey-600">—</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[300px] flex-shrink-0 bg-surface p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="font-ui text-ui text-black">รายละเอียด</h3>
              <button onClick={() => setSelected(null)} className="text-grey-600 hover:text-black bg-transparent border-none cursor-pointer text-lg leading-none">✕</button>
            </div>

            <div className="flex flex-col gap-2 font-body text-body-sm">
              <Row label="บริษัท" value={selected.company_name} />
              <Row label="ผู้ติดต่อ" value={selected.contact_name} />
              <Row label="อีเมล" value={selected.email} />
              <Row label="ที่อยู่" value={selected.address} />
              <Row label="เลขภาษี" value={selected.tax_id} />
              <Row label="รูปแบบสิทธิ์" value={licenseLabel(selected.license_type, allTiers)} />
              {selected.note && <Row label="หมายเหตุ" value={selected.note} />}
            </div>

            <div>
              <div className="font-heading text-badge text-grey-600 tracking-[0.04em] mb-1.5">ฟอนต์ที่ขอ</div>
              <div className="flex flex-col gap-1">
                {selected.fonts.map((f, i) => (
                  <div key={i} className="font-body text-body-sm text-black px-2 py-1 bg-white">{f}</div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3">
              {selected.quote_no && (
                orders[selected.id] ? (
                  <div className="font-body text-body-sm text-white bg-success px-3 py-2">
                    ✓ ยืนยันรับชำระแล้ว — {orders[selected.id].order_no}
                  </div>
                ) : (
                  <Button onClick={() => setConfirming(selected)} className="w-full">
                    ยืนยันรับชำระ + ส่งไฟล์
                  </Button>
                )
              )}
              {!selected.quote_no && (
                <Button onClick={() => openIssueModal(selected)} className="w-full">
                  ออกใบเสนอราคา
                </Button>
              )}
              {selected.quote_no && !orders[selected.id] && (
                <Button variant="outline" onClick={() => openIssueModal(selected)} className="w-full">
                  แก้ไขราคา / ส่วนลด
                </Button>
              )}
              {selected.quote_no && (
                <Button variant="outline" onClick={() => openPrint(selected, "quotation")} className="w-full">
                  พิมพ์ใบเสนอราคา ({selected.quote_no})
                </Button>
              )}
              {selected.receipt_no && (
                <Button variant="outline" onClick={() => openPrint(selected, "receipt")} className="w-full">
                  พิมพ์ใบเสร็จ ({selected.receipt_no})
                </Button>
              )}
              {selected.receipt_no ? (
                <p className="font-body text-footnote text-grey-600 text-center leading-relaxed px-2">
                  ออกใบเสร็จ {selected.receipt_no} แล้ว — ลบไม่ได้เพื่อเก็บหลักฐานทางบัญชี
                </p>
              ) : (
                <button onClick={() => deleteQuote(selected)} className="w-full py-2 text-danger-dark bg-white font-ui text-ui cursor-pointer hover:bg-danger hover:text-white transition-colors duration-150 ease-base border-none">
                  ลบ
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {issuing && (
        <IssueQuoteModal
          quote={issuing as unknown as IssueQuote}
          initialItems={issuingItems}
          onClose={() => setIssuing(null)}
          onIssued={async (docNo) => {
            const q = issuing;
            setIssuing(null);
            showToast(`✓ ออกใบเสนอราคา ${docNo} เรียบร้อย`);
            await loadQuotes();
            if (q) {
              const { data } = await supabase.from("quotes").select("*").eq("id", q.id).single();
              if (data) { setSelected(data as QuoteRow); await openPrint(data as QuoteRow, "quotation"); }
            }
          }}
        />
      )}

      {confirming && (
        <ConfirmPaidModal
          quote={confirming as unknown as ConfirmQuote}
          onClose={() => setConfirming(null)}
          onConfirmed={async ({ orderId, orderNo, receiptNo }) => {
            const q = confirming;
            setConfirming(null);
            setSelected(null);
            let emailOk = false;
            try { emailOk = q ? await sendReceiptEmail(q, orderId, receiptNo) : false; } catch { emailOk = false; }
            showToast(
              emailOk
                ? `✓ ยืนยันรับชำระ ${orderNo}${receiptNo ? ` + ออกใบเสร็จ ${receiptNo}` : ""} แล้ว — ส่งอีเมล + ใบเสร็จให้ลูกค้าเรียบร้อย`
                : `✓ ยืนยันรับชำระ ${orderNo} แล้ว แต่ส่งอีเมลไม่สำเร็จ`
            );
            loadQuotes();
          }}
        />
      )}

      <PrintLightbox
        open={printOpen}
        data={printData}
        onClose={() => setPrintOpen(false)}
        onSendEmail={handleSendEmail}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 bg-black text-white font-body text-body-sm shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-grey-600">{label}: </span>
      <span className="text-black">{value}</span>
    </div>
  );
}
