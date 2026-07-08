"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type QuoteRow = {
  id: string;
  contact_name: string;
  company_name: string;
  email: string;
  license_type: string;
  fonts: string[];
  note: string | null;
  quote_no?: string | null;
  created_at: string;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function DesignerQuotesPage() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QuoteRow | null>(null);

  const loadQuotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .eq("designer_id", user.id)
      .order("created_at", { ascending: false });
    setQuotes((data as QuoteRow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  const pending = quotes.filter((q) => !(q as never as { quote_no: string | null }).quote_no);

  return (
    <div className="p-6 max-w-[1000px]">
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
          <div className="grid grid-cols-[100px_1.2fr_1.5fr_1fr_80px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
            <div>วันที่</div><div>ชื่อผู้ติดต่อ</div><div>บริษัท/องค์กร</div><div>รูปแบบสิทธิ์</div><div>สถานะ</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">กำลังโหลด…</div>
          ) : quotes.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">ยังไม่มีใบเสนอราคา</div>
          ) : quotes.map((q) => (
            <div
              key={q.id}
              onClick={() => setSelected(selected?.id === q.id ? null : q)}
              className={`grid grid-cols-[100px_1.2fr_1.5fr_1fr_80px] gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 cursor-pointer transition-colors items-center ${
                selected?.id === q.id ? "bg-mint-light" : "hover:bg-[#fafaf8]"
              }`}
            >
              <div className="text-[12px] text-[#888]">{fmtDate(q.created_at)}</div>
              <div className="text-[13px] text-navy font-medium truncate">{q.contact_name}</div>
              <div className="text-[13px] text-[#555] truncate">{q.company_name}</div>
              <div className="text-[12px] text-[#888]">{q.license_type}</div>
              <div>
                {(q as never as { quote_no: string | null }).quote_no ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">ดำเนินการแล้ว</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">รอดำเนินการ</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="w-[280px] flex-shrink-0 bg-white rounded-2xl border border-border p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-navy">รายละเอียด</h3>
              <button onClick={() => setSelected(null)} className="text-[#aaa] hover:text-navy bg-transparent border-none cursor-pointer text-lg leading-none">✕</button>
            </div>
            <div className="flex flex-col gap-2 text-[13px]">
              {[
                { label: "บริษัท", value: selected.company_name },
                { label: "ผู้ติดต่อ", value: selected.contact_name },
                { label: "อีเมล", value: selected.email },
                { label: "รูปแบบสิทธิ์", value: selected.license_type },
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
            <div className="border-t border-border pt-3">
              <p className="text-[12px] text-[#aaa]">
                การออกใบเสนอราคา / ใบเสร็จ จัดการได้ที่{" "}
                <a href="/admin/quotes" className="text-mint no-underline hover:underline">Admin Panel</a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
