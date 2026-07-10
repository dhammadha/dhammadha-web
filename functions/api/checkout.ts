// Cloudflare Pages Function — serves POST /api/checkout in production.
// Static export drops app-router API routes, so this is the real endpoint.
// Shared logic lives in src/lib/checkout-service.ts.
//
// Required Pages env vars: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY. Optional: PUBLIC_SITE_URL.

import { handleCheckoutRequest } from "../../src/lib/checkout-service";

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

  const result = await handleCheckoutRequest(
    {
      body,
      authToken: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
      origin: new URL(request.url).origin,
    },
    {
      STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
      SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      PUBLIC_SITE_URL: env.PUBLIC_SITE_URL,
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
