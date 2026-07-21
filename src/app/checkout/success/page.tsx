"use client";

// หน้า landing หลังจ่ายเงินผ่าน Stripe Checkout สำเร็จ
// Stripe redirect มาพร้อม ?session_id=... → poll RPC checkout_order_status
// จนกว่า webhook จะสร้าง order เสร็จ (ปกติไม่กี่วินาที) แล้วโชว์เลขคำสั่งซื้อ

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 24; // ~60 วินาที

interface OrderStatus {
  found: boolean;
  order_no?: string;
  paid_at?: string;
  customer_email?: string;
  fonts?: string[];
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <CheckoutSuccess />
    </Suspense>
  );
}

function CheckoutSuccess() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let polls = 0;

    async function poll() {
      polls += 1;
      const { data } = await supabase.rpc("checkout_order_status", {
        p_session_id: sessionId,
      });
      if (cancelled) return;
      const status = data as OrderStatus | null;
      if (status?.found) {
        setOrder(status);
        // ผูกสิทธิ์เข้ากับบัญชีทันทีถ้า login อยู่ — หน้า "ดาวน์โหลดของฉัน" เห็นไฟล์เลย
        supabase.rpc("claim_my_entitlements").then(() => {});
        return;
      }
      if (polls >= MAX_POLLS) {
        setTimedOut(true);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <>
      <Nav />
      <section className="bg-white">
        <Container className="pt-10 pb-16">
          <div className="max-w-[640px] mx-auto">
            {!sessionId ? (
              <Panel title="ไม่พบข้อมูลการชำระเงิน">
                <p className="font-body text-body text-grey-600 leading-[1.8]">
                  ลิงก์ไม่ถูกต้อง หากคุณชำระเงินแล้ว กรุณาตรวจสอบอีเมลของคุณ
                  หรือติดต่อ info@dhammadha.com
                </p>
                <Button as="link" href="/fonts/" className="mt-4">กลับไปหน้าฟอนต์</Button>
              </Panel>
            ) : order ? (
              <Panel title="ชำระเงินสำเร็จ ขอบคุณสำหรับการสั่งซื้อ" success>
                <div className="font-body text-body text-black leading-[1.8]">
                  <p className="mb-3">
                    เลขที่คำสั่งซื้อ <strong>{order.order_no}</strong>
                    {order.fonts?.length ? (
                      <>
                        <br />ฟอนต์: <strong>{order.fonts.join(", ")}</strong>
                      </>
                    ) : null}
                  </p>
                  <p className="text-grey-600 mb-1">
                    เราส่งรายละเอียดไปที่อีเมล <strong className="text-black">{order.customer_email}</strong> แล้ว
                  </p>
                  <p className="text-grey-600">
                    ไฟล์ฟอนต์อยู่ในหน้า &quot;บัญชีของฉัน → ดาวน์โหลดของฉัน&quot;
                    {!user && " — เข้าสู่ระบบหรือสมัครสมาชิกด้วยอีเมลเดียวกัน ระบบจะผูกสิทธิ์ให้อัตโนมัติ"}
                  </p>
                </div>
                {user ? (
                  <Button as="link" href="/account/" size="lg" className="mt-5 w-full">
                    ไปที่หน้าดาวน์โหลด
                  </Button>
                ) : (
                  <Button
                    as="link"
                    href={`/auth/login/?next=${encodeURIComponent("/account/")}`}
                    size="lg"
                    className="mt-5 w-full"
                  >
                    เข้าสู่ระบบเพื่อดาวน์โหลด
                  </Button>
                )}
              </Panel>
            ) : timedOut ? (
              <Panel title="ได้รับการชำระเงินแล้ว — กำลังดำเนินการ">
                <p className="font-body text-body text-grey-600 leading-[1.8]">
                  ระบบกำลังยืนยันคำสั่งซื้อของคุณ ซึ่งอาจใช้เวลาสักครู่
                  เมื่อเสร็จแล้วคุณจะได้รับอีเมลยืนยันพร้อมวิธีดาวน์โหลดอัตโนมัติ
                  <br /><br />
                  หากไม่ได้รับอีเมลภายใน 30 นาที ติดต่อ info@dhammadha.com
                </p>
                <Button as="link" href="/account/" variant="outline" className="mt-4">
                  ไปที่บัญชีของฉัน
                </Button>
              </Panel>
            ) : (
              <Panel title="กำลังยืนยันการชำระเงิน...">
                <p className="font-body text-body text-grey-600 leading-[1.8]">
                  กรุณารอสักครู่ ระบบกำลังตรวจสอบการชำระเงินกับผู้ให้บริการ
                </p>
                <div className="mt-4 h-1 w-full bg-grey-200 overflow-hidden">
                  <div className="h-full w-1/3 bg-mint animate-pulse" />
                </div>
              </Panel>
            )}
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}

function Panel({
  title,
  success,
  children,
}: {
  title: string;
  success?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface p-6">
      <h1 className="font-heading text-h2 text-black mb-3">
        {success && <span className="text-success">✓ </span>}
        {title}
      </h1>
      {children}
    </div>
  );
}
