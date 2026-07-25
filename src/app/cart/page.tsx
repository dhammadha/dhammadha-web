import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import CartView from "@/components/cart/CartView";

/**
 * /cart — ตะกร้าจริง (หลายฟอนต์ต่อการจ่าย 1 ครั้ง)
 *
 * รายการในตะกร้าเก็บที่ localStorage ผ่าน CartContext (เก็บแค่ font_id)
 * ราคา/ส่วนแบ่งคิดใหม่ฝั่ง server ที่ handleCheckoutRequest เสมอ →
 * 1 คำสั่งซื้อมีหลายรายการใน order_items (migration 0069)
 */

export const metadata: Metadata = {
  title: "ตะกร้า — DHAMMADHA STUDIO",
};

export default function CartPage() {
  return (
    <>
      <Nav />
      <Container className="py-12 md:py-16">
        <h1 className="font-heading text-h1 text-black text-center mb-8">ตะกร้า</h1>
        <CartView />
      </Container>
      <Footer />
    </>
  );
}
