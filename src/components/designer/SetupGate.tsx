"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";

// สถานะการตั้งค่าร้านของ designer — layout ของ dashboard ใช้ redirect ไป
// /designer/onboarding เมื่อยังตั้งค่าไม่ครบ และใช้ gate กันเพิ่มฟอนต์ก่อนตั้ง slug
// (ไม่มี slug = ลิงก์หน้าฟอนต์ใช้ไม่ได้)

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

/**
 * designer เปิดใช้ระบบใบเสนอราคาไว้หรือยัง
 * ไม่มีแถว config = ยังไม่เคยเปิด = ปิด (ตรงกับค่า default ของคอลัมน์ใน DB)
 */
export function useQuoteSystem(): { loading: boolean; enabled: boolean } {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, enabled: false });

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("designer_license_config")
      .select("quote_enabled")
      .eq("designer_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setState({ loading: false, enabled: !!data?.quote_enabled });
      });
    return () => { active = false; };
  }, [user]);

  return state;
}

/** Gate หน้าใบเสนอราคา — ยังไม่เปิดระบบให้ไปเปิดที่หน้าราคาก่อน */
export function QuoteSystemGate({ children }: { children: React.ReactNode }) {
  const { loading, enabled } = useQuoteSystem();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center font-body text-body-sm text-grey-600">กำลังโหลด…</div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-6 max-w-[560px]">
        <div className="bg-surface p-8 text-center">
          <div className="text-[32px] mb-3">📄</div>
          <h1 className="font-ui text-h2 text-black mb-2">ยังไม่ได้เปิดใช้งานระบบใบเสนอราคา</h1>
          <p className="font-body text-body-sm text-grey-600 leading-[1.7] mb-6 max-w-[400px] mx-auto">
            ระบบใบเสนอราคาใช้สำหรับขายสิทธิให้ห้างร้าน องค์กร และบริษัท
            เปิดใช้งานได้ที่หน้าราคาและโปรโมชั่น
          </p>
          <Button as="link" href="/designer/pricing">เปิดการใช้งานระบบใบเสนอราคา →</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
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
          <h1 className="font-ui text-h2 text-black mb-2">ตั้ง Designer Slug ก่อนเพิ่มฟอนต์</h1>
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
