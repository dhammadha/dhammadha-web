// Shared deploy-trigger logic — used by both the Cloudflare Pages Function
// (functions/api/deploy.ts, production) and the Next.js route handler
// (src/app/api/deploy/route.ts, dev only). Must stay framework-free:
// fetch + plain objects only, no Next.js or Node-specific imports.
//
// ทำไมต้องมี proxy นี้: เดิมหน้า admin/font-review ยิง Cloudflare deploy hook
// ตรงจาก browser ผ่าน NEXT_PUBLIC_CF_DEPLOY_HOOK — ค่า NEXT_PUBLIC_* ถูก Next
// inline ลง JS chunk ตอน build แล้วเสิร์ฟแบบไม่ต้อง auth ใครก็ curl chunk แล้ว
// grep เอา hook URL ไปยิง deploy ซ้ำ ๆ ได้ไม่จำกัด (build-minute exhaustion /
// deploy-queue DoS) เพราะการเช็ค role เป็นแค่ client-side redirect ที่ไม่ได้
// ป้องกันไฟล์ JS เลย จึงต้องย้าย hook URL มาเก็บเป็น secret ฝั่ง server
// (CF_DEPLOY_HOOK ไม่มี NEXT_PUBLIC_ นำหน้า) แล้วให้ endpoint นี้ตรวจสิทธิ์ admin
// ก่อนค่อยยิง hook แทน — ห้าม "simplify" กลับไปยิงจาก client ตรง ๆ อีก

export interface DeployEnv {
  /** Cloudflare Pages deploy hook URL — server-side only, ห้ามมี NEXT_PUBLIC_ นำหน้า */
  CF_DEPLOY_HOOK?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

export interface DeployRequestContext {
  /** Supabase access token from the Authorization header */
  authToken?: string | null;
}

export interface DeployResult {
  status: number;
  body: { ok: boolean; error?: string };
}

export async function handleDeployRequest(ctx: DeployRequestContext, env: DeployEnv): Promise<DeployResult> {
  if (!ctx.authToken) return { status: 401, body: { ok: false, error: "unauthorized" } };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { status: 500, body: { ok: false, error: "not_configured" } };
  }

  // Caller ต้องเป็น admin — ตรวจกับ DB จริง (RPC get_my_role) ไม่เชื่อ client
  // fail closed: token หาย/ผิด/ตรวจไม่ผ่าน → ปฏิเสธเสมอ
  let roleRes: Response;
  try {
    roleRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_my_role`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${ctx.authToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch {
    return { status: 403, body: { ok: false, error: "forbidden" } };
  }
  if (!roleRes.ok) return { status: 403, body: { ok: false, error: "forbidden" } };
  let role: unknown;
  try {
    role = await roleRes.json();
  } catch {
    return { status: 403, body: { ok: false, error: "forbidden" } };
  }
  if (role !== "admin") return { status: 403, body: { ok: false, error: "forbidden" } };

  if (!env.CF_DEPLOY_HOOK) {
    return { status: 500, body: { ok: false, error: "deploy_hook_not_configured" } };
  }

  try {
    const res = await fetch(env.CF_DEPLOY_HOOK, { method: "POST" });
    if (!res.ok) {
      // ไม่ log/คืน hook URL ออกไป — คืนแค่ status code ของ upstream
      return { status: 502, body: { ok: false, error: `deploy_hook_failed_${res.status}` } };
    }
    return { status: 200, body: { ok: true } };
  } catch {
    return { status: 502, body: { ok: false, error: "deploy_hook_unreachable" } };
  }
}
