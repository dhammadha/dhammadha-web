// Cloudflare Pages Function — serves POST /api/send-email in production.
// The Next.js app is deployed as a static export (output: "export"), which
// drops app-router API routes, so this function is the real production
// endpoint. Shared logic lives in src/lib/email-service.ts.
//
// Required Pages env vars: RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_ADMIN_EMAIL.
// Optional: TURNSTILE_SECRET_KEY (enables bot verification on quote emails).

import { handleEmailRequest } from "../../src/lib/email-service";

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const result = await handleEmailRequest(
    {
      body,
      authToken: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
      ip: request.headers.get("cf-connecting-ip"),
    },
    {
      RESEND_API_KEY: env.RESEND_API_KEY,
      SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ADMIN_EMAIL: env.NEXT_PUBLIC_ADMIN_EMAIL,
      TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
    }
  );

  return json(result.body, result.status);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
