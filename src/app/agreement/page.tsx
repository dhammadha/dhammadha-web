import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function AgreementPage() {
  return (
    <>
      <Nav />
      <div className="bg-bg min-h-screen">
        <div className="max-w-[720px] mx-auto px-8 py-12">
          <h1 className="text-[28px] font-semibold text-navy mb-1">สัญญาอนุญาต</h1>
          <p className="text-[13px] text-[#aaa] mb-1">ข้อกำหนดและเงื่อนไขของสัญญาอนุญาต</p>
          <p className="text-[13px] text-[#aaa] mb-8">DHAMMADHA STUDIO Desktop Font Licensing</p>

          <div className="bg-white border border-[0.5px] border-border rounded-xl p-7 flex flex-col gap-6 text-[14px] leading-[1.8] text-[#444]">

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 1 — ผู้ได้รับอนุญาต</h2>
              <p className="mb-3">อนุญาตให้ใช้งานเฉพาะผู้ได้รับอนุญาตตามรายชื่อที่ปรากฏในใบสั่งซื้อ</p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-[14px] text-[#555]">
                <li>สิทธิการใช้งานส่วนบุคคล สามารถใช้งานได้เพียงคนเดียว</li>
                <li>สิทธิการใช้งานสำหรับห้างร้าน องค์กร บริษัท จำกัดจำนวนเครื่องใช้งานตามเอกสารการสั่งซื้อ</li>
              </ul>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 2 — สิทธิการใช้งานที่อนุญาต</h2>
              <p className="mb-3">
                อนุญาตให้ใช้ผลิตสื่อประชาสัมพันธ์ทุกประเภท ทั้งที่ใช้ในเชิงพาณิชย์ และไม่ใช้ในเชิงพาณิชย์
                ซึ่งจัดทำโดยผู้ได้รับอนุญาตเท่านั้น
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-[14px] text-[#555] mb-4">
                <li>สิ่งพิมพ์ทุกประเภท (โปสเตอร์ แผ่นพับ บรรจุภัณฑ์ ฯลฯ)</li>
                <li>สื่อดิจิทัลคงที่ (แบนเนอร์ รูปภาพ กราฟิก)</li>
                <li>งานออกแบบกราฟิกทั่วไป</li>
              </ul>
              <p className="text-[13px] text-[#888]">
                สำหรับ Demo / Free Font กรุณาศึกษาเงื่อนไขการใช้งานตามรายละเอียดที่แนบไปกับไฟล์ฟอนต์
              </p>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 3 — การใช้งานที่ต้องการสิทธิการใช้งานเพิ่มเติม</h2>
              <p className="mb-3">
                การใช้งานในรูปแบบต่อไปนี้จำเป็นต้องซื้อสิทธิการใช้งานเพิ่มเติม กรุณาติดต่อเพื่อขอใบเสนอราคา
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1 text-[14px] text-[#555]">
                <li>Identity Font / โลโก้ / ตราสัญลักษณ์องค์กร</li>
                <li>สื่อโทรทัศน์ / ภาพยนตร์ / TVC</li>
                <li>YouTube / วิดีโอออนไลน์ / สตรีมมิ่ง</li>
                <li>Mobile Application</li>
                <li>Web Font</li>
                <li>แอปพลิเคชันบน Server / Network</li>
              </ul>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 4 — ข้อห้าม</h2>
              <ul className="list-disc pl-5 flex flex-col gap-2 text-[14px] text-[#555]">
                <li>ไม่อนุญาตให้ทำซ้ำ ดัดแปลง แปล แก้ไข ชื่อ เลข รหัส หรือเรียบเรียงใหม่ ซึ่งโปรแกรมคอมพิวเตอร์ฟอนต์นี้ โดยเด็ดขาด</li>
                <li>ไม่อนุญาตให้เผยแพร่ แจกจ่าย จำหน่าย ให้เช่า โปรแกรมคอมพิวเตอร์ฟอนต์นี้หรือสิทธิใด ๆ ที่ให้ไว้ตามสัญญาอนุญาตนี้ แก่บุคคล หรือองค์กรอื่นโดยเด็ดขาด</li>
                <li>ผู้ได้รับอนุญาตจะต้องรับรองว่าจะไม่ ลบ ทำลาย ทำให้เสียหาย หรือทำให้ไม่ชัดเจน ซึ่งเครื่องหมายหรือสัญลักษณ์แสดงความเป็นเจ้าของสิทธิ์ หรือเครื่องหมายการค้าของผู้อนุญาต ทั้งโดยจงใจ หรือประมาทเลินเล่อ</li>
              </ul>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 5 — ลิขสิทธิ์</h2>
              <p>
                ผู้อนุญาตขอรับรองและยืนยันว่า ผู้อนุญาตมีสิทธิโดยสมบูรณ์ และปราศจากภาระผูกพันใด ๆ
                อันจะทำให้เสื่อมสิทธิในโปรแกรมคอมพิวเตอร์ฟอนต์นี้ หรือสิ่งอื่นใดที่เกี่ยวข้องกับโปรแกรมคอมพิวเตอร์ฟอนต์ตามสัญญาอนุญาตนี้
                และผู้อนุญาตมีอำนาจในการอนุญาตให้ผู้รับอนุญาตใช้โปรแกรมคอมพิวเตอร์ฟอนต์ได้ โดยชอบด้วยกฎหมาย
              </p>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 6 — ข้อจำกัดความรับผิด</h2>
              <p>
                ผู้อนุญาตนำเสนอโปรแกรมคอมพิวเตอร์ฟอนต์ตามสภาพที่เป็นอยู่ ผู้อนุญาตจะไม่รับผิดชอบต่อค่าใช้จ่าย
                และค่าเสียหายใด ๆ ที่เกิดขึ้นแก่ผู้ได้รับอนุญาต อันเกิดจากการดาวน์โหลด ติดตั้ง
                หรือใช้งานโปรแกรมคอมพิวเตอร์ฟอนต์นี้
              </p>
            </section>

            <div className="h-[0.5px] bg-border" />

            <section>
              <h2 className="text-[15px] font-semibold text-navy mb-2">ข้อ 7 — การสิ้นสุดสัญญา</h2>
              <p>
                สัญญาอนุญาตนี้จะสิ้นสุดโดยอัตโนมัติหากผู้รับอนุญาตละเมิดข้อกำหนดใดข้อกำหนดหนึ่ง
                และผู้รับอนุญาตต้องลบไฟล์ฟอนต์ออกจากอุปกรณ์ทุกเครื่องทันที
              </p>
            </section>

          </div>

          <div className="mt-6 text-[13px] text-[#aaa] leading-[1.5]">
            <p className="mb-2">หมายเหตุ:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>การจำแนกประเภทผู้ซื้อ ขึ้นอยู่กับดุลยพินิจของผู้ขาย</li>
              <li>สงวนสิทธิ์ในการเปลี่ยนแปลงราคาและเงื่อนไข โดยมิต้องแจ้งให้ทราบล่วงหน้า และขอสงวนสิทธิ์ไม่รับเปลี่ยนสินค้าหรือคืนเงินทุกกรณี</li>
              <li>รายละเอียดราคาที่แจ้งไว้เป็นยอดสุทธิ ไม่รวมค่าธรรมเนียมในการโอน หรือค่าธรรมเนียมการเปลี่ยนแปลงสกุลเงิน (ถ้ามี)</li>
              <li>รายละเอียดราคาที่แจ้งไว้ สำหรับองค์กร บริษัท สัญชาติไทย เท่านั้น</li>
              <li>สัญญาอนุญาต ให้ยึดถือประกาศบนเวบไซต์ที่ปรับปรุงรายละเอียดล่าสุดเป็นสำคัญ</li>
            </ul>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}
