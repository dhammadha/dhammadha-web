# Phase 4.1 — Subscription + Desktop App (เอกสารติดตามงาน)

> อัปเดตล่าสุด: 2569-08-03 · แผนเต็ม: `~/.claude/plans/subscription-spicy-wozniak.md`
> สถานะ: **A + B + C1 เสร็จ** → รอต่อ **C2 (desktop app)**
>
> ⚠️ **สัดส่วนที่ถูกต้องคือ 50 / 12 / 38** (`SPLIT` ใน `src/lib/subscription-revenue.ts`)
> แผนเต็มฉบับเก่ายังเขียน 15/35 ซึ่งเป็นค่าก่อนปรับใน Phase 4.2b — **ยึดโค้ดเป็นหลัก**

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

## ✅ Milestone C1 — Edge Function `sub-font` (เสร็จ 3 ส.ค. 2569, ไม่แตะ DB)

- [x] ย้าย `stamp.ts` → `supabase/functions/_shared/stamp.ts` + แก้ import ใน `download-font` + redeploy ทั้งคู่
- [x] action `status` → `{active, role, provider, current_period_end}`
- [x] action `list` → ฟอนต์ opt-in + ไฟล์ (font_files_private) + favourites ของ user
- [x] action `download {font_id, file_index}` → rate limit 300/24ชม → อ่าน fonts-full → stamp → log
- [x] action `heartbeat {font_ids[]}` → cap 500 → upsert stream_days วันนี้ (เวลาไทย)
- [x] เทสด้วย JWT จริง: subscriber 200 / customer เปล่า 403 / admin 200 · heartbeat ยิงซ้ำไม่เพิ่มแถว
      · RPC `subscription_month_data` เห็น font_days และ normalize ถูก (1 คน 2 ฟอนต์ → share 0.5/0.5)

**โมเดลที่ต้องยึด: สมาชิกไม่ได้ "ไฟล์ฟอนต์"** — ได้สิทธิ์ให้เครื่องเรียกใช้ระหว่างเป็นสมาชิก
แอปรับ bytes เข้า vault ที่เข้ารหัส ถอดเฉพาะตอน activate แล้วลบตอน deactivate/ปิดแอป/หมดอายุ

- **`sub-font` ไม่ส่ง `Content-Disposition: attachment` โดยตั้งใจ** (ต่างจาก `download-font`)
  header นั้นเป็น affordance ของการ "บันทึกไฟล์" ซึ่งขัดกับโมเดล · ชื่อไฟล์ส่งทาง `X-Font-File`
  พร้อม `Access-Control-Expose-Headers` **ซึ่งจำเป็น ไม่งั้น JS ใน webview อ่าน header `X-*` ไม่เห็น**
- **⚠️ endpoint คืน bytes ดิบให้ผู้ถือ JWT ที่มี subscription active** — vault กันการคัดลอก
  โดยผู้ใช้ทั่วไป **ไม่ได้กันคนที่ยิง API ตรง** (ข้อจำกัดเดียวกับ Adobe Fonts) แนวป้องกันจริง
  ของกรณีนั้นคือ **สัญญา + stamp ที่ระบุตัวสมาชิก** ไม่ใช่มาตรการทางเทคนิค

## ✅ C1b — ผูกเข้ากับอุปกรณ์ + เข้ารหัส payload (เสร็จ 3 ส.ค. 2569, `0077`–`0079`)

**ปัญหาที่แก้:** JWT อย่างเดียวไม่พอ — `src/lib/supabase.ts` เก็บ session ลง localStorage
สมาชิกเปิดเว็บ ก๊อป token จาก devtools แล้วยิง endpoint ตรงได้ทันที **ไม่ต้องแตะแอปเลย**
และเพดานเดิม 300 ไฟล์/24 ชม. เทียบกับคลัง 284 ไฟล์ = ดูดทั้งคลังจบในวันเดียว

- `sub_devices` + `sub_device_keys` (แยกสองตารางแบบ `fonts`/`font_files_private`)
  · `sub_download_logs.device_id`
- `list`/`download`/`heartbeat` ต้องมีลายเซ็น `HMAC(device_key, "<ts>.<rawBody>")` — รูปแบบ
  เดียวกับ `verifyStripeSignature` · `status`/`register_device`/`devices`/`revoke_device` ใช้ JWT
- body ของ `download` เข้ารหัส `HKDF → AES-256-GCM` ถึงเครื่องนั้น (`salt16‖iv12‖ct+tag`)
- **เพดาน 2 เครื่อง/บัญชี** ตรงกับ `/agreement` ข้อ 7
- **กติกา OTF: มีทั้งสองฟอร์แมตให้สตรีม .otf · มีแค่ .ttf ใช้ .ttf** — `pickStreamFiles()`
  ตัวเดียวใช้ทั้ง `list` และ `download` · **ไฟล์ที่ endpoint ปล่อยลดจาก 284 เหลือ 144**
- เพดานรายเครื่อง 3 ชั้น (ไฟล์/วัน · **ฟอนต์ที่ต่างกัน/วัน** ← ตัวกันดูดคลัง · ดึงซ้ำ/30 วัน)
- หน้า `/admin/subscriptions` เพิ่มตารางอุปกรณ์ + ปุ่มถอน + สัญญาณ **"โหลดมากแต่ใช้จริงน้อย"**

**พิสูจน์แล้ว 34 ข้อด้วย Node ที่จำลองแอป** (เซ็น HMAC + ถอดรหัสจริง) รวมสาขา TTF-only
ที่คลังจริงไม่มี (ยืม `hinn` มาทดสอบชั่วคราวแล้วคืนค่าเดิม ตรวจ md5 ตรงกัน)

**🔴 กับดักที่เจอ: RLS policy กับ table grant เป็นสองชั้นที่ต้องผ่านทั้งคู่**
`0078` สร้าง policy `for all` ให้ admin แล้วแต่ `0077` grant ไว้แค่ `select`
→ ปุ่มถอนอุปกรณ์คืน **403 42501** · เจอเพราะยิง PATCH จริงด้วย JWT ของ admin
ไม่ได้ดูแค่ว่า policy มีอยู่ · แก้ใน `0079`

**⚠️ ข้อจำกัดที่ต้องพูดให้ตรง:** ไม่ได้ทำให้คัดลอกไม่ได้ — เจ้าของเครื่องงัด key จาก
keychain ได้เสมอ · ที่ได้คือปิดทางง่ายที่สุด (ก๊อป token) + **ระบุตัวและตัดสิทธิ์รายเครื่องได้**
แนวป้องกันจริงยังเป็นสัญญา + stamp

**🔲 ยกไป Milestone D (ตอนเปิด trial):** อีเมลแจ้งเตือนเมื่อมีอุปกรณ์ใหม่ —
`sub-font` เป็น Deno ส่วน `email-service.ts` อยู่บน Pages คนละ runtime ต้องยิง HTTP ข้ามกัน
และต้องมีโดเมนเป็น env อีกตัว **ซึ่งจะพังตอนเปลี่ยนแบรนด์** · ตอนนี้สมาชิก 0 คน
ยังไม่คุ้มที่จะผูกหนี้ก้อนนั้น — ทำพร้อมหน้าจัดการอุปกรณ์ในแอป (C2 Settings) ทีเดียว

---

**จุดที่ต้องรู้**

- **`BRAND_DOMAIN` มีสำเนาใน `sub-font` อีกชุด** (นอกจาก `download-font`) — เปลี่ยนชื่อแบรนด์
  ต้อง **redeploy ทั้งสอง function** ไม่งั้นไฟล์ที่ส่งออกไปถูกประทับโดเมนเก่า แก้ย้อนหลังไม่ได้
- **admin ใช้แอปได้โดยไม่ต้องสมัคร** — Edge Function ปล่อยผ่าน แต่การกรองไม่ให้นับเงิน
  อยู่ที่ RPC `subscription_month_data` (พิสูจน์แล้ว: heartbeat ของ admin → `contributing_users: 0`)
- **stamp ต่างจากการซื้อขาด** — ไม่มี `order_no`/`verify_token` ใช้ user id + ชื่อสมาชิกแทน
  เป็น audit trail ไม่ใช่ DRM
- **วันของ `stream_days` คำนวณเป็น Asia/Bangkok** (`bangkokToday()`) ไม่ใช่ UTC —
  ถ้าใช้ UTC ช่วง 00:00–07:00 น. ไทยจะถูกนับเป็นเมื่อวาน
- `download-font` เทียบ byte-for-byte ก่อน/หลัง redeploy แล้ว ผลเหมือนเดิมทุกอย่าง

## 🔲 Milestone C2 — Desktop app (~2-3 สัปดาห์)

**ก่อนเริ่ม:** ติดตั้ง Rust toolchain (`rustup`) — ยังไม่มีบนเครื่อง ·
ควรเคาะชื่อแบรนด์ก่อน scaffold เพราะ **bundle identifier** (`com.<brand>.app`)
ฝังลง code signing + การลงทะเบียนระดับ OS เปลี่ยนทีหลัง = ผู้ใช้ต้องติดตั้งใหม่

`desktop/` (Tauri v2 + Vite + React + TS + Tailwind) — API ฝั่ง server พร้อมใช้แล้วจาก C1
- [ ] scaffold Tauri v2
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
- Edge Functions: `supabase/functions/sub-font/index.ts`, `supabase/functions/_shared/stamp.ts` (ใช้ร่วมกับ `download-font`)
- สัญญา: `/designer-agreement` **ข้อ 4** = เงื่อนไข Subscription (opt-out รายชุด + สูตร 50/12/38)
  · `/agreement` **ข้อ 7** = เงื่อนไขที่ผูกพันสมาชิก (ไม่ได้ไฟล์ · ห้ามสกัดออกจากแอป ·
  ห้ามหลบเลี่ยงมาตรการทางเทคนิค · ห้ามใช้บัญชีร่วม) + **ข้อ 8 จำกัดสิทธิ์ตลอดชีพให้เฉพาะการซื้อรายชุด**
- รอทำ (C2): `desktop/`

## ความเสี่ยง/หมายเหตุ
- ~~`is_subscription` default เปิดทุกฟอนต์ (opt-out) — ควรระบุใน designer agreement~~
  ✅ **ปิดแล้ว 3 ส.ค. 2569** — `/designer-agreement` ข้อ 4 ระบุ opt-out รายชุด + สูตรแบ่ง +
  ข้อจำกัดเรื่อง stamp เป็น audit trail ไม่ใช่ DRM · ยังไม่มี designer ภายนอกเซ็น จึงไม่ต้อง `legal:freeze`
- ไฟล์ถอดรหัสชั่วคราวระหว่าง active ถูก copy ได้ (เหมือน Adobe Fonts) — stamp ระบุตัว subscriber เป็น audit trail
- subscriber จริง script heartbeat เชียร์ตัวเองได้ แต่ user-centric จำกัดความเสียหาย = น้ำหนัก 1 คน
- stream 38% + font-days จะเป็น ฿0/ว่าง จนกว่า desktop app (C) ส่ง heartbeat
