// Dev-only endpoint — with output: "export" this route is dropped from the
// production build. Production traffic hits the Cloudflare Pages Function at
// functions/api/checkout.ts instead. Both delegate to the same shared logic
// in src/lib/checkout-service.ts.

import { NextRequest, NextResponse } from "next/server";
import { handleCheckoutRequest } from "@/lib/checkout-service";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const result = await handleCheckoutRequest(
    {
      body,
      authToken: req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
      origin: req.nextUrl.origin,
    },
    {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
    }
  );

  return NextResponse.json(result.body, { status: result.status });
}
