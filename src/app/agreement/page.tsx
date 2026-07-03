import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function AgreementPage() {
  return (
    <>
      <Nav />
      <div className="bg-bg min-h-screen">
        <div className="max-w-[720px] mx-auto px-8 py-12">
          <h1 className="text-[28px] font-semibold text-navy mb-1">สัญญาอนุญาต</h1>
          <p className="text-[13px] text-[#aaa] mb-8">DHAMMADHA STUDIO Font License Agreement</p>

          <div className="bg-white border border-[0.5px] border-border rounded-xl p-7 flex flex-col gap-6 text-[14px] leading-[1.8] text-[#444]">

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 1 — ผู้ได้รับอนุญาต</h2>
              <p>
                อนุญาตให้ใช้งานเฉพาะผู้ได้รับอนุญาตตามรายชื่อที่ปรากฏในใบสั่งซื้อ สำหรับผู้ใช้งานบุคคลทั่วไปไม่จำกัดจำนวนเครื่อง
                สำหรับองค์กรและบริษัท จำกัดตามจำนวนเครื่องที่ระบุในใบสั่งซื้อ
              </p>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 2 — สิทธิการใช้งานที่อนุญาต</h2>
              <p className="mb-3">
                อนุญาตให้ใช้งานผลิตสื่อประชาสัมพันธ์ทุกประเภท ทั้งเชิงพาณิชย์และไม่ใช่เชิงพาณิชย์
                โดยผู้รับอนุญาต เช่น ภาพนิ่ง โปสเตอร์ แบนเนอร์ สิ่งพิมพ์ และสื่อโฆษณา
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-[13px] text-[#555]">
                <li>สิ่งพิมพ์ทุกประเภท (โปสเตอร์ แผ่นพับ บรรจุภัณฑ์ ฯลฯ)</li>
                <li>สื่อดิจิทัลคงที่ (แบนเนอร์ รูปภาพ กราฟิก)</li>
                <li>งานออกแบบกราฟิกทั่วไป</li>
              </ul>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 3 — การใช้งานที่ต้องขออนุญาตเพิ่มเติม</h2>
              <p className="mb-3">การใช้งานในรูปแบบต่อไปนี้จำเป็นต้องซื้อสิทธิ์เพิ่มเติม กรุณาติดต่อเพื่อขอใบเสนอราคา</p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-[13px] text-[#555]">
                <li>Identity Font / โลโก้ / ตราสัญลักษณ์องค์กร</li>
                <li>สื่อโทรทัศน์ / ภาพยนตร์ / TVC</li>
                <li>YouTube / วิดีโอออนไลน์ / สตรีมมิ่ง</li>
                <li>Mobile Application</li>
                <li>Web Font (ฝังบนเว็บไซต์)</li>
                <li>แอปพลิเคชันบน Server / Network</li>
              </ul>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 4 — ข้อห้าม</h2>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-[13px] text-[#555]">
                <li>ห้ามทำซ้ำ ดัดแปลง แปล แก้ไข หรือเรียบเรียงโปรแกรมฟอนต์ใหม่</li>
                <li>ห้ามเผยแพร่ แจกจ่าย จำหน่าย หรือให้เช่าไฟล์ฟอนต์แก่บุคคลอื่น</li>
                <li>ห้ามนำไฟล์ฟอนต์ไปแสดงในที่สาธารณะในรูปแบบที่ดาวน์โหลดได้</li>
                <li>ห้ามลบหรือแก้ไขข้อมูลลิขสิทธิ์ที่ฝังอยู่ในไฟล์ฟอนต์</li>
              </ul>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 5 — ลิขสิทธิ์</h2>
              <p>
                ฟอนต์คอมพิวเตอร์ทุกชุดเป็นทรัพย์สินทางปัญญาของ DHAMMADHA STUDIO สงวนสิทธิ์ทุกประการ
                การซื้อสิทธิ์การใช้งานมิได้หมายความว่าเป็นการโอนกรรมสิทธิ์ในไฟล์ฟอนต์
              </p>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 6 — การสิ้นสุดสัญญา</h2>
              <p>
                สัญญาอนุญาตนี้จะสิ้นสุดโดยอัตโนมัติหากผู้รับอนุญาตละเมิดข้อกำหนดใดข้อกำหนดหนึ่ง
                และผู้รับอนุญาตต้องลบไฟล์ฟอนต์ออกจากอุปกรณ์ทุกเครื่องทันที
              </p>
            </section>

            <div className="bg-[#fffbea] border border-[0.5px] border-[#e8d87a] rounded-[8px] px-4 py-3 text-[12px] text-[#7a6200]">
              เงื่อนไขอาจมีการเปลี่ยนแปลงโดยไม่ต้องแจ้งล่วงหน้า · สงวนสิทธิ์ในการปฏิเสธการคืนเงินทุกกรณี
            </div>
          </div>

          <p className="text-[12px] text-[#bbb] text-center mt-6">
            © 2012–2026 DHAMMADHA STUDIO · มีคำถาม?{" "}
            <a href="mailto:dhammadha@outlook.com" className="text-mint no-underline">ติดต่อเรา</a>
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
