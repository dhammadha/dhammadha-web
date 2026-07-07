"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export default function AdminSettingsPage() {
  const { user } = useAuth();

  // Seller info
  const [entityType, setEntityType] = useState<"individual" | "juristic">("individual");
  const [businessName, setBusinessName] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerTaxId, setSellerTaxId] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");

  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!user) return;
    // Load seller info
    supabase.from("users").select("name, business_name, entity_type, tax_id, address, phone, bank").eq("id", user.id).single().then(({ data }) => {
      if (!data) return;
      setEntityType((data.entity_type as "individual" | "juristic") ?? "individual");
      setBusinessName(data.business_name ?? "");
      setSellerName(data.name ?? "");
      setSellerTaxId(data.tax_id ?? "");
      setSellerAddress(data.address ?? "");
      setSellerPhone(data.phone ?? "");
      const b = (data.bank as { bank_name?: string; account_name?: string; account_number?: string } | null) ?? {};
      setBankName(b.bank_name ?? "");
      setBankAccount(b.account_name ?? "");
      setBankAccountNo(b.account_number ?? "");
    });
  }, [user]);

  const saveSeller = async () => {
    if (!user) return;
    const { error } = await supabase.from("users").update({
      entity_type: entityType,
      business_name: businessName || null,
      name: sellerName,
      tax_id: sellerTaxId,
      address: sellerAddress,
      phone: sellerPhone,
      bank: { bank_name: bankName, account_name: bankAccount, account_number: bankAccountNo },
    }).eq("id", user.id);
    if (error) showToast("เกิดข้อผิดพลาด: " + error.message, true);
    else showToast("✓ บันทึกข้อมูลผู้ขายเรียบร้อย");
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
          <Field label={entityType === "individual" ? "ชื่อ-สกุล (เจ้าของ)" : "ชื่อบริษัท (ทางการ)"}>
            <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} className={iCls} />
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี"><input value={sellerTaxId} onChange={(e) => setSellerTaxId(e.target.value)} className={iCls} /></Field>
        </div>
        <Field label="ที่อยู่" className="mt-3"><textarea value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} rows={2} className={iCls} /></Field>
        <Field label="โทรศัพท์" className="mt-3"><input value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} className={iCls} /></Field>
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-[12px] font-medium text-[#666] mb-2">ข้อมูลบัญชีธนาคาร</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="ธนาคาร"><input value={bankName} onChange={(e) => setBankName(e.target.value)} className={iCls} /></Field>
            <Field label="ชื่อบัญชี"><input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={iCls} /></Field>
            <Field label="เลขที่บัญชี"><input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} className={iCls} /></Field>
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

const iCls = "w-full px-3 py-2 rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]";
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
