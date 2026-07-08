"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PrintLightbox from "@/components/admin/PrintLightbox";
import type { Database } from "@/lib/database.types";
import Button from "@/components/Button";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"] & {
  quote_no?: string | null;
  receipt_no?: string | null;
  quote_issued_at?: string | null;
  receipt_issued_at?: string | null;
  total_amount?: number | null;
  fonts_detail?: Array<{ name: string; price: number; license_type: string }> | null;
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

function genDocNo(prefix: "QT" | "RC", existing: (string | null | undefined)[]): string {
  const year = new Date().getFullYear() + 543;
  const nums = existing
    .filter(Boolean)
    .map((n) => parseInt((n as string).split("-").pop() ?? "0"))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

export default function AdminQuotesPage() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QuoteRow | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [printData, setPrintData] = useState<Parameters<typeof PrintLightbox>[0]["data"]>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });
    setQuotes((data as QuoteRow[]) ?? []);
    setLoading(false);
  }, []);

  const loadSeller = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("users").select("name, business_name, entity_type, tax_id, address, phone, email, bank").eq("id", user.id).single();
    if (data) setSeller(data as SellerInfo);
  }, [user]);

  useEffect(() => { loadQuotes(); loadSeller(); }, [loadQuotes, loadSeller]);

  const issueDocument = async (q: QuoteRow, type: "quotation" | "receipt") => {
    if (!seller) { showToast("กรุณาเพิ่มข้อมูลบัญชีใน Settings ก่อน"); return; }

    const allQuotes = quotes;
    let docNo: string;

    if (type === "quotation") {
      if (q.quote_no) { showToast("ออกใบเสนอราคาไปแล้ว"); return; }
      docNo = genDocNo("QT", allQuotes.map((x) => x.quote_no));
      await supabase.from("quotes").update({ quote_no: docNo, quote_issued_at: new Date().toISOString() } as never).eq("id", q.id);
    } else {
      if (!q.quote_no) { showToast("ต้องออกใบเสนอราคาก่อน"); return; }
      if (q.receipt_no) { showToast("ออกใบเสร็จไปแล้ว"); return; }
      docNo = genDocNo("RC", allQuotes.map((x) => x.receipt_no));
      await supabase.from("quotes").update({ receipt_no: docNo, receipt_issued_at: new Date().toISOString() } as never).eq("id", q.id);
    }
    showToast(`✓ ออก${type === "quotation" ? "ใบเสนอราคา" : "ใบเสร็จ"} ${docNo} เรียบร้อย`);
    await loadQuotes();
    const updated: QuoteRow = type === "quotation"
      ? { ...q, quote_no: docNo, quote_issued_at: new Date().toISOString() }
      : { ...q, receipt_no: docNo, receipt_issued_at: new Date().toISOString() };
    setSelected(updated);
    openPrint(updated, type);
  };

  const openPrint = (q: QuoteRow, type: "quotation" | "receipt") => {
    if (!seller) return;
    const docNo = type === "quotation" ? q.quote_no : q.receipt_no;
    if (!docNo) return;
    const items = (q.fonts_detail ?? q.fonts.map((name) => ({ name, license_type: q.license_type, price: 0 })));
    setPrintData({
      type,
      doc_no: docNo,
      date: new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }),
      contact_name: q.contact_name,
      company_name: q.company_name,
      address: q.address,
      tax_id: q.tax_id,
      email: q.email,
      note: q.note,
      items,
      seller,
    });
    setPrintOpen(true);
  };

  const deleteQuote = async (q: QuoteRow) => {
    if (!confirm(`ลบใบเสนอราคาของ "${q.company_name}"?`)) return;
    await supabase.from("quotes").delete().eq("id", q.id);
    showToast("ลบเรียบร้อย");
    setSelected(null);
    loadQuotes();
  };

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-navy">ใบเสนอราคา</h1>
          {quotes.filter((q) => !q.quote_no).length > 0 && (
            <p className="text-[13px] text-amber-600 mt-0.5">⚠️ {quotes.filter((q) => !q.quote_no).length} รายการรอดำเนินการ</p>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Quote list */}
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
              className={`grid grid-cols-[100px_1.2fr_1.5fr_1fr_80px_80px] gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 cursor-pointer transition-colors items-center ${selected?.id === q.id ? "bg-mint-light" : "hover:bg-[#fafaf8]"}`}
            >
              <div className="text-[12px] text-[#888]">{fmtDate(q.created_at)}</div>
              <div className="text-[13px] text-navy font-medium truncate">{q.contact_name}</div>
              <div className="text-[13px] text-[#555] truncate">{q.company_name}</div>
              <div className="text-[12px] text-[#888] capitalize">{q.license_type}</div>
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

        {/* Detail panel */}
        {selected && (
          <div className="w-[300px] flex-shrink-0 bg-white rounded-2xl border border-border p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-navy">รายละเอียด</h3>
              <button onClick={() => setSelected(null)} className="text-[#aaa] hover:text-navy bg-transparent border-none cursor-pointer text-lg leading-none">✕</button>
            </div>

            <div className="flex flex-col gap-2 text-[13px]">
              <Row label="บริษัท" value={selected.company_name} />
              <Row label="ผู้ติดต่อ" value={selected.contact_name} />
              <Row label="อีเมล" value={selected.email} />
              <Row label="ที่อยู่" value={selected.address} />
              <Row label="เลขภาษี" value={selected.tax_id} />
              <Row label="รูปแบบสิทธิ์" value={selected.license_type} />
              {selected.note && <Row label="หมายเหตุ" value={selected.note} />}
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
              {!selected.quote_no && (
                <Button onClick={() => issueDocument(selected, "quotation")} className="w-full">
                  ออกใบเสนอราคา
                </Button>
              )}
              {selected.quote_no && !selected.receipt_no && (
                <Button onClick={() => issueDocument(selected, "receipt")} className="w-full">
                  ออกใบเสร็จรับเงิน
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
              <button onClick={() => deleteQuote(selected)} className="w-full py-2 rounded-xl border border-red-200 text-red-500 bg-red-50 text-[13px] cursor-pointer hover:bg-red-100 transition-colors">
                ลบ
              </button>
            </div>
          </div>
        )}
      </div>

      <PrintLightbox open={printOpen} data={printData} onClose={() => setPrintOpen(false)} />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 rounded-xl bg-navy text-white text-[13px] font-medium shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[#aaa]">{label}: </span>
      <span className="text-navy">{value}</span>
    </div>
  );
}
