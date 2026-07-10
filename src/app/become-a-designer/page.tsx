import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Button from "@/components/Button";

export const metadata: Metadata = {
  title: "ร่วมเป็นนักออกแบบ — ขายฟอนต์กับ DHAMMADHA STUDIO",
  description:
    "วางจำหน่ายฟอนต์ของคุณบนแพลตฟอร์มตลาดฟอนต์ไทย รับส่วนแบ่ง 75% พร้อมระบบใบเสนอราคา B2B และหน้าร้านของตัวเองฟรี",
};

const BENEFITS = [
  {
    title: "ส่วนแบ่ง 75%",
    desc: "ทุกยอดขายผ่านเว็บ คุณได้ 75% เต็ม ๆ — สูงกว่ามาร์เก็ตเพลสทั่วไปที่หัก 30–50% และเราเป็นฝ่ายรับภาระค่าธรรมเนียมการชำระเงินเอง",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: "ระบบใบเสนอราคา B2B ฟรี",
    desc: "ลูกค้าองค์กรขอใบเสนอราคาจากหน้าฟอนต์ของคุณได้โดยตรง เงินเข้าบัญชีคุณเต็มจำนวน เราไม่หักส่วนแบ่ง — เหมือนมีระบบหลังบ้านมืออาชีพโดยไม่ต้องสร้างเอง",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    title: "หน้าร้านของคุณเอง",
    desc: "มีหน้าโปรไฟล์และ dashboard ส่วนตัว จัดการฟอนต์ ตั้งราคา กำหนด license เอง พร้อมระบบป้องกันไฟล์ฟอนต์และหน้าทดสอบฟอนต์ให้อัตโนมัติ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

const STEPS = [
  { n: "1", title: "สมัครและส่งผลงาน", desc: "สมัครสมาชิก ติ๊ก \"สมัครเป็น Designer\" พร้อมแนบลิงก์ผลงาน เช่น Behance, Instagram หรือเว็บไซต์" },
  { n: "2", title: "ทีมงานตรวจสอบ", desc: "เราตรวจสอบผลงานและติดต่อกลับทางอีเมลภายใน 3–5 วันทำการ" },
  { n: "3", title: "ตั้งค่าร้านและอัปโหลด", desc: "ตั้งชื่อร้าน ข้อมูลผู้ขาย ราคาและ license แล้วอัปโหลดฟอนต์ของคุณ" },
  { n: "4", title: "เริ่มขาย", desc: "ทีมงานตรวจคุณภาพและเผยแพร่ ฟอนต์ของคุณขึ้นหน้าเว็บพร้อมขายทันที" },
];

export default function BecomeADesignerPage() {
  return (
    <>
      <Nav />

      {/* HERO */}
      <section className="bg-white">
        <div className="max-w-site mx-auto px-8 pt-14 pb-12">
          <p className="text-[13px] font-semibold tracking-[0.08em] uppercase text-mint mb-3">สำหรับนักออกแบบฟอนต์</p>
          <h1 className="text-[42px] font-semibold text-navy leading-[1.15] tracking-[-1px] mb-4">
            ขายฟอนต์ของคุณ<br />ได้ส่วนแบ่ง <em className="text-mint not-italic">75%</em> สูงกว่าทุกที่
          </h1>
          <p className="text-[15px] text-[#666] leading-[1.7] max-w-[520px] mb-7">
            DHAMMADHA คือแพลตฟอร์มตลาดฟอนต์ไทยที่สร้างโดยนักออกแบบฟอนต์
            เราจัดการเรื่องเว็บ ระบบป้องกันไฟล์ เอกสาร และลูกค้าองค์กรให้ — คุณโฟกัสแค่การออกแบบ
          </p>
          <div className="flex gap-2.5 items-center">
            <Button as="link" href="/auth/signup" size="lg">สมัครเป็น Designer</Button>
            <Link
              href="/designer-agreement/"
              className="text-[13px] text-[#888] no-underline hover:text-navy transition-colors"
            >
              อ่านข้อตกลงสำหรับนักออกแบบ →
            </Link>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-bg">
        <div className="max-w-site mx-auto px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-white border border-[0.5px] border-border rounded-xl p-6">
                <div className="w-11 h-11 rounded-xl bg-mint-light text-[#0a8a84] flex items-center justify-center mb-4">
                  {b.icon}
                </div>
                <h3 className="text-[17px] font-semibold text-navy mb-2">{b.title}</h3>
                <p className="text-[13px] text-[#666] leading-[1.7]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white">
        <div className="max-w-site mx-auto px-8 py-12">
          <h2 className="text-[28px] font-semibold text-navy mb-8">เริ่มต้นอย่างไร</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="text-[40px] font-semibold text-mint-mid leading-none mb-3">{s.n}</div>
                <h3 className="text-[15px] font-semibold text-navy mb-1.5">{s.title}</h3>
                <p className="text-[13px] text-[#888] leading-[1.7]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ-ish + CTA */}
      <section className="bg-bg">
        <div className="max-w-site mx-auto px-8 py-12">
          <div className="bg-navy rounded-2xl px-8 py-10 md:px-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-[24px] font-semibold text-white mb-2">พร้อมวางขายฟอนต์แรกของคุณหรือยัง?</h2>
              <p className="text-[14px] text-white/60 leading-[1.7] max-w-[460px]">
                ไม่มีค่าแรกเข้า ไม่มีค่ารายเดือน — มีผลงานฟอนต์ไทยของตัวเอง ก็เริ่มได้เลยวันนี้
                ทำฟอนต์ฟรีเป็นงานอดิเรกก็ร่วมแจกผลงานกับเราได้เช่นกัน
              </p>
            </div>
            <Button as="link" href="/auth/signup" size="lg" className="shrink-0">
              สมัครเป็น Designer
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
