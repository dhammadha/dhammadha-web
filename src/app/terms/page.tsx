import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection, EFFECTIVE_DATE } from "@/components/LegalPage";
import { DOMAIN, CONTACT_EMAIL, LEGAL_ENTITY, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("ข้อกำหนดการใช้งาน"),
  description: `ข้อกำหนดและเงื่อนไขการใช้งานเว็บไซต์ ${DOMAIN}`,
};

export default function TermsPage() {
  return (
    <LegalPage
      title="ข้อกำหนดการใช้งาน"
      subtitle="Terms of Service"
      effectiveDate={EFFECTIVE_DATE}
    >
      <LegalSection title="1. ทั่วไป">
        <p>
          เว็บไซต์ {DOMAIN} ดำเนินการโดย <strong>{LEGAL_ENTITY}</strong> การใช้งานเว็บไซต์ถือว่าคุณยอมรับข้อกำหนดฉบับนี้ หากไม่เห็นด้วย กรุณายุติการใช้งาน ติดต่อ :{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-mint-text">{CONTACT_EMAIL}</a>
        </p>
      </LegalSection>

      <LegalSection title="2. บัญชีผู้ใช้">
        <p>
          คุณต้องให้ข้อมูลที่ถูกต้องในการสมัครสมาชิก และรับผิดชอบการกระทำทั้งหมดที่เกิดขึ้นผ่านบัญชีของคุณ
          เราขอสงวนสิทธิ์ระงับบัญชีที่ละเมิดข้อกำหนดหรือใช้งานในทางที่ผิด
        </p>
      </LegalSection>

      <LegalSection title="3. ทรัพย์สินทางปัญญา">
        <p>
          ฟอนต์ทุกชุดบนเว็บไซต์เป็นลิขสิทธิ์ของนักออกแบบเจ้าของผลงานหรือของ{LEGAL_ENTITY}
          การซื้อฟอนต์เป็นการได้รับ <strong>สิทธิ์การใช้งาน (license)</strong> ตามขอบเขตที่ระบุใน{" "}
          <Link href="/agreement/" className="text-mint-text">สัญญาอนุญาตใช้งานฟอนต์</Link> ไม่ใช่การซื้อขาดลิขสิทธิ์
        </p>
        <p>
          ห้ามแจกจ่าย แชร์ ขายต่อ หรือดัดแปลงไฟล์ฟอนต์เพื่อเผยแพร่ต่อโดยไม่ได้รับอนุญาต
          รายละเอียดขอบเขตสิทธิ์ ข้อห้าม และเงื่อนไขของไฟล์ทดลอง (Demo) และฟอนต์แจกฟรี
          ให้เป็นไปตาม{" "}
          <Link href="/agreement/" className="text-mint-text">สัญญาอนุญาตใช้งานฟอนต์</Link>
        </p>
      </LegalSection>

      <LegalSection title="4. การสั่งซื้อและใบเสนอราคา">
        <p>
          ราคาบนเว็บไซต์อาจเปลี่ยนแปลงได้โดยไม่ต้องแจ้งล่วงหน้า
          การสั่งซื้อฟอนต์รายชุดผ่านระบบชำระเงินของเว็บไซต์ เป็นธุรกรรมระหว่างคุณกับ{" "}
          {LEGAL_ENTITY} ซึ่งได้รับสิทธิให้อนุญาตช่วงจากนักออกแบบเจ้าของผลงาน
        </p>
        <p>
          ส่วนคำขอใบเสนอราคาสำหรับสิทธิ์การใช้งานองค์กร
          ระบบจะส่งคำขอของคุณถึงนักออกแบบเจ้าของฟอนต์โดยตรง การเจรจา การชำระเงิน
          และการออกเอกสารในส่วนนั้น เป็นธุรกรรมระหว่างคุณกับนักออกแบบรายนั้น
        </p>
      </LegalSection>

      <LegalSection title="5. ข้อจำกัดความรับผิด">
        <p>
          เราให้บริการเว็บไซต์ตามสภาพ ("as is") และพยายามอย่างเต็มที่ให้ระบบทำงานต่อเนื่อง
          แต่ไม่รับประกันว่าจะปราศจากข้อผิดพลาดหรือการหยุดชะงัก ความรับผิดของเราจำกัดไม่เกินจำนวนเงินที่คุณชำระสำหรับสินค้าหรือบริการนั้น ๆ
        </p>
      </LegalSection>

      <LegalSection title="6. กฎหมายที่ใช้บังคับ">
        <p>
          ข้อกำหนดฉบับนี้อยู่ภายใต้กฎหมายแห่งราชอาณาจักรไทย
          ดูเพิ่มเติม : <Link href="/privacy/" className="text-mint-text">นโยบายความเป็นส่วนตัว</Link>{" "}
          และ <Link href="/refund-policy/" className="text-mint-text">นโยบายการคืนเงิน</Link>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
