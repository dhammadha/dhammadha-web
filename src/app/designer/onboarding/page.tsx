"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

const iCls =
  "w-full px-3 py-2 h-[42px] rounded-xl border border-border bg-[#fafaf8] text-[14px] text-navy outline-none focus:border-mint focus:shadow-[0_0_0_3px_#5ECEC820] transition-all font-[inherit]";

function Field({ label, hint, children, className = "" }: {
  label: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[12px] font-medium text-[#666]">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[#aaa] leading-[1.5]">{hint}</p>}
    </div>
  );
}

// ─── Step 1: Slug ────────────────────────────────────────────────────────────

function Step1({
  slug, savedSlug, onSlugChange, onNext, saving, error,
}: {
  slug: string; savedSlug: string;
  onSlugChange: (v: string) => void;
  onNext: () => void;
  saving: boolean; error: string;
}) {
  const isLocked = !!savedSlug;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[20px] font-semibold text-navy mb-1">ตั้งชื่อ URL หน้าร้านของคุณ</h2>
        <p className="text-[13px] text-[#888] leading-[1.7]">
          Slug คือที่อยู่หน้าร้านและเป็นส่วนหนึ่งของลิงก์ฟอนต์ทุกตัว
          — ตั้งได้ครั้งเดียว เปลี่ยนภายหลังต้องติดต่อ admin
        </p>
      </div>

      <Field
        label="Designer Slug"
        hint={isLocked ? "URL ถูกล็อกหลังตั้งครั้งแรก — ติดต่อ admin เพื่อเปลี่ยน" : "⚠️ ตั้งได้ครั้งเดียว — ไม่สามารถแก้ไขได้หลังบันทึก"}
      >
        {isLocked ? (
          <div className={`${iCls} flex items-center gap-2 cursor-default text-[#888] bg-[#f5f5f2]`}>
            <span className="text-[#aaa]">/designer/</span>
            <span className="font-medium text-navy">{slug}</span>
            <span className="ml-auto text-[10px] text-[#bbb] bg-[#eee] px-2 py-0.5 rounded-full">ล็อก</span>
          </div>
        ) : (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#aaa] pointer-events-none select-none">
              /designer/
            </span>
            <input
              value={slug}
              onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="yourname"
              className={`${iCls} pl-[88px]`}
              autoFocus
            />
          </div>
        )}
      </Field>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      <Button onClick={onNext} disabled={saving || !slug} className="w-full">
        {saving ? "กำลังบันทึก…" : "ถัดไป →"}
      </Button>
    </div>
  );
}

// ─── Step 2: Seller info ─────────────────────────────────────────────────────

function Step2({
  entityType, businessName, sellerName, sellerTaxId, sellerAddress, sellerPhone,
  onChange, onNext, onBack, saving, error,
}: {
  entityType: "individual" | "juristic";
  businessName: string; sellerName: string; sellerTaxId: string;
  sellerAddress: string; sellerPhone: string;
  onChange: (patch: Record<string, string>) => void;
  onNext: () => void; onBack: () => void;
  saving: boolean; error: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[20px] font-semibold text-navy mb-1">ข้อมูลผู้ขาย</h2>
        <p className="text-[13px] text-[#888] leading-[1.7]">
          ใช้แสดงในใบเสนอราคาและเอกสารที่ออกให้ลูกค้าองค์กร
        </p>
      </div>

      <div className="flex gap-2">
        {(["individual", "juristic"] as const).map((t) => (
          <Button
            key={t}
            onClick={() => onChange({ entityType: t })}
            size="sm"
            variant={entityType === t ? "primary" : "outline"}
          >
            {t === "individual" ? "บุคคลธรรมดา" : "นิติบุคคล"}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ชื่อแบรนด์ / ร้านค้า">
          <input
            value={businessName}
            onChange={(e) => onChange({ businessName: e.target.value })}
            placeholder="เช่น DHAMMADHA STUDIO"
            className={iCls}
          />
        </Field>
        <Field label={entityType === "individual" ? "ชื่อ-สกุล (เจ้าของ)" : "ชื่อบริษัท (ทางการ)"}>
          <input
            value={sellerName}
            onChange={(e) => onChange({ sellerName: e.target.value })}
            className={iCls}
          />
        </Field>
        <Field label="เลขประจำตัวผู้เสียภาษี (13 หลัก)">
          <input
            value={sellerTaxId}
            onChange={(e) => onChange({ sellerTaxId: e.target.value.replace(/\D/g, "").slice(0, 13) })}
            placeholder="0000000000000"
            maxLength={13}
            inputMode="numeric"
            className={`${iCls} ${sellerTaxId && sellerTaxId.length !== 13 ? "border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_#ef444420]" : ""}`}
          />
          {sellerTaxId && sellerTaxId.length !== 13 && (
            <span className="text-[11px] text-red-500">{sellerTaxId.length}/13 หลัก</span>
          )}
        </Field>
        <Field label="โทรศัพท์">
          <input
            value={sellerPhone}
            onChange={(e) => onChange({ sellerPhone: e.target.value })}
            className={iCls}
          />
        </Field>
      </div>

      <Field label="ที่อยู่">
        <textarea
          value={sellerAddress}
          onChange={(e) => onChange({ sellerAddress: e.target.value })}
          rows={2}
          className={`${iCls} h-auto py-2`}
        />
      </Field>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" className="flex-1">← ย้อนกลับ</Button>
        <Button onClick={onNext} disabled={saving || !sellerName || !sellerAddress} className="flex-[2]">
          {saving ? "กำลังบันทึก…" : "ถัดไป →"}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Bank ─────────────────────────────────────────────────────────────

function Step3({
  bankName, bankBranch, bankAccount, bankAccountNo,
  onChange, onNext, onBack, saving, error,
}: {
  bankName: string; bankBranch: string; bankAccount: string; bankAccountNo: string;
  onChange: (patch: Record<string, string>) => void;
  onNext: () => void; onBack: () => void;
  saving: boolean; error: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[20px] font-semibold text-navy mb-1">บัญชีธนาคาร</h2>
        <p className="text-[13px] text-[#888] leading-[1.7]">
          ใช้โอนส่วนแบ่งรายได้จากการขายผ่านเว็บ
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ธนาคาร">
          <select
            value={bankName}
            onChange={(e) => onChange({ bankName: e.target.value })}
            className={iCls}
          >
            <option value="">— เลือกธนาคาร —</option>
            {THAI_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="สาขา">
          <input
            value={bankBranch}
            onChange={(e) => onChange({ bankBranch: e.target.value })}
            placeholder="เช่น สยามพารากอน"
            className={iCls}
          />
        </Field>
        <Field label="ชื่อบัญชี">
          <input
            value={bankAccount}
            onChange={(e) => onChange({ bankAccount: e.target.value })}
            className={iCls}
          />
        </Field>
        <Field label="เลขที่บัญชี">
          <input
            value={bankAccountNo}
            onChange={(e) => onChange({ bankAccountNo: e.target.value })}
            className={iCls}
          />
        </Field>
      </div>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" className="flex-1">← ย้อนกลับ</Button>
        <Button
          onClick={onNext}
          disabled={saving || !bankName || !bankAccountNo}
          className="flex-[2]"
        >
          {saving ? "กำลังบันทึก…" : "เสร็จสิ้น ✓"}
        </Button>
      </div>
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  const steps = ["URL หน้าร้าน", "ข้อมูลผู้ขาย", "บัญชีธนาคาร"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold transition-colors ${
                  done
                    ? "bg-mint text-white"
                    : active
                    ? "bg-navy text-white"
                    : "bg-[#e8e8e2] text-[#bbb]"
                }`}
              >
                {done ? "✓" : n}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  active ? "text-navy font-medium" : done ? "text-mint" : "text-[#bbb]"
                }`}
              >
                {label}
              </span>
            </div>
            {n < steps.length && (
              <div
                className={`flex-1 h-[1px] mb-4 mx-1 transition-colors ${
                  step > n ? "bg-mint" : "bg-[#e8e8e2]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dbLoaded, setDbLoaded] = useState(false);

  // Step 1
  const [slug, setSlug] = useState("");
  const [savedSlug, setSavedSlug] = useState("");

  // Step 2
  const [entityType, setEntityType] = useState<"individual" | "juristic">("individual");
  const [businessName, setBusinessName] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerTaxId, setSellerTaxId] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");

  // Step 3
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");

  // redirect if not designer/admin
  useEffect(() => {
    if (!loading && (!user || (role !== "designer" && role !== "admin"))) {
      router.replace(user ? "/" : "/auth/login");
    }
  }, [loading, user, role, router]);

  // load existing data and determine starting step
  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("designer_slug, name, business_name, entity_type, tax_id, address, phone, bank")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const b = (data?.bank as { bank_name?: string; branch?: string; account_name?: string; account_number?: string } | null) ?? {};
        const hasSlug = !!data?.designer_slug;
        const hasSellerInfo = !!(data?.name && data?.address);
        const hasBank = !!b.account_number;

        if (hasSlug) {
          setSavedSlug(data!.designer_slug!);
          setSlug(data!.designer_slug!);
        }
        if (data?.entity_type) setEntityType(data.entity_type as "individual" | "juristic");
        if (data?.business_name) setBusinessName(data.business_name);
        if (data?.name) setSellerName(data.name);
        if (data?.tax_id) setSellerTaxId(data.tax_id);
        if (data?.address) setSellerAddress(data.address);
        if (data?.phone) setSellerPhone(data.phone);
        if (b.bank_name) setBankName(b.bank_name);
        if (b.branch) setBankBranch(b.branch);
        if (b.account_name) setBankAccount(b.account_name);
        if (b.account_number) setBankAccountNo(b.account_number);

        // fast-forward to first incomplete step
        if (hasSlug && hasSellerInfo && hasBank) {
          router.replace("/designer");
          return;
        }
        if (hasSlug && hasSellerInfo) { setStep(3); }
        else if (hasSlug) { setStep(2); }
        else { setStep(1); }

        setDbLoaded(true);
      });
  }, [user, router]);

  const handleStep2Change = (patch: Record<string, string>) => {
    if ("entityType" in patch) setEntityType(patch.entityType as "individual" | "juristic");
    if ("businessName" in patch) setBusinessName(patch.businessName);
    if ("sellerName" in patch) setSellerName(patch.sellerName);
    if ("sellerTaxId" in patch) setSellerTaxId(patch.sellerTaxId);
    if ("sellerAddress" in patch) setSellerAddress(patch.sellerAddress);
    if ("sellerPhone" in patch) setSellerPhone(patch.sellerPhone);
  };

  const handleStep3Change = (patch: Record<string, string>) => {
    if ("bankName" in patch) setBankName(patch.bankName);
    if ("bankBranch" in patch) setBankBranch(patch.bankBranch);
    if ("bankAccount" in patch) setBankAccount(patch.bankAccount);
    if ("bankAccountNo" in patch) setBankAccountNo(patch.bankAccountNo);
  };

  const saveStep1 = async () => {
    if (!user || !slug) return;
    if (savedSlug) { setStep(2); return; } // already saved — just advance
    setSaving(true);
    setError("");
    const { error: err } = await supabase
      .from("users")
      .update({ designer_slug: slug })
      .eq("id", user.id);
    setSaving(false);
    if (err) {
      if (err.message.includes("duplicate") || err.message.includes("unique")) {
        setError("Slug นี้ถูกใช้แล้ว — ลองชื่ออื่น");
      } else {
        setError("เกิดข้อผิดพลาด: " + err.message);
      }
      return;
    }
    setSavedSlug(slug);
    setStep(2);
  };

  const saveStep2 = async () => {
    if (!user) return;
    if (sellerTaxId && sellerTaxId.replace(/\D/g, "").length !== 13) {
      setError("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("users").update({
      entity_type: entityType,
      business_name: businessName || null,
      name: sellerName,
      tax_id: sellerTaxId || null,
      address: sellerAddress,
      phone: sellerPhone || null,
    }).eq("id", user.id);
    setSaving(false);
    if (err) { setError("เกิดข้อผิดพลาด: " + err.message); return; }
    // auto-fill bank account name from seller name if empty
    if (!bankAccount) setBankAccount(sellerName);
    setStep(3);
  };

  const saveStep3 = async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("users").update({
      bank: { bank_name: bankName, branch: bankBranch, account_name: bankAccount, account_number: bankAccountNo },
    }).eq("id", user.id);
    setSaving(false);
    if (err) { setError("เกิดข้อผิดพลาด: " + err.message); return; }
    router.replace("/designer");
  };

  if (loading || !user || !dbLoaded) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="text-[#aaa] text-[14px]">กำลังโหลด…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-[#aaa] uppercase mb-2">
            DHAMMADHA STUDIO
          </div>
          <h1 className="text-[22px] font-semibold text-navy">ตั้งค่าร้านของคุณ</h1>
          <p className="text-[13px] text-[#999] mt-1">ทำครั้งเดียว ใช้ได้ตลอด</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
          <Stepper step={step} />

          {step === 1 && (
            <Step1
              slug={slug}
              savedSlug={savedSlug}
              onSlugChange={(v) => { setSlug(v); setError(""); }}
              onNext={saveStep1}
              saving={saving}
              error={error}
            />
          )}
          {step === 2 && (
            <Step2
              entityType={entityType}
              businessName={businessName}
              sellerName={sellerName}
              sellerTaxId={sellerTaxId}
              sellerAddress={sellerAddress}
              sellerPhone={sellerPhone}
              onChange={(patch) => { handleStep2Change(patch); setError(""); }}
              onNext={saveStep2}
              onBack={() => { setError(""); setStep(1); }}
              saving={saving}
              error={error}
            />
          )}
          {step === 3 && (
            <Step3
              bankName={bankName}
              bankBranch={bankBranch}
              bankAccount={bankAccount}
              bankAccountNo={bankAccountNo}
              onChange={(patch) => { handleStep3Change(patch); setError(""); }}
              onNext={saveStep3}
              onBack={() => { setError(""); setStep(2); }}
              saving={saving}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
