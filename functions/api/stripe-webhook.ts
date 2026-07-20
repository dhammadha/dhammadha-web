// Cloudflare Pages Function — serves POST /api/stripe-webhook in production.
// Stripe calls this endpoint after a Checkout Session is paid; we verify the
// signature, create the order + entitlement (idempotent RPC), then email the
// customer. Shared logic lives in src/lib/checkout-service.ts.
//
// Required Pages env vars: STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY,
// RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// ADMIN_EMAIL (หรือ NEXT_PUBLIC_ADMIN_EMAIL — รับสองชื่อ ดูเหตุผลใน api/send-email.ts).

import { handleStripeWebhookRequest } from "../../src/lib/checkout-service";

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  // ต้องอ่าน body ดิบก่อน parse — ลายเซ็นคำนวณจาก byte ตรง ๆ
  const rawBody = await request.text();

  const result = await handleStripeWebhookRequest(
    {
      rawBody,
      signature: request.headers.get("stripe-signature"),
    },
    {
      STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      RESEND_API_KEY: env.RESEND_API_KEY,
      SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ADMIN_EMAIL: env.ADMIN_EMAIL ?? env.NEXT_PUBLIC_ADMIN_EMAIL,
    }
  );

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}
