"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/Button";

const THAI_BANKS = [
  "ธนาคารกสิกรไทย (KBANK)",
  "ธนาคารไทยพาณิชย์ (SCB)",
  "ธนาคารกรุงเทพ (BBL)",
  "ธนาคารกรุงไทย (KTB)",
  "ธนาคารกรุงศรีอยุธยา (BAY)",
  "ธนาคารทหารไทยธนชาต (TTB)",
  "ธนาคารออมสิน (GSB)",
  "ธนาคารอาคารสงเคราะห์ (GHB)",
  "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (BAAC)",
  "ธนาคารยูโอบี (UOB)",
  "ธนาคารซีไอเอ็มบีไทย (CIMB)",
  "ธนาคารเกียรตินาคินภัทร (KKP)",
  "ธนาคารทิสโก้ (TISCO)",
  "ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)",
];

export default function DesignerSettingsPage() {
  const { user } = useAuth();
  const DRAFT_KEY = `settings_draft_${user?.id ?? "anon"}`;

  const [entityType, setEntityType] = useState<"individual" | "juristic">("individual");
  const [businessName, setBusinessName] = useState("");
  const [designerSlug, setDesignerSlug] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerTaxId, setSellerTaxId] = useState("");
  const [sellerVatRegistered, setSellerVatRegistered] = useState(false);
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
  type Draft = { entityType: string; businessName: string; designerSlug: string; sellerName: string; sellerTaxId: string; sellerVatRegistered: boolean; sellerAddress: string; sellerPhone: string; bankName: string; bankBranch: string; bankAccount: string; bankAccountNo: string };
  const draft = useRef<Draft>({ entityType: "individual", businessName: "", designerSlug: "", sellerName: "", sellerTaxId: "", sellerVatRegistered: false, sellerAddress: "", sellerPhone: "", bankName: "", bankBranch: "", bankAccount: "", bankAccountNo: "" });
  const bankAccountEdited = useRef(false); // true = user manually typed in bankAccount field

  const saveDraft = useCallback((patch: Partial<Draft>) => {
    draft.current = { ...draft.current, ...patch };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft.current));
  }, []);

  // Load DB data on mount, then apply draft if exists
  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("name, business_name, entity_type, designer_slug, tax_id, vat_registered, address, phone, bank").eq("id", user.id).single().then(({ data }) => {
      const b = (data?.bank as { bank_name?: string; branch?: string; account_name?: string; account_number?: string } | null) ?? {};
      const dbValues: Draft = {
        entityType: (data?.entity_type as "individual" | "juristic") ?? "individual",
        businessName: data?.business_name ?? "",
        designerSlug: data?.designer_slug ?? "",
        sellerName: data?.name ?? "",
        sellerTaxId: data?.tax_id ?? "",
        sellerVatRegistered: data?.vat_registered ?? false,
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

      setSavedSlug(dbValues.designerSlug);
      if (dbValues.bankAccount) bankAccountEdited.current = true; // existing account name = don't auto-overwrite
      draft.current = values;
      setEntityType(values.entityType as "individual" | "juristic");
      setBusinessName(values.businessName);
      setDesignerSlug(values.designerSlug);
      setSellerName(values.sellerName);
      setSellerTaxId(values.sellerTaxId);
      setSellerVatRegistered(values.sellerVatRegistered);
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
    setEntityType(t);
    bankAccountEdited.current = false;
    if (sellerName) { setBankAccount(sellerName); saveDraft({ entityType: t, bankAccount: sellerName }); }
    else saveDraft({ entityType: t });
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
      vat_registered: sellerVatRegistered,
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
            <Button key={t} onClick={() => handleEntityType(t)} size="sm"
              variant={entityType === t ? "primary" : "outline"}>
              {t === "individual" ? "บุคคลธรรมดา" : "นิติบุคคล"}
            </Button>
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
              <div>
                <input value={designerSlug} onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setDesignerSlug(v); saveDraft({ designerSlug: v }); }} placeholder="เช่น dhammadha" className={iCls} />
                <p className="text-[11px] text-amber-600 mt-1">⚠️ ตั้งได้ครั้งเดียว — ไม่สามารถแก้ไขได้หลังบันทึก</p>
              </div>
            )}
          </Field>
          <Field label={entityType === "individual" ? "ชื่อ-สกุล (เจ้าของ)" : "ชื่อบริษัท (ทางการ)"}>
            <input value={sellerName} onChange={(e) => {
              const v = e.target.value;
              setSellerName(v);
              saveDraft({ sellerName: v });
              if (!bankAccountEdited.current) { setBankAccount(v); saveDraft({ sellerName: v, bankAccount: v }); }
            }} className={iCls} />
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
        {/* เก็บสถานะไว้ล่วงหน้าเผื่ออนาคต — ตอนนี้ยังไม่มีการคำนวณ VAT ที่ใด */}
        <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sellerVatRegistered}
            onChange={(e) => { setSellerVatRegistered(e.target.checked); saveDraft({ sellerVatRegistered: e.target.checked }); }}
            className="mt-0.5 accent-[#0a8a84] shrink-0"
          />
          <div>
            <span className="text-[13px] text-navy">จดทะเบียนภาษีมูลค่าเพิ่ม (VAT)</span>
            <p className="text-[11px] text-[#aaa] mt-0.5 leading-[1.6]">
              ติ๊กหากคุณจดทะเบียน VAT แล้ว — คนละเรื่องกับเลขประจำตัวผู้เสียภาษี ตอนนี้ยังไม่มีผลต่อการคำนวณราคา เก็บไว้ใช้ในอนาคต
            </p>
          </div>
        </label>
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
              <input value={bankAccount} onChange={(e) => { bankAccountEdited.current = true; setBankAccount(e.target.value); saveDraft({ bankAccount: e.target.value }); }} className={iCls} />
            </Field>
            <Field label="เลขที่บัญชี">
              <input value={bankAccountNo} onChange={(e) => { setBankAccountNo(e.target.value); saveDraft({ bankAccountNo: e.target.value }); }} className={iCls} />
            </Field>
          </div>
        </div>
        <Button onClick={saveSeller} className="w-full mt-4">บันทึกข้อมูลผู้ขาย</Button>
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
