"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  const [savedSlug, setSavedSlug] = useState(""); // slug that's actually saved in DB

  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const showToast = (msg: string, error = false) => { setToast({ msg, error }); setTimeout(() => setToast(null), 3500); };

  // ref mirrors current draft values so saveDraft() always has the latest snapshot
  type Draft = { entityType: string; businessName: string; designerSlug: string; sellerName: string; sellerTaxId: string; sellerAddress: string; sellerPhone: string; bankName: string; bankBranch: string; bankAccount: string; bankAccountNo: string };
  const draft = useRef<Draft>({ entityType: "individual", businessName: "", designerSlug: "", sellerName: "", sellerTaxId: "", sellerAddress: "", sellerPhone: "", bankName: "", bankBranch: "", bankAccount: "", bankAccountNo: "" });

  const saveDraft = useCallback((patch: Partial<Draft>) => {
    draft.current = { ...draft.current, ...patch };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft.current));
  }, []);

  // Load DB data on mount, then apply draft if exists
  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("name, business_name, entity_type, designer_slug, tax_id, address, phone, bank").eq("id", user.id).single().then(({ data }) => {
      const b = (data?.bank as { bank_name?: string; branch?: string; account_name?: string; account_number?: string } | null) ?? {};
      const dbValues: Draft = {
        entityType: (data?.entity_type as "individual" | "juristic") ?? "individual",
        businessName: data?.business_name ?? "",
        designerSlug: data?.designer_slug ?? "",
        sellerName: data?.name ?? "",
        sellerTaxId: data?.tax_id ?? "",
        sellerAddress: data?.address ?? "",
        sellerPhone: data?.phone ?? "",
        bankName: b.bank_name ?? "",
        bankBranch: b.branch ?? "",
        bankAccount: b.account_name ?? "",
        bankAccountNo: b.account_number ?? "",
      };

      // Overlay cached draft on top of DB values
      let values = { ...dbValues };
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        try { values = { ...values, ...JSON.parse(raw) }; } catch { /* ignore */ }
      }

      // Auto-fill account name if still empty
      if (!values.bankAccount) values.bankAccount = values.sellerName;

      setSavedSlug(dbValues.designerSlug); // lock based on DB value, not draft
      draft.current = values;
      setEntityType(values.entityType as "individual" | "juristic");
      setBusinessName(values.businessName);
      setDesignerSlug(values.designerSlug);
      setSellerName(values.sellerName);
      setSellerTaxId(values.sellerTaxId);
      setSellerAddress(values.sellerAddress);
      setSellerPhone(values.sellerPhone);
      setBankName(values.bankName);
      setBankBranch(values.bankBranch);
      setBankAccount(values.bankAccount);
      setBankAccountNo(values.bankAccountNo);
    });
  }, [user]);

  // When user switches entityType, update account name to match
  const handleEntityType = (t: "individual" | "juristic") => {
    const derived = sellerName;
    setEntityType(t);
    if (derived) setBankAccount(derived);
    saveDraft({ entityType: t, ...(derived ? { bankAccount: derived } : {}) });
  };

  const saveSeller = async () => {
    if (!user) return;
    if (sellerTaxId && sellerTaxId.replace(/\D/g, "").length !== 13) {
      showToast("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก", true);
      return;
    }
    const basePayload = {
      entity_type: entityType,
      business_name: businessName || null,
      name: sellerName,
      tax_id: sellerTaxId,
      address: sellerAddress,
      phone: sellerPhone,
      bank: { bank_name: bankName, branch: bankBranch, account_name: bankAccount, account_number: bankAccountNo },
    };
    const { error } = await supabase.from("users").update(basePayload).eq("id", user.id);
    if (error) { showToast("เกิดข้อผิดพลาด: " + error.message, true); return; }

    // Try to save designer_slug separately (column may not exist yet if migration not applied)
    if (designerSlug) {
      await supabase.from("users").update({ designer_slug: designerSlug.toLowerCase().replace(/[^a-z0-9-]/g, "") || null }).eq("id", user.id);
    }

    if (designerSlug) setSavedSlug(designerSlug);
    localStorage.removeItem(DRAFT_KEY);
    showToast("✓ บันทึกข้อมูลผู้ขายเรียบร้อย");
  };

  return (
    <div className="p-6 max-w-[680px] flex flex-col gap-8">
      <Section title="ข้อมูลผู้ขาย" desc="ใช้แสดงในใบเสนอราคาและใบเสร็จ">
        <div className="flex gap-2 mb-4">
          {(["individual", "juristic"] as const).map((t) => (
            <button key={t} onClick={() => handleEntityType(t)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium border cursor-pointer transition-colors ${entityType === t ? "bg-navy text-white border-navy" : "bg-white text-[#666] border-border hover:bg-[#f5f5f2]"}`}>
              {t === "individual" ? "บุคคลธรรมดา" : "นิติบุคคล"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ชื่อแบรนด์ / ร้านค้า">
            <input value={businessName} onChange={(e) => { setBusinessName(e.target.value); saveDraft({ businessName: e.target.value }); }} placeholder="เช่น DHAMMADHA STUDIO" className={iCls} />
          </Field>
          <Field label="Designer Slug (URL)">
            {savedSlug ? (
              <div>
                <div className={`${iCls} flex items-center gap-2 cursor-default text-[#888] bg-[#f5f5f2]`}>
                  <span className="text-[#aaa]">/designer/</span>
                  <span className="font-medium text-navy">{designerSlug}</span>
                  <span className="ml-auto text-[10px] text-[#bbb] bg-[#eee] px-2 py-0.5 rounded-full">ล็อก</span>
                </div>
                <p className="text-[11px] text-[#aaa] mt-1">URL ถูกล็อกหลังตั้งครั้งแรก — ติดต่อ admin เพื่อเปลี่ยน</p>
              </div>
            ) : (
              <input value={designerSlug} onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setDesignerSlug(v); saveDraft({ designerSlug: v }); }} placeholder="เช่น dhammadha" className={iCls} />
            )}
          </Field>
          <Field label={entityType === "individual" ? "ชื่อ-สกุล (เจ้าของ)" : "ชื่อบริษัท (ทางการ)"}>
            <input value={sellerName} onChange={(e) => { setSellerName(e.target.value); saveDraft({ sellerName: e.target.value }); }} className={iCls} />
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี (13 หลัก)">
            <input
              value={sellerTaxId}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 13); setSellerTaxId(v); saveDraft({ sellerTaxId: v }); }}
              placeholder="0000000000000"
              maxLength={13}
              inputMode="numeric"
              className={`${iCls} ${sellerTaxId && sellerTaxId.length !== 13 ? "border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_#ef444420]" : ""}`}
            />
            {sellerTaxId && sellerTaxId.length !== 13 && (
              <span className="text-[11px] text-red-500">{sellerTaxId.length}/13 หลัก</span>
            )}
          </Field>
        </div>
        <Field label="ที่อยู่" className="mt-3"><textarea value={sellerAddress} onChange={(e) => { setSellerAddress(e.target.value); saveDraft({ sellerAddress: e.target.value }); }} rows={2} className={iCls} /></Field>
        <Field label="โทรศัพท์" className="mt-3"><input value={sellerPhone} onChange={(e) => { setSellerPhone(e.target.value); saveDraft({ sellerPhone: e.target.value }); }} className={iCls} /></Field>

        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-[12px] font-medium text-[#666] mb-2">ข้อมูลบัญชีธนาคาร</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="ธนาคาร">
              <select value={bankName} onChange={(e) => { setBankName(e.target.value); saveDraft({ bankName: e.target.value }); }} className={iCls}>
                <option value="">— เลือกธนาคาร —</option>
                {THAI_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="สาขา">
              <input value={bankBranch} onChange={(e) => { setBankBranch(e.target.value); saveDraft({ bankBranch: e.target.value }); }} placeholder="เช่น สยามพารากอน" className={iCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ชื่อบัญชี">
              <input value={bankAccount} onChange={(e) => { setBankAccount(e.target.value); saveDraft({ bankAccount: e.target.value }); }} className={iCls} />
            </Field>
            <Field label="เลขที่บัญชี">
              <input value={bankAccountNo} onChange={(e) => { setBankAccountNo(e.target.value); saveDraft({ bankAccountNo: e.target.value }); }} className={iCls} />
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
