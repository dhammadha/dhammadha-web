import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import RevenueShareChart from "@/components/become/RevenueShareChart";

export const metadata: Metadata = {
  title: "ร่วมเป็นนักออกแบบ — ขายฟอนต์กับ DHAMMADHA STUDIO",
  description:
    "วางจำหน่ายฟอนต์ของคุณบนแพลตฟอร์มตลาดฟอนต์ไทย รับส่วนแบ่ง 75% พร้อมระบบใบเสนอราคาฟรี และหน้าร้านของตัวเอง",
};

const BENEFITS = [
  {
    title: "ส่วนแบ่ง 75%",
    desc: "ทุกยอดขายผ่านเว็บ คุณได้รับ 75% — สูงกว่ามาร์เก็ตเพลสทั่วไปที่หัก 30–50% และเราเป็นฝ่ายรับภาระค่าธรรมเนียมการชำระเงินเอง",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: "ระบบใบเสนอราคาฟรี",
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
  {
    title: "ทุกไฟล์ตรวจสอบย้อนกลับได้",
    desc: "ไฟล์ที่ลูกค้าดาวน์โหลดถูกประทับชื่อผู้ซื้อ เลขที่คำสั่งซื้อ และวันที่ ลงใน license metadata ของไฟล์ฟอนต์โดยอัตโนมัติ — หากไฟล์หลุดสู่สาธารณะ ตรวจย้อนถึงต้นทางได้ทันที และช่วยป้องปรามการแชร์ไฟล์ตั้งแต่แรก",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
];

const STEPS = [
  { n: "1", title: "สมัครและส่งผลงาน", desc: "สมัครสมาชิก เลือก \"สมัครเป็น Designer\" พร้อมแนบลิงก์ผลงาน เช่น Behance, Instagram หรือเว็บไซต์" },
  { n: "2", title: "ทีมงานตรวจสอบ", desc: "เราตรวจสอบผลงานและติดต่อกลับทางอีเมลภายใน 3–5 วันทำการ" },
  { n: "3", title: "ตั้งค่าร้านและอัปโหลด", desc: "ตั้งชื่อร้าน ข้อมูลผู้ขาย ราคา และ license แล้วอัปโหลดฟอนต์ของคุณ" },
  { n: "4", title: "เริ่มขาย", desc: "ทีมงานตรวจคุณภาพและเผยแพร่ ฟอนต์ของคุณขึ้นหน้าเว็บพร้อมขายทันที" },
];

export default function BecomeADesignerPage() {
  return (
    <>
      <Nav />

      {/* HERO */}
      <section className="bg-white">
        <Container className="pt-10 pb-6">
          <p className="font-body text-body-sm text-mint-text mb-3">สำหรับนักออกแบบฟอนต์</p>
          <h1 className="font-heading text-hero text-black mb-3.5">
            ขายฟอนต์ของคุณ<br />ได้ส่วนแบ่ง <em className="text-mint-text not-italic">75%*</em> สูงกว่าทุกที่
          </h1>
          <p className="font-body text-body text-grey-600 max-w-[720px] mb-6">
            เราคือแพลตฟอร์มตลาดฟอนต์ไทยที่สร้างโดยนักออกแบบฟอนต์<br />
            เราจัดการเรื่องเว็บ ระบบป้องกันไฟล์ เอกสาร และลูกค้าองค์กรให้ — คุณโฟกัสแค่การออกแบบ
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <Button as="link" href="/auth/signup" size="lg">สมัครเป็น Designer</Button>
            <Link
              href="/designer-agreement/"
              className="font-body text-body-sm text-grey-600 no-underline hover:text-black transition-colors duration-150 ease-base"
            >
              อ่านข้อตกลงสำหรับนักออกแบบ →
            </Link>
          </div>
        </Container>
      </section>

      {/* ส่วนแบ่งรายได้ — พระเอกของหน้า */}
      <section className="bg-white">
        <Container className="pt-6 pb-10">
          <h2 className="font-heading text-h1 text-black mb-3">ส่วนแบ่งรายได้</h2>
          <p className="font-body text-body text-grey-600 max-w-[720px] mb-7">
            เราเปิดตัวเลขทุกส่วนให้ดูก่อนตัดสินใจ เลือกโมเดลรายได้ที่สนใจ เพื่อดูวิธีคำนวณส่วนแบ่งของคุณ
          </p>
          <RevenueShareChart />
        </Container>
      </section>

      {/* BENEFITS */}
      <section className="bg-white">
        <Container className="py-10">
          <h2 className="font-heading text-h1 text-black mb-6">ทำไมต้องขายกับเรา</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-surface p-5 flex flex-col">
                <div className="text-mint-text mb-4">{b.icon}</div>
                <h3 className="font-heading text-h2 text-black mb-2">{b.title}</h3>
                <p className="font-body text-body-sm text-grey-600 leading-[1.8]">{b.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white">
        <Container className="py-10">
          <h2 className="font-heading text-h1 text-black mb-6">เริ่มต้นอย่างไร</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="font-heading text-h1 text-mint-text leading-none mb-3">{s.n}</div>
                <h3 className="font-heading text-h2 text-black mb-1.5">{s.title}</h3>
                <p className="font-body text-body-sm text-grey-600 leading-[1.8]">{s.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <Container className="pb-12">
          <div className="bg-black px-6 py-14 md:px-12 md:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="font-heading text-h1 text-white mb-2.5">พร้อมวางขายฟอนต์แรกของคุณหรือยัง?</h2>
              <p className="font-body text-body-sm text-grey-400 leading-[1.8] max-w-[480px]">
                ไม่มีค่าแรกเข้า ไม่มีค่ารายเดือน — มีผลงานฟอนต์ไทยของตัวเอง ก็เริ่มได้เลยวันนี้<br />
                ทำฟอนต์ฟรีเป็นงานอดิเรกก็ร่วมเผยแพร่ผลงานกับเราได้เช่นกัน
              </p>
            </div>
            <Button as="link" href="/auth/signup" size="lg" className="shrink-0">
              สมัครเป็น Designer
            </Button>
          </div>
        </Container>
      </section>

      <Footer />
    </>
  );
}
