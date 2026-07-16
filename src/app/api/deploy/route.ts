// Dev-only endpoint — with output: "export" this route is dropped from the
// production build. Production traffic hits the Cloudflare Pages Function at
// functions/api/deploy.ts instead. Both delegate to the same shared logic in
// src/lib/deploy-service.ts.

import { NextRequest, NextResponse } from "next/server";
import { handleDeployRequest } from "@/lib/deploy-service";

export async function POST(req: NextRequest) {
  const result = await handleDeployRequest(
    {
      authToken: req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
    },
    {
      CF_DEPLOY_HOOK: process.env.CF_DEPLOY_HOOK,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  );

  return NextResponse.json(result.body, { status: result.status });
}
