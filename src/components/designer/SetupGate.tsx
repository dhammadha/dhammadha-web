"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";

// สถานะการตั้งค่าร้านของ designer — ใช้ทั้งการ์ด checklist บน dashboard
// และ gate กันเพิ่มฟอนต์ก่อนตั้ง slug (ไม่มี slug = ลิงก์หน้าฟอนต์ใช้ไม่ได้)

export interface DesignerSetup {
  loading: boolean;
  hasSlug: boolean;
  hasSellerInfo: boolean;
  hasBank: boolean;
  complete: boolean;
}

export function useDesignerSetup(): DesignerSetup {
  const { user } = useAuth();
  const [setup, setSetup] = useState<DesignerSetup>({
    loading: true, hasSlug: false, hasSellerInfo: false, hasBank: false, complete: false,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("designer_slug, name, address, bank")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const bank = (data?.bank as { account_number?: string } | null) ?? null;
        const hasSlug = !!data?.designer_slug;
        const hasSellerInfo = !!(data?.name && data?.address);
        const hasBank = !!bank?.account_number;
        setSetup({
          loading: false, hasSlug, hasSellerInfo, hasBank,
          complete: hasSlug && hasSellerInfo && hasBank,
        });
      });
  }, [user]);

  return setup;
}

function StepRow({ done, label, desc }: { done: boolean; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-badge font-heading shrink-0 ${
          done ? "bg-mint text-black" : "bg-white text-grey-600"
        }`}
      >
        {done ? "✓" : "•"}
      </span>
      <div>
        <div className={`font-body text-body-sm ${done ? "text-grey-600 line-through" : "text-black"}`}>{label}</div>
        {!done && <div className="font-body text-footnote text-grey-600 mt-0.5 leading-[1.6]">{desc}</div>}
      </div>
    </div>
  );
}

/** การ์ด checklist บน dashboard — ซ่อนตัวเองเมื่อตั้งค่าครบแล้ว */
export function DesignerSetupCard() {
  const setup = useDesignerSetup();
  if (setup.loading || setup.complete) return null;

  return (
    <div className="bg-surface p-5 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-ui text-ui text-black">ตั้งค่าร้านของคุณให้พร้อมขาย</h2>
          <p className="font-body text-footnote text-grey-600 mt-0.5">
            ทำครบ {[setup.hasSlug, setup.hasSellerInfo, setup.hasBank].filter(Boolean).length}/3 ขั้นตอน
          </p>
        </div>
        <Button as="link" href="/designer/settings" size="sm">ไปหน้าตั้งค่า →</Button>
      </div>
      <div className="flex flex-col gap-3">
        <StepRow
          done={setup.hasSlug}
          label="ตั้ง Designer Slug (URL หน้าร้าน)"
          desc="จำเป็นก่อนเพิ่มฟอนต์ — เป็นที่อยู่หน้าร้านและหน้าฟอนต์ทุกตัวของคุณ ตั้งได้ครั้งเดียว"
        />
        <StepRow
          done={setup.hasSellerInfo}
          label="กรอกข้อมูลผู้ขาย (ชื่อ + ที่อยู่)"
          desc="ใช้ออกใบเสนอราคาและเอกสารให้ลูกค้าองค์กร"
        />
        <StepRow
          done={setup.hasBank}
          label="เพิ่มบัญชีธนาคาร"
          desc="ใช้รับส่วนแบ่งรายได้จากการขายผ่านเว็บ"
        />
      </div>
    </div>
  );
}

/** Gate หน้าเพิ่มฟอนต์ — ยังไม่ตั้ง slug ให้ไปตั้งก่อน */
export function AddFontGate({ children }: { children: React.ReactNode }) {
  const setup = useDesignerSetup();

  if (setup.loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center font-body text-body-sm text-grey-600">กำลังโหลด…</div>
    );
  }

  if (!setup.hasSlug) {
    return (
      <div className="p-6 max-w-[560px]">
        <div className="bg-surface p-8 text-center">
          <div className="text-[32px] mb-3">🏪</div>
          <h1 className="font-heading text-h2 text-black mb-2">ตั้ง Designer Slug ก่อนเพิ่มฟอนต์</h1>
          <p className="font-body text-body-sm text-grey-600 leading-[1.7] mb-6 max-w-[400px] mx-auto">
            Slug คือที่อยู่หน้าร้านของคุณ (เช่น <span className="text-black font-ui text-ui">/designer/yourname</span>)
            และเป็นส่วนหนึ่งของลิงก์หน้าฟอนต์ทุกตัว จึงต้องตั้งก่อนจึงจะเพิ่มฟอนต์ได้
            — ตั้งได้ครั้งเดียว เปลี่ยนภายหลังต้องติดต่อ admin
          </p>
          <Button as="link" href="/designer/settings">ไปตั้งค่า Slug →</Button>
          <p className="mt-4">
            <Link href="/designer" className="font-body text-footnote text-grey-600 no-underline hover:text-black transition-colors duration-150 ease-base">← กลับหน้าฟอนต์ของฉัน</Link>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
