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

## ✅ C1c — ใช้งานได้ทีละเครื่อง + หน้า Members (เสร็จ 3 ส.ค. 2569, `0080`)

**โมเดลที่เจ้าของเคาะ: ลงทะเบียนได้ 2 เครื่อง แต่ activate ได้ทีละเครื่อง** (แบบ Adobe CC)
เปิดแอปที่ B → B เรียก `claim_activation` → A รู้ตัวตอน poll ถัดไปแล้วดับฟอนต์
**vault ยังอยู่ครบทั้งสองเครื่อง สลับกลับไม่ต้องโหลดใหม่** — คือเหตุผลที่ไม่เลือก
"1 เครื่องแล้วเตะ" ซึ่งจะทำให้ทุกครั้งที่สลับต้องดึงไฟล์ใหม่ทั้งชุด (~130 ไฟล์ถ้าใช้ 10 ฟอนต์)

- **เตะที่ระดับ activate ไม่ใช่ระดับ login** — เครื่องที่ถูกเตะยังเรียก `list` ดูไลบรารีได้
- เครื่องที่ `activated_at` ใหม่ที่สุด (ยังไม่ถูกถอน) = เครื่องที่ถือสิทธิ์
  **ไม่มีธงตัวที่สอง** · `register_device` ยึดสิทธิ์ให้ทันที (ไม่งั้นผู้ใช้ใหม่เจอ 409 ตั้งแต่ไฟล์แรก)
- `download`/`heartbeat` → `409 not_active_device` ถ้าไม่ใช่เครื่องที่ถือสิทธิ์
- `status` คืน `is_active_device` + `active_device_name` = สัญญาณที่แอปใช้ตัดสินใจ deactivate

**🔴 ช่องที่ปิดไปพร้อมกัน — เพดานเดิมนับรายเครื่อง จึงรีเซ็ตได้ด้วยการถอนแล้วลงใหม่**
`.eq("device_id", …)` → `.eq("user_id", …)` ทั้งสามชั้น · ที่ 2 เครื่องยังพอไหวเพราะ
การวน device ผิดปกติและจับได้ แต่ถ้าเป็นโมเดล 1 เครื่อง+เตะ การวนจะกลายเป็นพฤติกรรม
ปกติจนแยกคนดูดคลังไม่ออก — **คำถามเรื่องจำนวนเครื่องเป็นตัวเปิดโปงบั๊กนี้**
(`sub_download_logs.device_id` ยังเก็บต่อเพื่อสอบย้อนหลัง แค่เลิกใช้เป็น key ของเพดาน)

**หน้า `/admin/members` ใหม่** — ย้าย สมาชิก / อุปกรณ์ / การใช้งาน 7 วัน ออกจาก
`/admin/subscriptions` (เหลือเฉพาะการ์ดตั้งค่า) · ตารางอุปกรณ์มีป้าย **"ถือสิทธิ์อยู่"**
· เมนู `REVIEW_NAV` ตัวเดียวถูก map ทั้ง sidebar desktop และ drawer มือถือ

**พิสูจน์แล้ว 16 ข้อ** — A/B สลับสิทธิ์กันไปมา · `list` ใช้ได้ทั้งสองเครื่อง ·
**ชนเพดานแล้วถอน+ลงทะเบียนใหม่ยังคง 429** (เดิมรีเซ็ตเป็น 0)

---

## ✅ C1d — เก็บช่วงเวลาการใช้งานจริง (เสร็จ 3 ส.ค. 2569, `0081`)

เจ้าของต้องการให้ **ทุกการเคลื่อนไหวมีข้อมูลมาคำนวณรายได้** — เริ่มนับตอน activate
หยุดตอน deactivate/signout/เครื่องดับ/ออฟไลน์ แล้วนับต่อเมื่อกลับมา

**`stream_sessions`** — หนึ่งแถวต่อหนึ่งช่วง · `started_at` · `last_seen_at` (heartbeat เลื่อน)
· `ended_at` + `end_reason` (`deactivate|signout|quit|expired|switched`)

```
เวลาที่นับได้ = coalesce(ended_at, last_seen_at) - started_at
```
ปิดสวย ๆ → เป๊ะ · เครื่องดับ/crash → ได้ถึงแค่ heartbeat ครั้งสุดท้าย
**ไม่มีทางนับเกินความจริง และไม่ต้องมี cron ไล่ปิด session ค้าง** ความจริงอยู่ในข้อมูลแล้ว

- `session_start` เขียน `stream_days` ทันทีด้วย → **ปิดรูที่ activate สั้น ๆ แล้วหายไป**
- `session_end` **ไม่ติดประตู active device** เครื่องที่เพิ่งถูกแย่งสิทธิ์ต้องปิดของตัวเองได้
- `claim_activation` ปิด session ของเครื่องอื่นให้ด้วย (`switched`) — แม่นกว่าปล่อยให้
  ค้างจนถึง heartbeat ครั้งสุดท้ายของเครื่องนั้น
- heartbeat **ซ่อมตัวเอง** — ฟอนต์ที่ active อยู่แต่ไม่มี session ค้าง จะถูกเปิดให้
- `at` รับเวลาย้อนหลังจากคิวออฟไลน์ · `clampTime()` บีบอนาคต→ตอนนี้ · เก่ากว่า 7 วัน→บีบขึ้น

**เดิมเก็บไว้เฉย ๆ ไม่ได้คิดเงิน — เปลี่ยนแล้วใน C1e ด้านล่าง**

**พิสูจน์แล้ว 11 ข้อ + ตรวจตัวเลขในตารางจริง:** คิวย้อนหลัง 3 ชม. → ได้ 180.0 นาทีเป๊ะ ·
แจ้งย้อนหลัง 60 วัน → ถูกบีบเหลือ 10080 นาที (7 วัน) พอดี · เวลาอนาคต → บีบเป็น 0

---

## ✅ C1e — 38% คิดจากระยะเวลาจริงแล้ว (เสร็จ 3 ส.ค. 2569, `0082`)

เจ้าของเคาะให้สลับตัวคิดเงินจาก **"จำนวนวันที่เคยเปิด"** → **"ระยะเวลาที่เปิดใช้จริง"**

- RPC `subscription_month_data` อ่านจาก `stream_sessions` เป็นวินาที แทน `stream_days`
  · ตัดขอบเดือนด้วย `least`/`greatest` → session คร่อมเดือนถูกแบ่งให้ถูกเดือน
  (ปัญหาที่ font-days ไม่เคยมี เพราะวันเป็นหน่วยไม่ต่อเนื่องอยู่แล้ว)
- **`font_days` → `font_seconds`** ทั้ง RPC · `subscription-revenue.ts` · UI (แสดงเป็น ชม./นาที)
- **สูตรถ่วงน้ำหนัก `sum(x/total)/N` ไม่เปลี่ยนแม้แต่ตัวอักษรเดียว** — เปลี่ยนแค่หน่วยของ `x`
- **🔴 ขอบเดือนยึดเวลาไทยทั้ง RPC แล้ว** — ของเดิม `revenue`/`subscriber_count` ใช้
  `v_start::timestamptz` = เที่ยงคืน **UTC** = 07:00 น. ไทย เหลื่อมอยู่ 7 ชม.
  ยังไม่เคยแสดงผลเพราะยังไม่มี subscription จริง · แก้ตอนนี้ได้ฟรี
- ถ้อยคำ `/designer-agreement` ข้อ 4 เปลี่ยนเป็น "ระยะเวลา" + **เพิ่มการเปิดเผยข้อจำกัด
  การวัด** (ขาดการติดต่อ → นับถึงการแจ้งครั้งสุดท้าย · ไม่ใช่การติดตามแบบทันที)
  — เขียนกันข้อพิพาทภายหลัง · `SubscriptionRevenue.tsx` แก้คำอธิบายบนจอให้ตรงกัน
- **ไม่ต้อง `legal:freeze`** — คนเดียวที่เซ็นคือ `montonn@outlook.com` (552 Studio)
  ซึ่งเป็นบัญชีของเจ้าของเอง · `pompuai` ยังไม่เซ็น

**⚠️ `stream_days` ไม่ใช่แหล่งเงินอีกต่อไป แต่ยังถูกเขียนและห้ามลบ** —
หน้า `/admin/members` ใช้เทียบกับ `sub_download_logs` เป็นสัญญาณ "โหลดมากแต่ใช้จริงน้อย"
ใครมาไล่แก้ตัวเลขเงินทีหลัง อย่าหลงไปแก้ที่ตารางนั้น

**พิสูจน์ด้วยข้อมูลสังเคราะห์ ตัวเลขตรงกับที่คำนวณมือทุกตัว:**

| เคส | ผล |
|---|---|
| A ใช้ 1 ฟอนต์ 8 ชม. · B ใช้ 10 ฟอนต์ 8 ชม. | AA = **0.500000** · ของ B ตัวละ **0.05** รวม **0.500000** · รวมทุกตัว **1.000000** |
| session คร่อมเดือน 32 ชม. | พ.ค. **4 ชม.** / มิ.ย. **28 ชม.** |
| 1 มิ.ย. 03:00 น. ไทย (= 31 พ.ค. 20:00 UTC) | เข้าเดือน **มิถุนายน** ไม่ใช่พฤษภาคม |
| session ยังเปิดอยู่ (`ended_at` null) | นับถึง `last_seen_at` = 2 ชม. ไม่โตตาม `now()` |
| redact ของ `0057` | `opted_fonts.length` 22 = 22 · designer เห็นเฉพาะฟอนต์ตัวเอง 1 ตัว |

---

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

**ก่อนเริ่ม:** ~~ติดตั้ง Rust toolchain (`rustup`)~~ ✅ ติดตั้งแล้ว (rustc 1.97.1, 3 ส.ค. 2569) ·
เคาะชื่อแบรนด์แล้ว: **`com.typedee.app` / Typedee / typedee.com** —
**bundle identifier ตั้งได้โดยไม่ต้องมีโดเมนในมือ** (Apple/Windows ไม่ตรวจความเป็นเจ้าของ)
แต่ `BRAND_DOMAIN` ที่ประทับลงไฟล์ต้องรอโดเมนจริง → แผนเต็มที่ `~/.claude/plans/c2-glistening-papert.md`

`desktop/` (Tauri v2 + Vite + React + TS + Tailwind) — API ฝั่ง server พร้อมใช้แล้วจาก C1
- [x] scaffold Tauri v2 (`desktop/`, 3 ส.ค. 2569)
- [ ] Auth: **GoTrue REST จาก Rust ตรง ๆ ไม่ใช้ supabase-js** + `keyring`
      (แก้จากแผนเดิม: ภัยที่ C1b ปิดไปคือ "session อยู่ใน storage ที่ JS อ่านได้ → ก๊อป token
      ยิง endpoint ตรง" · webview ของ Tauri ก็เปิด devtools ได้ การเอา supabase-js เข้ามา
      คือทำแผลเดิมซ้ำในที่ที่แก้ได้ฟรี · เว็บใช้ email/password ล้วน ไม่มี OAuth ให้ต้องรองรับ)
- [ ] Vault (`src-tauri/src/vault.rs`): **เก็บ blob จาก server ดิบ ๆ ไม่เข้ารหัสซ้ำ** —
      `salt‖iv‖ct‖tag` ที่ `encryptForDevice` ส่งมาคือ vault format อยู่แล้ว จึงไม่ต้องมี key
      ตัวที่สอง และได้คุณสมบัติฟรี: **ถอนอุปกรณ์ = vault กลายเป็นขยะทันที** ·
      ถอดตอน activate, ลบตอน deactivate/exit + sweep
- [ ] Font registration: Windows `AddFontResourceExW(path,0)` (**flag 0 ไม่ใช่ `FR_PRIVATE`**)
      + `SendNotifyMessageW`+WM_FONTCHANGE (**ไม่ใช่ `SendMessage` ซึ่งค้างถ้ามีแอปไม่ตอบ pump**) /
      macOS `CTFontManagerRegisterFontsForURLs` **scope `Persistent` (=2)**
      🔴 **แก้จากที่เคยเขียนว่า "session"** — `Session` deprecated และ `Process` = เห็นแค่แอปเรา
      (ไร้ประโยชน์) ตัวที่ทำให้ Illustrator/Figma เห็นคือ `Persistent`
      **แลกกับ: อยู่ข้ามการรีบูต → sweep ตอน launch เป็นข้อบังคับ ไม่ใช่ nice-to-have**
- [ ] Lifecycle: launch→**sweep**→restore→status→register→`claim_activation`→`session_start`
      / **`last_tick` 60 วิ (local) + heartbeat 30 นาที** — ไม่ใช่ timer 6 ชม.ตามแผนเดิม เพราะ
      `last_tick` แก้เรื่องเครื่องดับดีกว่าอยู่แล้ว heartbeat จึงเหลือหน้าที่เป็น poll ของ
      แย่งสิทธิ์/หมดอายุ/online/grace · 6 ชม. = "ถูกแย่งสิทธิ์แล้วยังใช้ต่อได้อีก 6 ชม."
      = เพดาน 2 เครื่องแทบไม่มีความหมาย
      / offline grace 7 วัน (**= `MAX_BACKDATE_DAYS` ของ `clampTime()` ไม่ใช่ตัวเลขทางธุรกิจ**
      ปล่อยยาวกว่านี้ event จะถูกบีบขึ้นมา = รายงานเวลาผิดในทางที่ designer ได้เกินจริง)
      / สิทธิ์หมด→deactivate
- [ ] **🔴 การจับเวลา — พลาดตรงนี้แล้วเงินรั่วเงียบ ๆ ไม่มี error ให้เห็น:**
      - **`session_start` ทันทีที่ activate** ไม่ใช่รอ timer · เดิมถ้า activate 09:05 แล้ว
        deactivate 11:00 ส่วน heartbeat รอบถัดไป 15:00 ฟอนต์นั้นจะไม่อยู่ในรายการแล้ว
        = **ไม่เคยถูกบันทึกเลย** ทั้งที่ลูกค้าใช้จริง 2 ชั่วโมง
      - **`session_end` ทันทีที่ deactivate / signout / ปิดแอป** พร้อม `reason`
        (เรียกได้แม้ถูกเครื่องอื่นแย่งสิทธิ์ไปแล้ว — ไม่ติดประตู active device โดยตั้งใจ)
      - **คิวออฟไลน์:** เก็บเหตุการณ์พร้อม timestamp จริงไว้ในเครื่อง ส่งเมื่อกลับมาออนไลน์
        ผ่านพารามิเตอร์ `at` · server บีบด้วย `clampTime()` (อนาคต→ตอนนี้ · เก่ากว่า 7 วัน→บีบขึ้น)
        **ไม่มีคิว = ทำงานตอนเน็ตหลุดแล้ว designer ไม่ได้เงินช่วงนั้น**
      - heartbeat เหลือหน้าที่ **ต่ออายุ `last_seen_at` + ต่อวันให้ฟอนต์ที่ยังเปิดค้างข้ามวัน**
        ระยะ heartbeat จึงกำหนดแค่ *ความคลาดเมื่อเครื่องดับดื้อ ๆ* ไม่ใช่ความแม่นตอนใช้งานปกติ
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
