// Dev-only endpoint — with output: "export" this route is dropped from the
// production build. Production traffic hits the Cloudflare Pages Function at
// functions/api/stripe-webhook.ts instead. Both delegate to the same shared
// logic in src/lib/checkout-service.ts.
//
// ทดสอบ local: stripe listen --forward-to localhost:3000/api/stripe-webhook

import { NextRequest, NextResponse } from "next/server";
import { handleStripeWebhookRequest } from "@/lib/checkout-service";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const result = await handleStripeWebhookRequest(
    {
      rawBody,
      signature: req.headers.get("stripe-signature"),
    },
    {
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ADMIN_EMAIL: process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    }
  );

  return NextResponse.json(result.body, { status: result.status });
}
