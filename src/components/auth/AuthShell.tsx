import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";

/**
 * AuthShell — โครงหน้า auth ทั้ง 4 (login / signup / forgot / reset) — Phase 10
 *
 * เดิมทุกหน้าเป็นการ์ดขาว rounded-2xl ลอยกลางจอบนพื้น bg-bg — ระบบใหม่เลิกการ์ด
 * (§4.0: ช่องกรอกเป็น bg-surface จึงต้องวางบนพื้นขาว ถ้าอยู่ใน panel surface จะกลืนกัน)
 * → คอลัมน์แคบ 400px ชิดบนใต้ Nav แบบเดียวกับ contact/verify (เจ้าของยืนยัน 2026-07-20)
 * หน้าเตี้ย ๆ ไม่ต้องกังวล footer ลอย — sticky footer จัดการแล้ว (§16.7)
 */
export default function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <section className="bg-white">
        <Container className="pt-10 pb-16">
          <div className="max-w-[400px] mx-auto">
            <h1 className="font-heading text-h1 text-black mb-6">{title}</h1>
            {children}
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}
