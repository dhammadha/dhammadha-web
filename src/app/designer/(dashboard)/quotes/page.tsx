"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { licenseLabel } from "@/lib/license";
import PrintLightbox, { type PrintData } from "@/components/admin/PrintLightbox";
import ConfirmPaidModal, { type ConfirmQuote } from "@/components/ConfirmPaidModal";
import IssueQuoteModal, { type IssueQuote, type InitialItem } from "@/components/IssueQuoteModal";
import Button from "@/components/Button";

type QuoteRow = {
  id: string;
  contact_name: string;
  company_name: string;
  address: string | null;
  tax_id: string | null;
  email: string;
  license_type: string;
  fonts: string[];
  fonts_detail: Array<{ name: string; price: number; license_type: string; font_id?: string | null }> | null;
  discount: number;
  note: string | null;
  quote_no: string | null;
  receipt_no: string | null;
  quote_issued_at: string | null;
  receipt_issued_at: string | null;
  designer_id: string | null;
  created_at: string;
};

type SellerInfo = {
  name: string; business_name: string | null; entity_type: string;
  tax_id: string | null; address: string | null;
  phone: string | null; email: string | null;
  bank: { bank_name?: string; account_name?: string; account_number?: string } | null;
};

type OrderRow = { id: string; quote_id: string | null; order_no: string };

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

const SELLER_FIELDS = "name, business_name, entity_type, tax_id, address, phone, email, bank";

const DEFAULT_PRICES: Record<string, number> = {
  small_medium: 3500,
  large_agency: 7000,
  extended: 20000,
};

// chunk-safe Uint8Array → base64
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export default function DesignerQuotesPage() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderRow>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QuoteRow | null>(null);
  const [confirming, setConfirming] = useState<QuoteRow | null>(null);
  const [issuing, setIssuing] = useState<QuoteRow | null>(null);
  const [issuingItems, setIssuingItems] = useState<InitialItem[]>([]);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [printQuoteId, setPrintQuoteId] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [toast, setToast] = useState("");
  const sellerCache = useRef<SellerInfo | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 5000); };

  const loadQuotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: quoteData }, { data: orderData }] = await Promise.all([
      supabase.from("quotes").select("*").eq("designer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("id, quote_id, order_no").eq("designer_id", user.id),
    ]);
    setQuotes((quoteData as QuoteRow[]) ?? []);
    const byQuote: Record<string, OrderRow> = {};
    for (const o of (orderData as OrderRow[]) ?? []) {
      if (o.quote_id) byQuote[o.quote_id] = o;
    }
    setOrders(byQuote);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  const getSeller = useCallback(async (): Promise<SellerInfo | null> => {
    if (sellerCache.current) return sellerCache.current;
    if (!user) return null;
    const { data, error } = await supabase.from("users").select(SELLER_FIELDS).eq("id", user.id).single();
    if (!error && data) {
      sellerCache.current = data as SellerInfo;
      return data as SellerInfo;
    }
    return null;
  }, [user]);

  const getLicenseItems = useCallback(async (
    licenseType: string,
    fontNames: string[],
  ): Promise<Array<{ name: string; license_type: string; price: number }>> => {
    if (!user) return fontNames.map((name) => ({ name, license_type: licenseType, price: 0 }));

    // ลอง designer custom tiers ก่อน
    const { data: config } = await supabase
      .from("designer_license_config")
      .select("use_default, tiers")
      .eq("designer_id", user.id)
      .single();

    if (config && !config.use_default && config.tiers) {
      const tiers = config.tiers as Array<{ name: string; price: number }>;
      // name-based lookup (รูปแบบใหม่)
      const byName = tiers.find((t) => t.name === licenseType);
      if (byName) return fontNames.map((name) => ({ name, license_type: byName.name, price: byName.price }));
      // backward compat: รูปแบบเก่า custom_N
      const customMatch = licenseType.match(/^custom_(\d+)$/);
      if (customMatch) {
        const tier = tiers[parseInt(customMatch[1])];
        if (tier) return fontNames.map((name) => ({ name, license_type: tier.name, price: tier.price }));
      }
      // tier ถูกลบไปแล้ว — ใช้ชื่อเดิม ราคา 0
      return fontNames.map((name) => ({ name, license_type: licenseType, price: 0 }));
    }

    // fallback → global settings
    const { data: settings } = await supabase
      .from("settings").select("value").eq("key", "licensing").single();
    const sv = settings?.value as { small?: number; large?: number; extra?: number } | null;
    const prices: Record<string, number> = {
      small_medium: sv?.small ?? DEFAULT_PRICES.small_medium,
      large_agency: sv?.large ?? DEFAULT_PRICES.large_agency,
      extended: sv?.extra ?? DEFAULT_PRICES.extended,
    };

    const label = licenseLabel(licenseType);
    const price = prices[licenseType] ?? 0;
    return fontNames.map((name) => ({ name, license_type: label, price }));
  }, [user]);

  // สร้าง PrintData สำหรับใบเสนอราคา/ใบเสร็จ — ใช้ราคาที่บันทึกไว้ (fonts_detail) ถ้ามี
  const buildPrintData = useCallback(async (
    q: QuoteRow,
    type: "quotation" | "receipt",
  ): Promise<PrintData | null> => {
    const docNo = type === "quotation" ? q.quote_no : q.receipt_no;
    if (!docNo) return null;
    const sellerInfo = await getSeller();
    if (!sellerInfo) { showToast("กรุณาเพิ่มข้อมูลบัญชีใน Settings ก่อน"); return null; }

    let items: Array<{ name: string; license_type: string; price: number }>;
    if (q.fonts_detail && q.fonts_detail.length > 0) {
      items = q.fonts_detail.map((d) => ({
        name: d.name,
        license_type: licenseLabel(d.license_type),
        price: d.price,
      }));
    } else {
      items = await getLicenseItems(q.license_type, q.fonts);
    }

    const issuedAt = type === "quotation" ? q.quote_issued_at : q.receipt_issued_at;
    return {
      type,
      doc_no: docNo,
      date: new Date(issuedAt ?? Date.now()).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }),
      contact_name: q.contact_name,
      company_name: q.company_name,
      address: q.address ?? "",
      tax_id: q.tax_id ?? "",
      email: q.email,
      note: q.note,
      items,
      discount: q.discount ?? 0,
      seller: sellerInfo,
    };
  }, [getSeller, getLicenseItems]);

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
      initial = await getLicenseItems(q.license_type, q.fonts);
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

  const deleteQuote = async (q: QuoteRow) => {
    if (!confirm(`ลบใบเสนอราคาของ "${q.company_name}"?`)) return;
    const { error } = await supabase.from("quotes").delete().eq("id", q.id);
    if (error) { showToast(`ลบไม่สำเร็จ: ${error.message}`); return; }
    showToast("ลบเรียบร้อย");
    setSelected(null);
    loadQuotes();
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!printData) return;
    const { generateQuotePdf } = await import("@/lib/quote-doc");
    const bytes = await generateQuotePdf(printData);
    const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${printData.doc_no}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [printData]);

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

  const pending = quotes.filter((q) => !orders[q.id]);

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-navy">ใบเสนอราคา</h1>
          {pending.length > 0 && (
            <p className="text-[13px] text-amber-600 mt-0.5">⚠️ {pending.length} รายการรอดำเนินการ</p>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 bg-white rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-[100px_1.2fr_1.5fr_1fr_80px_80px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
            <div>วันที่</div><div>ชื่อผู้ติดต่อ</div><div>บริษัท/องค์กร</div><div>รูปแบบสิทธิ์</div><div>ใบเสนอราคา</div><div>ใบเสร็จ</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">กำลังโหลด…</div>
          ) : quotes.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">ยังไม่มีใบเสนอราคา</div>
          ) : quotes.map((q) => (
            <div
              key={q.id}
              onClick={() => setSelected(selected?.id === q.id ? null : q)}
              className={`grid grid-cols-[100px_1.2fr_1.5fr_1fr_80px_80px] gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 cursor-pointer transition-colors items-center ${
                selected?.id === q.id ? "bg-mint-light" : "hover:bg-[#fafaf8]"
              }`}
            >
              <div className="text-[12px] text-[#888]">{fmtDate(q.created_at)}</div>
              <div className="text-[13px] text-navy font-medium truncate">{q.contact_name}</div>
              <div className="text-[13px] text-[#555] truncate">{q.company_name}</div>
              <div className="text-[12px] text-[#888] truncate">{licenseLabel(q.license_type)}</div>
              <div>
                {q.quote_no
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">{q.quote_no}</span>
                  : <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">รอดำเนินการ</span>}
              </div>
              <div>
                {q.receipt_no
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">{q.receipt_no}</span>
                  : <span className="text-[10px] text-[#ddd]">—</span>}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="w-[300px] flex-shrink-0 bg-white rounded-2xl border border-border p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-navy">รายละเอียด</h3>
              <button onClick={() => setSelected(null)} className="text-[#aaa] hover:text-navy bg-transparent border-none cursor-pointer text-lg leading-none">✕</button>
            </div>

            <div className="flex flex-col gap-2 text-[13px]">
              {[
                { label: "บริษัท", value: selected.company_name },
                { label: "ผู้ติดต่อ", value: selected.contact_name },
                { label: "อีเมล", value: selected.email },
                { label: "ที่อยู่", value: selected.address },
                { label: "เลขภาษี", value: selected.tax_id },
                { label: "รูปแบบสิทธิ์", value: licenseLabel(selected.license_type) },
                { label: "หมายเหตุ", value: selected.note },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <span className="text-[#aaa]">{label}: </span>
                  <span className="text-navy">{value}</span>
                </div>
              ) : null)}
            </div>

            <div>
              <div className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wide mb-1.5">ฟอนต์ที่ขอ</div>
              <div className="flex flex-col gap-1">
                {selected.fonts.map((f, i) => (
                  <div key={i} className="text-[13px] text-navy px-2 py-1 rounded-lg bg-[#f8f8f6]">{f}</div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {orders[selected.id] ? (
                <div className="text-[13px] text-green-600 bg-green-50 rounded-lg px-3 py-2">
                  ✓ ยืนยันรับชำระแล้ว — {orders[selected.id].order_no}
                  <p className="text-[11px] text-[#888] mt-1">ลูกค้าดาวน์โหลดไฟล์ได้จากหน้าบัญชีของตัวเอง</p>
                </div>
              ) : (
                <Button onClick={() => setConfirming(selected)} className="w-full">
                  ยืนยันรับชำระ + ส่งไฟล์
                </Button>
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
              <button
                onClick={() => deleteQuote(selected)}
                className="mt-1 text-[13px] text-red-500 border border-red-200 rounded-lg py-2 hover:bg-red-50 bg-transparent cursor-pointer transition-colors"
              >
                ลบ
              </button>
            </div>
          </div>
        )}
      </div>

      {issuing && (
        <IssueQuoteModal
          quote={issuing as IssueQuote}
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
          quote={confirming as ConfirmQuote}
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
                : `✓ ยืนยันรับชำระ ${orderNo} แล้ว แต่ส่งอีเมลไม่สำเร็จ — แจ้งลูกค้าเองอีกทาง`
            );
            loadQuotes();
          }}
        />
      )}

      <PrintLightbox
        open={printOpen}
        data={printData}
        onClose={() => setPrintOpen(false)}
        onDownloadPdf={handleDownloadPdf}
        onSendEmail={handleSendEmail}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 rounded-xl bg-navy text-white text-[13px] font-medium shadow-lg">{toast}</div>
      )}
    </div>
  );
}
