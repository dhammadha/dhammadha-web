// Dev-only endpoint — with output: "export" this route is dropped from the
// production build. Production traffic hits the Cloudflare Pages Function at
// functions/api/send-email.ts instead. Both delegate to the same shared
// logic in src/lib/email-service.ts.

import { NextRequest, NextResponse } from "next/server";
import { handleEmailRequest } from "@/lib/email-service";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const result = await handleEmailRequest(
    {
      body,
      authToken: req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
      ip: null,
    },
    {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL,
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    }
  );

  return NextResponse.json(result.body, { status: result.status });
}
