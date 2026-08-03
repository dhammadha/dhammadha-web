// สร้าง fixture ให้ `src-tauri/tests/crypto.rs` ใช้ตรวจว่า Rust ถอด/เซ็นได้ตรงกับ server
//
// 🔴 **สำคัญ: สคริปต์นี้ import `_shared/device-crypto.ts` ตัวจริงที่ deploy อยู่**
// ไม่ได้เขียนอัลกอริทึมซ้ำ — ถ้าเขียนซ้ำแล้วพลาดเหมือนกันทั้งสองฝั่ง fixture จะผ่าน
// ทั้งที่ของจริงพัง ซึ่งทำให้การทดสอบไร้ความหมาย
//
// รัน:  node scripts/gen-crypto-fixtures.mjs
// (Node ≥ 22 รัน .ts ได้เองด้วย type stripping — ไม่ต้องมี deno/tsc)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const shared = resolve(here, "../../supabase/functions/_shared/device-crypto.ts");
const { hmacHex, encryptForDevice } = await import(shared);

const hex = (u8) =>
  Array.from(u8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// device key คงที่ (ไม่ใช่ของจริง) — ต้องเป็น 32 bytes เท่าที่ newDeviceKey() สร้าง
const keyHex = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const key = Uint8Array.from(Buffer.from(keyHex, "hex"));

// ── ลายเซ็นคำขอ ────────────────────────────────────────────────────────
// rawBody เป็นสตริงดิบ ไม่ใช่ object — ตรงกับที่ Rust ต้องเซ็น (ดู api.rs)
const sigCases = [];
for (const [ts, rawBody] of [
  ["1754200000", '{"action":"list"}'],
  ["1754200000", '{"action":"claim_activation"}'],
  // ไทย + อีโมจิ: พิสูจน์ว่าเซ็นบน **UTF-8 bytes** ไม่ใช่ UTF-16 code unit
  ["1700000000", '{"action":"session_end","reason":"ผู้ใช้ปิดเอง 🔒"}'],
  ["1", ""], // body ว่าง = เซ็น "1." เฉย ๆ
]) {
  sigCases.push({ ts, raw_body: rawBody, signature: await hmacHex(key, `${ts}.${rawBody}`) });
}

// ── payload ที่เข้ารหัสถึงเครื่อง ────────────────────────────────────────
const encCases = [];
for (const plain of [
  new Uint8Array([0x4f, 0x54, 0x54, 0x4f]), // "OTTO" = sfntVersion ของ .otf
  new Uint8Array(0), // ไฟล์ว่าง — ขอบเขตของ AES-GCM (เหลือแค่ tag)
  crypto.getRandomValues(new Uint8Array(5000)), // ยาวกว่า 1 block
]) {
  encCases.push({
    plaintext: hex(plain),
    blob: hex(await encryptForDevice(key, plain)),
  });
}

const out = resolve(here, "../src-tauri/tests/fixtures/device-crypto.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify({ key_hex: keyHex, signatures: sigCases, encrypted: encCases }, null, 2) + "\n",
);
console.log("wrote", out);
