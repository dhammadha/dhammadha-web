// Cloudflare Pages Function — serves POST /api/deploy in production.
// Static export drops app-router API routes, so this is the real endpoint.
// Shared logic lives in src/lib/deploy-service.ts.
//
// ทำไมต้องมี proxy นี้แทนที่จะยิง Cloudflare deploy hook ตรงจาก browser:
// hook URL เดิมเก็บใน NEXT_PUBLIC_CF_DEPLOY_HOOK ซึ่งถูก Next inline ลง JS
// chunk สาธารณะตอน build — ใครก็ curl chunk แล้วยิง deploy ซ้ำ ๆ ได้ไม่จำกัด
// (build-minute exhaustion) เพราะหน้า admin เช็ค role แค่ฝั่ง client เท่านั้น
// ห้าม "simplify" กลับไปยิงจาก client ตรง ๆ อีก — ต้องตรวจ admin ฝั่ง server
// ก่อนเสมอ แล้ว hook URL ต้องอยู่ใน CF_DEPLOY_HOOK (ไม่มี NEXT_PUBLIC_ นำหน้า)
//
// Required Pages env vars: CF_DEPLOY_HOOK (Secret), NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY.

import { handleDeployRequest } from "../../src/lib/deploy-service";

interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const result = await handleDeployRequest(
    {
      authToken: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
    },
    {
      CF_DEPLOY_HOOK: env.CF_DEPLOY_HOOK,
      SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
