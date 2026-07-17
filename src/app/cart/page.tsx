import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

/**
 * /cart — หน้าพัก ยังไม่ใช่ตะกร้าจริง
 *
 * ตะกร้าตัวจริง (หลายฟอนต์ต่อหนึ่ง checkout) เป็น **milestone แยก** เพราะเป็นงาน
 * money-path ไม่ใช่งานดีไซน์ — ต้องแก้ checkout-service, Stripe line_items,
 * และ webhook ที่ให้สิทธิ์ทีละฟอนต์ (ดู docs/design/DESIGN.md §10)
 *
 * หน้านี้มีไว้เพื่อให้ไอคอนตะกร้าใน Nav กดแล้วไม่ 404 ระหว่างที่ยังไม่มีของจริง
 * พอ milestone ตะกร้าเสร็จ ให้แทนที่เนื้อหาข้างล่างด้วยตะกร้าจริง
 */

export const metadata: Metadata = {
  title: "ตะกร้า — DHAMMADHA STUDIO",
};

export default function CartPage() {
  return (
    <>
      <Nav />
      <Container className="py-20 md:py-28 text-center">
        <h1 className="font-heading text-h1 text-black">ตะกร้า</h1>
        <p className="font-body text-body text-grey-600 mt-3">
          กำลังพัฒนา — เร็ว ๆ นี้จะเลือกซื้อหลายฟอนต์พร้อมกันได้
        </p>
        <p className="font-body text-body-sm text-grey-600 mt-1">
          ระหว่างนี้สั่งซื้อทีละฟอนต์ได้จากหน้าฟอนต์ตามปกติ
        </p>
        <div className="mt-8">
          <Button as="link" href="/fonts/" size="lg">
            ดูฟอนต์ทั้งหมด
          </Button>
        </div>
      </Container>
      <Footer />
    </>
  );
}
