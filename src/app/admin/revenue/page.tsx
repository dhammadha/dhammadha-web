"use client";

export default function AdminRevenuePage() {
  return (
    <div className="p-6 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-navy">รายได้</h1>
        <p className="text-[13px] text-[#aaa] mt-0.5">สรุปยอดขายและรายได้</p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center gap-3">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-[#ddd]">
          <path d="M5 30l8-10 8 6 8-14 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5 35h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <div className="text-[15px] font-medium text-navy">กำลังพัฒนา</div>
        <div className="text-[13px] text-[#aaa] max-w-[380px] leading-relaxed">
          หน้านี้จะแสดงสรุปยอดขายรายเดือน รายไตรมาส รายปี จำนวนออเดอร์ และรายได้แบ่งปันนักออกแบบ
          โดยดึงข้อมูลจากใบเสร็จที่ออกในระบบ
        </div>
      </div>
    </div>
  );
}
