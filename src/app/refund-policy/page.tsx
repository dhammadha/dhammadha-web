import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection, EFFECTIVE_DATE } from "@/components/LegalPage";
import { NAME as BRAND_NAME, CONTACT_EMAIL, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("นโยบายการคืนเงิน"),
  description: `นโยบายการคืนเงินสำหรับสินค้าดิจิทัลของ ${BRAND_NAME}`,
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="นโยบายการคืนเงิน"
      subtitle="Refund Policy"
      effectiveDate={EFFECTIVE_DATE}
    >
      <LegalSection title="1. หลักการทั่วไป">
        <p>
          ฟอนต์เป็นสินค้าดิจิทัลที่ส่งมอบทันทีและไม่สามารถ "คืนสินค้า" ได้เหมือนสินค้าทั่วไป{" "}
          ดังนั้น <strong>โดยหลักเราไม่คืนเงินหลังจากมีการดาวน์โหลดไฟล์แล้ว</strong>{" "}
          กรุณาทดลองฟอนต์ผ่านหน้าทดสอบบนเว็บไซต์ และไฟล์ Demo ฟรี ก่อนตัดสินใจซื้อทุกครั้ง
        </p>
      </LegalSection>

      <LegalSection title="2. กรณีที่คืนเงินหรือแก้ไขให้">
        <p>
          (1) <strong>ไฟล์เสียหรือใช้งานไม่ได้</strong> — เราจะส่งไฟล์ใหม่ให้ก่อน หากยังแก้ไขไม่ได้จะคืนเงินเต็มจำนวน<br />
          (2) <strong>ชำระซ้ำซ้อน</strong> — คืนเงินส่วนที่ชำระเกินเต็มจำนวน<br />
          (3) <strong>ยังไม่ได้ดาวน์โหลดไฟล์</strong> — แจ้งภายใน 7 วันหลังชำระเงิน พิจารณาคืนเงินเป็นรายกรณี
        </p>
      </LegalSection>

      <LegalSection title="3. วิธีแจ้งขอคืนเงิน">
        <p>
          ส่งอีเมลมาที่ <a href={`mailto:${CONTACT_EMAIL}`} className="text-mint-text">{CONTACT_EMAIL}</a>{" "}
          พร้อมหลักฐานการชำระเงินและรายละเอียดปัญหา ภายใน 7 วัน นับจากวันชำระเงิน
          เราจะตอบกลับภายใน 3 วันทำการ และหากอนุมัติ จะคืนเงินผ่านช่องทางเดิมภายใน 14 วัน
        </p>
      </LegalSection>

      <LegalSection title="4. ฟอนต์ของนักออกแบบรายอื่น">
        <p>
          กรณีซื้อผ่านใบเสนอราคาที่ชำระเงินตรงกับนักออกแบบ การคืนเงินเป็นข้อตกลงระหว่างคุณกับนักออกแบบรายนั้น
          โดยเรายินดีช่วยประสานงานให้ ดูเพิ่มเติม :{" "}
          <Link href="/terms/" className="text-mint-text">ข้อกำหนดการใช้งาน</Link>
        </p>
      </LegalSection>

      <LegalSection title="5. ลำดับความสำคัญของเอกสาร">
        <p>
          นโยบายฉบับนี้เป็นเงื่อนไขการคืนเงินที่มีผลบังคับ
          หากมีข้อความในเอกสารอื่นของเว็บไซต์ขัดหรือแย้งกับนโยบายฉบับนี้
          ให้ยึดถือนโยบายฉบับนี้เป็นสำคัญ
        </p>
      </LegalSection>
    </LegalPage>
  );
}
