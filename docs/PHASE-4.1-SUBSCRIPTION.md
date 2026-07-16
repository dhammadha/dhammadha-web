# Phase 4.1 — Subscription + Desktop App (เอกสารติดตามงาน)

> อัปเดตล่าสุด: 2026-07-12 · แผนเต็ม: `~/.claude/plans/subscription-spicy-wozniak.md`
> สถานะ: **A + B เสร็จ (commit 39fdfde)** → กำลังทดสอบ authed → รอต่อ **C**

## ภาพรวมโมเดล (ยืนยันกับ user แล้ว)

- **แบ่งรายได้/เดือน:** เว็บ 50% / designer pool 50%
  - **equal 12%** — แบ่งเท่ากันทุกฟอนต์ที่ opt-in (`is_subscription`) → เจ้าของฟอนต์
  - **stream 38%** — แบ่งตาม **font-days + user-centric normalization**
    (สมาชิกแต่ละคนน้ำหนัก = 1 เท่ากัน หารตาม font-days ของตัวเอง → กัน activate-all ปั๊มยอด)
  - ส่วนแบ่งไม่หมด (ไม่มีฟอนต์/ไม่มีคนสตรีม) → ตกเป็นของแพลตฟอร์ม
- **ราคา:** ฿290/เดือน · ฿2,900/ปี (ฟรี 2 เดือน) · **ช่วงทดสอบ ฿0**
- **ช่วงทดสอบ:** ไม่ทำ role Tester · ไม่ผูก gateway · สมัคร trial ตรงผ่าน RPC
  (schema เป็นกลาง provider `trial/stripe/payso/admin`)
- **สิทธิ์:** ทุก role login แอปได้ · activate ต้องมี subscription · **admin activate ได้ไม่ต้องสมัคร**
  (font-days ที่สตรีมโดย admin ไม่นับ แต่ฟอนต์ที่ admin เป็นเจ้าของอยู่ใน pool ปกติ) · designer สมัครได้
- **Activate แบบ Adobe Fonts:** session-scoped, ไฟล์เข้ารหัส, ปิดแอป/logout/หมดสิทธิ์ = ฟอนต์หาย,
  auto-login (refresh token ใน OS keychain), offline grace 7 วัน
- **OS:** Windows x64 · macOS universal (ทดสอบแรกบน Intel Mac เครื่อง user)
- B2C ขายรายฟอนต์ + B2B quote เปิดใช้จริงคู่ขนานตามปกติ

---

## ✅ Milestone A — รากฐาน DB + เว็บ (เสร็จ, commit 39fdfde)

- [x] migration **0045** `favourites` (RLS owner-only)
- [x] migration **0046** `subscriptions` + RPC `start_trial_subscription` (idempotent, อ่าน settings)
- [x] migration **0047** `stream_days` + `sub_download_logs` (client เขียนไม่ได้ — service role เท่านั้น)
- [x] `FavouritesContext` + ต่อสายปุ่มหัวใจ `FontCard` / `FontDetail` (anon → `/auth/login?next=`)
- [x] `/account`: `MyFavourites` (แสดงแม้ยังไม่สมัคร + ชวนสมัคร) + `SubscriptionCard`
- [x] `/subscribe` เขียนใหม่เป็น state machine (trial เปิด/ปิด/active + ลิงก์โหลดแอป)
- [x] หน้าแรก `SubscriptionPricingCard` (flip waitlist ↔ CTA)
- [x] `/admin/pricing` การ์ดตั้งค่า `settings.subscription`
- [x] `/admin/subscriptions` ใหม่ (comp / ต่ออายุ / ยกเลิก) + เมนู "สมาชิก"
- [x] `src/lib/subscription.ts` (isSubActive / isTrialOpen / parseSubSettings)
- [x] ทดสอบ RLS rollback ครบ + build + เบราว์เซอร์ (subscribe 2 สถานะ, heart anon redirect)

## ✅ Milestone B — คำนวณส่วนแบ่ง (เสร็จ, commit 39fdfde)

- [x] migration **0048** RPC `subscription_month_data(year, month)` — user-centric normalize ใน SQL
- [x] `src/lib/subscription-revenue.ts` (pure, SPLIT 50/12/38, reconcile ปัดเศษ)
- [x] `SubscriptionRevenue` component → drop เข้า `/admin/revenue` + `/designer/revenue`
- [x] ทดสอบ RPC ด้วยข้อมูลสังเคราะห์: normalize ถูก, orphan/empty handle, reconcile 145.01+144.99=290

---

## 🔲 กำลังทำ — ทดสอบ authed A+B (งาน user)

> **ก่อนเริ่ม:** `/admin/pricing` → เปิด "ช่วงทดสอบฟรี" + วันสิ้นสุด → บันทึก
> (ตอนนี้ `settings.subscription` มีแล้ว 290/2900 แต่ `trial_active=false`)

- [ ] Favourite: กดหัวใจ (login) → รีเฟรชยังติด → เห็นใน `/account`
- [ ] สมัคร trial: `/subscribe` → "เริ่มใช้ฟรีเลย" → `/account` ขึ้น "ใช้งานอยู่" + วันหมดอายุ
- [ ] `/admin/subscriptions`: เห็นสมาชิก, ต่ออายุ/comp ได้
- [ ] `/admin/revenue` + `/designer/revenue`: section "รายได้ Subscription" (฿0 ตามคาด — ยังไม่มี heartbeat)

---

## 🔲 Milestone C — Edge Function + Desktop app (~2-3 สัปดาห์)

### C1 — Edge Function `supabase/functions/sub-font/` (ทำก่อน, เทสด้วย curl+JWT)
- [ ] ย้าย `stamp.ts` → `supabase/functions/_shared/stamp.ts` + แก้ import ใน `download-font` + redeploy ทั้งคู่
- [ ] action `status` → `{active, role, provider, current_period_end}`
- [ ] action `list` → ฟอนต์ opt-in + ไฟล์ (font_files_private) + favourites ของ user
- [ ] action `download {font_id, file_index}` → rate limit 300/24ชม → อ่าน fonts-full → stamp → log
- [ ] action `heartbeat {font_ids[]}` → cap 500 → upsert stream_days วันนี้ (เวลาไทย) → admin ไม่นับเงิน
- [ ] เทส: subscriber 200 / customer เฉย ๆ 403 / admin 200, stream_days เกิดจริง

### C2 — Desktop app `desktop/` (Tauri v2 + Vite + React + TS + Tailwind)
- [ ] scaffold Tauri v2 (ต้องมี **Rust toolchain** บนเครื่อง user)
- [ ] Auth: supabase-js + custom storage adapter → Rust `keyring` (auto-login, refresh token ไม่แตะ disk)
- [ ] Vault (`src-tauri/src/vault.rs`): ไฟล์ฟอนต์ AES-256-GCM, ถอดตอน activate, ลบตอน deactivate/exit + sweep
- [ ] Font registration: Windows `AddFontResourceExW(path,0)`+WM_FONTCHANGE / macOS `CTFontManagerRegisterFontsForURL` session
- [ ] Lifecycle: launch→restore→status→register→heartbeat / timer 6ชม / offline grace 7 วัน / สิทธิ์หมด→deactivate
- [ ] UI v1: Login → Library (ทั้งหมด + tab รายการโปรด + activate/deactivate + search) → Settings
- [ ] Update: tauri-plugin-updater + `public/desktop/latest.json` / CI `.github/workflows/desktop.yml` (win x64 + macos universal)
- [ ] เทส dev build บน Intel Mac: activate → ฟอนต์โผล่ Font Book → ปิดแอปหาย

## 🔲 Milestone D — เปิดช่วงทดสอบ (~2-3 วัน)
- [ ] ตั้ง `settings.subscription` เปิด trial ใน `/admin/pricing`
- [ ] ใส่ลิงก์ดาวน์โหลดแอปใน settings เมื่อมี release
- [ ] แจ้ง waitlist (email-service เดิม)
- [ ] QA: comp บัญชีทดสอบ, admin activate ไม่ต้องสมัคร, revenue ฿0 + สัดส่วนจริงหลัง heartbeat 2-3 วัน

---

## 🔲 งานฝั่ง user (operational — ไม่ใช่โค้ด)
- [ ] **Payso**: สอบถาม recurring / trial / ฿0 (แจ้งผล 1-2 วัน) — ไม่รองรับ → ใช้ Stripe (`payment_method_collection: if_required`)
- [ ] **Apple Developer ID $99/ปี** + notarization — *ไม่เกี่ยวกับการเรียกใช้ฟอนต์* แค่การเปิดแอปครั้งแรก
  (ช่วงทดสอบวงปิดเลื่อนได้ แนบวิธีอนุญาตใน System Settings) สมัครก่อนเปิด public
- [ ] **Windows code signing cert** (~$100+/ปี) — ไม่มีผลกับการใช้งาน แค่ SmartScreen เตือน (More info → Run anyway)

## ไฟล์สำคัญ
- Migrations: `supabase/migrations/0045`–`0048`
- Libs: `src/lib/subscription.ts`, `src/lib/subscription-revenue.ts`
- Context: `src/context/FavouritesContext.tsx`
- Components: `src/components/account/{MyFavourites,SubscriptionCard}.tsx`, `src/components/SubscriptionPricingCard.tsx`, `src/components/revenue/SubscriptionRevenue.tsx`
- Pages: `src/app/subscribe/page.tsx`, `src/app/admin/{pricing,subscriptions,revenue}/page.tsx`, `src/app/designer/(dashboard)/revenue/page.tsx`
- รอทำ (C): `supabase/functions/sub-font/`, `supabase/functions/_shared/stamp.ts`, `desktop/`

## ความเสี่ยง/หมายเหตุ
- `is_subscription` default เปิดทุกฟอนต์ (opt-out) — โอเคตอนนี้ (ฟอนต์ทั้งหมดของสตูดิโอ) ควรระบุใน designer agreement เมื่อรับ designer นอก
- ไฟล์ถอดรหัสชั่วคราวระหว่าง active ถูก copy ได้ (เหมือน Adobe Fonts) — stamp ระบุตัว subscriber เป็น audit trail
- subscriber จริง script heartbeat เชียร์ตัวเองได้ แต่ user-centric จำกัดความเสียหาย = น้ำหนัก 1 คน
- stream 38% + font-days จะเป็น ฿0/ว่าง จนกว่า desktop app (C) ส่ง heartbeat
