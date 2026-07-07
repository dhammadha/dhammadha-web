"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const THAI_BANKS = [
  "ธนาคารกรุงเทพ (BBL)",
  "ธนาคารกสิกรไทย (KBANK)",
  "ธนาคารกรุงไทย (KTB)",
  "ธนาคารทหารไทยธนชาต (TTB)",
  "ธนาคารไทยพาณิชย์ (SCB)",
  "ธนาคารกรุงศรีอยุธยา (BAY)",
  "ธนาคารเกียรตินาคินภัทร (KKP)",
  "ธนาคารซีไอเอ็มบีไทย (CIMB)",
  "ธนาคารทิสโก้ (TISCO)",
  "ธนาคารยูโอบี (UOB)",
  "ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)",
  "ธนาคารออมสิน (GSB)",
  "ธนาคารอาคารสงเคราะห์ (GHB)",
  "ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)",
];

const DRAFT_KEY = "settings_draft";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const loaded = useRef(false);

  // Seller info
  const [entityType, setEntityType] = useState<"individual" | "juristic">("individual");
  const [businessName, setBusinessName] = useState("");
  const [designerSlug, setDesignerSlug] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerTaxId, setSellerTaxId] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");

  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  // Load from DB on mount
  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("name, business_name, entity_type, designer_slug, tax_id, address, phone, bank").eq("id", user.id).single().then(({ data }) => {
      if (!data) return;
      // Check for cached draft first
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        try {
          const d = JSON.parse(raw);
          setEntityType(d.entityType ?? "individual");
          setBusinessName(d.businessName ?? "");
          setDesignerSlug(d.designerSlug ?? "");
          setSellerName(d.sellerName ?? "");
          setSellerTaxId(d.sellerTaxId ?? "");
          setSellerAddress(d.sellerAddress ?? "");
          setSellerPhone(d.sellerPhone ?? "");
          setBankName(d.bankName ?? "");
          setBankBranch(d.bankBranch ?? "");
          setBankAccount(d.bankAccount ?? "");
          setBankAccountNo(d.bankAccountNo ?? "");
          loaded.current = true;
          return;
        } catch { /* fall through to DB data */ }
      }
      const b = (data.bank as { bank_name?: string; branch?: string; account_name?: string; account_number?: string } | null) ?? {};
      setEntityType((data.entity_type as "individual" | "juristic") ?? "individual");
      setBusinessName(data.business_name ?? "");
      setDesignerSlug(data.designer_slug ?? "");
      setSellerName(data.name ?? "");
      setSellerTaxId(data.tax_id ?? "");
      setSellerAddress(data.address ?? "");
      setSellerPhone(data.phone ?? "");
      setBankName(b.bank_name ?? "");
      setBankBranch(b.branch ?? "");
      setBankAccount(b.account_name ?? "");
      setBankAccountNo(b.account_number ?? "");
      loaded.current = true;
    });
  }, [user]);

  // Auto-fill bank account name from seller name when entityType or names change
  useEffect(() => {
    if (!loaded.current) return;
    if (bankAccount) return; // don't overwrite if already set
    const derived = entityType === "individual" ? sellerName : businessName;
    if (derived) setBankAccount(derived);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, sellerName, businessName]);

  // Save draft to localStorage
  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ entityType, businessName, designerSlug, sellerName, sellerTaxId, sellerAddress, sellerPhone, bankName, bankBranch, bankAccount, bankAccountNo }));
  }, [entityType, businessName, designerSlug, sellerName, sellerTaxId, sellerAddress, sellerPhone, bankName, bankBranch, bankAccount, bankAccountNo]);

  const saveSeller = async () => {
    if (!user) return;
    const { error } = await supabase.from("users").update({
      entity_type: entityType,
      business_name: businessName || null,
      designer_slug: designerSlug.toLowerCase().replace(/[^a-z0-9-]/g, "") || null,
      name: sellerName,
      tax_id: sellerTaxId,
      address: sellerAddress,
      phone: sellerPhone,
      bank: { bank_name: bankName, branch: bankBranch, account_name: bankAccount, account_number: bankAccountNo },
    }).eq("id", user.id);
    if (error) showToast("เกิดข้อผิดพลาด: " + error.message, true);
    else {
      localStorage.removeItem(DRAFT_KEY);
      showToast("✓ บันทึกข้อมูลผู้ขายเรียบร้อย");
    }
  };

  return (
    <div className="p-6 max-w-[680px] flex flex-col gap-8">
      {/* Seller info */}
      <Section title="ข้อมูลผู้ขาย" desc="ใช้แสดงในใบเสนอราคาและใบเสร็จ">
        {/* Entity type toggle */}
        <div className="flex gap-2 mb-4">
          {(["individual", "juristic"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setEntityType(t)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium border cursor-pointer transition-colors ${entityType === t ? "bg-navy text-white border-navy" : "bg-white text-[#666] border-border hover:bg-[#f5f5f2]"}`}
            >
              {t === "individual" ? "บุคคลธรรมดา" : "นิติบุคคล"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ชื่อแบรนด์ / ร้านค้า">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="เช่น DHAMMADHA STUDIO" className={iCls} />
          </Field>
          <Field label="Designer Slug (URL)">
            <input value={designerSlug} onChange={(e) => setDesignerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="เช่น dhammadha" className={iCls} />
          </Field>
          <Field label={entityType === "individual" ? "ชื่อ-สกุล (เจ้าของ)" : "ชื่อบริษัท (ทางการ)"}>
            <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} className={iCls} />
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี"><input value={sellerTaxId} onChange={(e) => setSellerTaxId(e.target.value)} className={iCls} /></Field>
        </div>
        <Field label="ที่อยู่" className="mt-3"><textarea value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} rows={2} className={iCls} /></Field>
        <Field label="โทรศัพท์" className="mt-3"><input value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} className={iCls} /></Field>

        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-[12px] font-medium text-[#666] mb-2">ข้อมูลบัญชีธนาคาร</div>
          {/* Row 1: bank + branch */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="ธนาคาร">
              <select value={bankName} onChange={(e) => setBankName(e.target.value)} className={iCls}>
                <option value="">— เลือกธนาคาร —</option>
                {THAI_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="สาขา">
              <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="เช่น สยามพารากอน" className={iCls} />
            </Field>
          </div>
          {/* Row 2: account name + account number */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="ชื่อบัญชี">
              <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={iCls} />
            </Field>
            <Field label="เลขที่บัญชี">
              <input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} className={iCls} />
            </Field>
          </div>
        </div>
        <button onClick={saveSeller} className={btnMint + " mt-4"}>บันทึกข้อมูลผู้ขาย</button>
      </Section>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl text-[13px] font-medium shadow-lg ${toast.error ? "bg-red-500 text-white" : "bg-navy text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const iCls = "w-full px-3 py-2 h-[42px] rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]";
const btnMint = "w-full py-2.5 rounded-xl bg-mint text-white font-semibold text-[14px] border-none cursor-pointer hover:bg-[#4dbfb9] transition-colors";

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-navy">{title}</h2>
        <p className="text-[12px] text-[#aaa] mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[12px] font-medium text-[#666]">{label}</label>
      {children}
    </div>
  );
}
