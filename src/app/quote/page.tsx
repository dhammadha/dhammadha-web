"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";

interface FontItem {
  id: string;
  name: string;
}

const LICENSE_TYPES = [
  {
    value: "small_medium",
    label: "บริษัทขนาดเล็ก / กลาง",
    desc: "ผู้ใช้งานไม่เกิน 10 เครื่อง",
  },
  {
    value: "large_agency",
    label: "บริษัทขนาดใหญ่ / Ad Agency",
    desc: "ไม่จำกัดจำนวนเครื่อง",
  },
  {
    value: "extended",
    label: "สิทธิการใช้งานเพิ่มเติม",
    desc: "TVC / Digital Video Ad / Film / Identity / Web Font / App Font ฯลฯ",
  },
];

const EMPTY_FORM = {
  contact_name: "",
  company_name: "",
  address: "",
  tax_id: "",
  email: "",
  license_type: "",
  note: "",
};

export default function QuotePage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fonts, setFonts] = useState<FontItem[]>([]);
  // list of selected font ids, one row per entry
  const [selectedFonts, setSelectedFonts] = useState<string[]>([""]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [showNote, setShowNote] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const q = query(collection(db, "fonts"), where("is_active", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, name: d.data().name as string }))
        .sort((a, b) => a.name.localeCompare(b.name, "th"));
      setFonts(list);
    });
    return () => unsub();
  }, []);

  function set(key: keyof typeof EMPTY_FORM, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function setFont(index: number, val: string) {
    setSelectedFonts((prev) => prev.map((v, i) => (i === index ? val : v)));
  }

  function addFont() {
    setSelectedFonts((prev) => [...prev, ""]);
  }

  function removeFont(index: number) {
    setSelectedFonts((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosenFonts = selectedFonts.filter(Boolean);
    if (
      !form.contact_name ||
      !form.company_name ||
      !form.address ||
      !form.tax_id ||
      !form.email ||
      !form.license_type ||
      chosenFonts.length === 0
    ) {
      setErrorMsg("กรุณากรอกข้อมูลให้ครบทุกช่องและเลือกฟอนต์อย่างน้อย 1 รายการ");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorMsg("กรุณากรอกอีเมลให้ถูกต้อง เช่น name@company.com");
      return;
    }
    if (!/^\d{13}$/.test(form.tax_id)) {
      setErrorMsg("หมายเลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    setErrorMsg("");
    setStatus("loading");
    try {
      const fontNames = chosenFonts.map(
        (id) => fonts.find((f) => f.id === id)?.name ?? id
      );
      await addDoc(collection(db, "quotes"), {
        ...form,
        fonts: fontNames,
        created_at: serverTimestamp(),
      });
      setStatus("success");
      setShowNote(true);
      setForm(EMPTY_FORM);
      setSelectedFonts([""]);
    } catch {
      setStatus("error");
      setErrorMsg("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  }

  if (status === "success") {
    return (
      <>
        <Nav />
        <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-bg px-8 py-16">
          <div className="max-w-[480px] w-full text-center">
            <div className="w-14 h-14 rounded-full bg-mint-light flex items-center justify-center mx-auto mb-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0a8a84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-[26px] font-semibold text-navy mb-3">ส่งคำขอสำเร็จ</h1>
            <p className="text-[14px] text-[#666] leading-[1.7] mb-7">
              เราได้รับคำขอใบเสนอราคาของคุณแล้ว<br />
              ทีมงานจะติดต่อกลับทางอีเมลภายใน 1–2 วันทำการ<br />
              <span className="text-[13px] text-[#aaa]">หากไม่พบอีเมลตอบกลับจากเรา รบกวนตรวจสอบใน Junk Mail</span>
            </p>
            <Link
              href="/"
              className="px-5 py-2.5 bg-navy text-white rounded-[7px] text-[14px] font-medium no-underline hover:bg-mint transition-colors inline-block"
            >
              กลับหน้าแรก
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      {showNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-2xl p-7 max-w-[420px] w-full shadow-lg">
            <div className="w-12 h-12 rounded-full bg-mint-light flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0a8a84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-[18px] font-semibold text-navy mb-2">ส่งคำขอสำเร็จ</h2>
            <p className="text-[14px] text-[#555] leading-[1.8] mb-6">
              โดยปกติ จะจัดส่งใบเสนอราคากลับไปภายใน 1–2 วันทำการ
              <br /><br />
              อีเมลที่แนบใบเสนอราคากลับไปอาจตกหล่นอยู่ใน Junk Mail ได้ หากไม่พบอีเมลตอบกลับจากเรา รบกวนตรวจสอบใน Junk Mail นะครับ
            </p>
            <button
              onClick={() => setShowNote(false)}
              className="w-full py-3 bg-navy text-white rounded-[9px] text-[14px] font-medium border-none cursor-pointer hover:bg-mint transition-colors"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}

      <Nav />
      <div className="bg-bg min-h-[calc(100vh-56px)]">
        <div className="max-w-[680px] mx-auto px-8 py-12">
          <div className="mb-8">
            <h1 className="text-[28px] font-semibold text-navy mb-1">ขอใบเสนอราคา</h1>
            <p className="text-[13px] text-[#aaa]">สำหรับสิทธิการใช้งานองค์กรและสิทธิพิเศษ</p>
          </div>

          {/* Discount Info */}
          <div className="bg-white border border-[0.5px] border-border rounded-xl p-6 mb-5">
            <h2 className="text-[14px] font-semibold text-navy mb-3">เงื่อนไขส่วนลด</h2>
            <div className="flex flex-col gap-2">
              {[
                { threshold: "25,000", discount: "5%" },
                { threshold: "50,000", discount: "10%" },
                { threshold: "75,000", discount: "15%" },
              ].map(({ threshold, discount }) => (
                <div key={threshold} className="flex items-center gap-3">
                  <span className="inline-block min-w-[42px] text-center text-[11px] font-semibold text-[#0a8a84] bg-mint-light border border-[0.5px] border-mint-mid rounded-full px-2.5 py-0.5">
                    {discount}
                  </span>
                  <span className="text-[13px] text-[#555]">
                    เมื่อยอดสั่งซื้อตั้งแต่ <span className="font-medium text-navy">฿{threshold}</span> ขึ้นไป
                  </span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-5">
            {/* Contact & Company */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-6 flex flex-col gap-4">
              <h2 className="text-[14px] font-semibold text-navy">ข้อมูลผู้ติดต่อ</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ชื่อผู้ติดต่อ">
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => set("contact_name", e.target.value)}
                    placeholder="ชื่อ-นามสกุล"
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label="อีเมล">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="example@company.com"
                    className={inputCls}
                    required
                  />
                </Field>
              </div>

              <Field label="ชื่อห้างร้าน / องค์กร / บริษัท">
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => set("company_name", e.target.value)}
                  placeholder="ชื่อองค์กร"
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="ที่อยู่">
                <textarea
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="ที่อยู่สำหรับออกเอกสาร"
                  rows={3}
                  className={inputCls + " resize-none"}
                  required
                />
              </Field>

              <Field label="หมายเลขประจำตัวผู้เสียภาษี">
                <input
                  type="text"
                  value={form.tax_id}
                  onChange={(e) => set("tax_id", e.target.value)}
                  placeholder="0000000000000"
                  className={inputCls}
                  maxLength={13}
                  required
                />
              </Field>
            </div>

            {/* License Type */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-6 flex flex-col gap-3">
              <h2 className="text-[14px] font-semibold text-navy">
                รูปแบบสิทธิการใช้งานที่ต้องการ <span className="text-[#e74c3c]">*</span>
              </h2>
              {LICENSE_TYPES.map((lt) => (
                <label
                  key={lt.value}
                  className={`flex items-start gap-3 p-3.5 rounded-[9px] border border-[0.5px] cursor-pointer transition-colors ${
                    form.license_type === lt.value
                      ? "border-mint bg-mint-light"
                      : "border-border hover:border-[#bbb]"
                  }`}
                >
                  <input
                    type="radio"
                    name="license_type"
                    value={lt.value}
                    checked={form.license_type === lt.value}
                    onChange={() => set("license_type", lt.value)}
                    className="mt-0.5 accent-[#0a8a84]"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-navy">{lt.label}</div>
                    <div className="text-[12px] text-[#888] mt-0.5">{lt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Font Selection */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-6 flex flex-col gap-3">
              <h2 className="text-[14px] font-semibold text-navy">
                โปรแกรมคอมพิวเตอร์ฟอนต์ที่ต้องการสั่งซื้อ <span className="text-[#e74c3c]">*</span>
              </h2>

              <div className="flex flex-col gap-2">
                {selectedFonts.map((val, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={val}
                      onChange={(e) => setFont(idx, e.target.value)}
                      className={inputCls + " flex-1"}
                    >
                      <option value="">— เลือกฟอนต์ —</option>
                      {fonts.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    {selectedFonts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFont(idx)}
                        className="w-8 h-8 flex items-center justify-center rounded-[6px] border border-[0.5px] border-[#ddd] text-[#bbb] hover:border-[#e74c3c] hover:text-[#e74c3c] transition-colors bg-white cursor-pointer shrink-0"
                        aria-label="ลบ"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addFont}
                className="self-start flex items-center gap-1.5 text-[13px] text-[#0a8a84] cursor-pointer border-none bg-transparent p-0 hover:opacity-70 transition-opacity"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                เพิ่มฟอนต์
              </button>
            </div>

            {/* Note */}
            <div className="bg-white border border-[0.5px] border-border rounded-xl p-6">
              <Field label="หมายเหตุเพิ่มเติม">
                <textarea
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม เช่น จำนวนเครื่อง ประเภทงาน ฯลฯ"
                  rows={3}
                  className={inputCls + " resize-none"}
                />
              </Field>
            </div>

            {errorMsg && (
              <p className="text-[13px] text-[#e74c3c]">{errorMsg}</p>
            )}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={status === "loading"}
                className="px-6 py-3 bg-navy text-white rounded-[8px] text-[14px] font-medium border-none cursor-pointer hover:bg-mint transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "กำลังส่ง..." : "ส่งคำขอใบเสนอราคา"}
              </button>
              <Link href="/" className="text-[13px] text-[#aaa] no-underline hover:text-navy transition-colors">
                ยกเลิก
              </Link>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 border border-[0.5px] border-[#ddd] rounded-[8px] text-[14px] text-navy outline-none focus:border-mint transition-colors bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#555]">
        {label} <span className="text-[#e74c3c]">*</span>
      </label>
      {children}
    </div>
  );
}
