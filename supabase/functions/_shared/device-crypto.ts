// Crypto ของการผูก sub-font เข้ากับอุปกรณ์ — ลายเซ็นคำขอ + เข้ารหัส payload
//
// ⚠️ **สำเนาชุดที่สองของ `hmacSha256Hex`/`timingSafeEqual` ใน `src/lib/checkout-service.ts`**
// Deno (โฟลเดอร์นี้) กับ Cloudflare Workers (`src/lib/`) รันคนละ runtime และ deploy
// แยกกัน import ข้ามไม่ได้ — เหมือนที่ `BRAND_DOMAIN` ซ้ำอยู่ 3 ที่แล้ว
// **แก้ตรรกะลายเซ็นที่นี่ต้องดูว่ากระทบ verifyStripeSignature ด้วยไหม** (คนละ secret
// คนละเส้นทาง แต่รูปแบบ `<ts>.<rawBody>` + tolerance window ตั้งใจให้เหมือนกัน
// จะได้ไม่ต้องจำสองแบบ)
//
// เลือก HMAC (symmetric) ไม่ใช่ Ed25519 เพราะรูปแบบนี้พิสูจน์แล้วในระบบนี้
// แลกกับการที่ server เก็บ key ไว้จริง ซึ่งรับได้ — คนที่ถึง service_role ได้
// ก็ถึง bucket fonts-full ได้อยู่แล้ว การมี device key เพิ่มไม่เปิด exposure ใหม่

const enc = new TextEncoder();

/** HMAC-SHA256 → hex (คีย์เป็น bytes ไม่ใช่ string ต่างจากฝั่ง Stripe ที่ secret เป็นข้อความ) */
export async function hmacHex(keyBytes: Uint8Array, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** เทียบแบบไม่รั่วเวลา — ยาวไม่เท่ากันคืน false ทันที (ความยาวไม่ใช่ความลับ) */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * ตรวจลายเซ็นของคำขอจากแอป
 * แอปส่ง: X-Device-Id · X-Timestamp (unix วินาที) · X-Signature = hmacHex(key, `<ts>.<rawBody>`)
 *
 * `rawBody` ต้องเป็น **สตริงดิบตัวเดียวกับที่ใช้ parse JSON** — parse แล้ว stringify ใหม่
 * จะได้คนละ byte (ลำดับ key/ช่องว่างเปลี่ยน) แล้วลายเซ็นจะไม่มีวันตรง
 * นี่คือกับดักเดียวกับที่ stripe-webhook.ts ต้องอ่าน request.text() ก่อนเสมอ
 */
export async function verifyDeviceSignature(
  keyBytes: Uint8Array,
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  toleranceSec = 300,
  now: number = Date.now(),
): Promise<boolean> {
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(now / 1000 - ts) > toleranceSec) return false;
  const expected = await hmacHex(keyBytes, `${timestamp}.${rawBody}`);
  return timingSafeEqual(signature, expected);
}

/** สุ่ม device key 32 bytes — คืนให้แอปครั้งเดียวตอนลงทะเบียน */
export function newDeviceKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * เข้ารหัสไฟล์ฟอนต์ให้เปิดได้เฉพาะเครื่องที่ถือ device key
 *
 * รูปแบบ body: `salt(16) ‖ iv(12) ‖ ciphertext+tag`
 * คีย์ AES มาจาก HKDF(device_key, salt) ไม่ได้ใช้ device key ตรง ๆ เพื่อไม่ให้
 * คีย์ตัวเดียวทำสองหน้าที่ (เซ็นคำขอ + เข้ารหัสไฟล์) และได้คีย์ใหม่ทุก response
 *
 * ฝั่ง Rust ใน C2: `hkdf` (Sha256) + `aes-gcm` — พารามิเตอร์ต้องตรงกับที่นี่เป๊ะ
 * (info = "sub-font-v1", salt 16 bytes, iv 12 bytes, tag 16 bytes ต่อท้าย ciphertext)
 */
export const ENC_VERSION = "v1";
const HKDF_INFO = "sub-font-v1";

export async function encryptForDevice(
  keyBytes: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const base = await crypto.subtle.importKey("raw", keyBytes as BufferSource, "HKDF", false, [
    "deriveKey",
  ]);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: enc.encode(HKDF_INFO) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      aesKey,
      plaintext as BufferSource,
    ),
  );

  const out = new Uint8Array(salt.length + iv.length + ct.length);
  out.set(salt, 0);
  out.set(iv, salt.length);
  out.set(ct, salt.length + iv.length);
  return out;
}
