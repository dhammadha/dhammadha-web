# DHAMMADHA — แผนพัฒนาแพลตฟอร์มตลาดฟอนต์ไทย

> อัปเดตล่าสุด: 12 ก.ค. 2026 — **งานโค้ด Phase 0–3 + Phase 4.2/4.3 เสร็จครบแล้ว**
> + แก้ 5 บั๊ก/ฟีเจอร์ quote-to-cash จากการทดสอบจริงของ user (ดูข้อ 12 ก.ค.)
> (เหลือโค้ดเฉพาะ 4.1 Subscription ที่รอข้อมูลขายจริง + waitlist ตามแผน)
> ที่เหลือเป็นงานปฏิบัติการ (ย้ายฟอนต์, อีเมล, DNS, ตั้งค่า Stripe, ทดสอบด้วย
> บัญชีจริง) — ดู "เช็คลิสต์ตามงาน" ด้านล่าง

## ✅ เช็คลิสต์ตามงาน (อัปเดตตรงนี้เมื่อทำเสร็จ)

### งานโค้ด — เสร็จแล้วทั้งหมด
- [x] ระบบอีเมล production + hardening (0.1)
- [x] ปิดช่องโหว่ไฟล์ฟอนต์เต็ม — private bucket + `font_files_private` (0.2)
- [x] Type tester แบบ obfuscated + ปุ่ม ⚡ generate ในฟอร์ม (0.3, 1.2)
- [x] หน้า recruit / ข้อตกลง designer + ติ๊กตอนสมัคร / Legal 3 หน้า (1.3, 1.4, 1.8)
- [x] ฟอนต์ฟรี login gate + PDPA consent + subscription waitlist (1.6, 1.7)
- [x] `_headers` + legacy redirect + แก้ Nav search 404 (1.9 ส่วนโค้ด)
- [x] Designer onboarding: การ์ด checklist บน dashboard + gate กันเพิ่มฟอนต์ก่อนตั้ง slug (1.5)
- [x] Admin publish checklist: ปุ่ม "ตรวจ & Publish" ใน Font Review เช็คไฟล์/ข้อมูลครบก่อน (1.5)
- [x] Migrations ครบ: 0028 (protect files), 0029 (tester/waitlist/consent), 0031 (แก้ regression sale_end) — apply บน DB จริงแล้วทั้งหมด
- [x] **Phase 2 quote-to-cash ทั้งชุด** (10 ก.ค. 2026): migration 0032 (orders/entitlements/download_logs + RPC + ปิดช่องโหว่ bucket fonts-full ที่ user login อ่านได้), Edge Function `download-font` (ตรวจสิทธิ์ + stamp license + limit 30/วัน — deploy แล้ว), ปุ่ม "ยืนยันรับชำระ" ในหน้า quotes ทั้ง designer/admin, อีเมลส่งมอบอัตโนมัติ, หน้า "ดาวน์โหลดของฉัน" ใน /account, หน้า /verify สาธารณะ — ทดสอบ DB layer + หน้าเว็บแล้ว (รอทดสอบ e2e กับไฟล์จริงบน production)
- [x] **Phase 3 Stripe checkout ทั้งชุด** (10 ก.ค. 2026): migration 0033 (orders เพิ่ม source/provider_session_id/ส่วนแบ่ง 75-25 + RPC `create_checkout_order` idempotent + `checkout_order_status`), migration 0034 (แก้ grant `settings` ที่ขาด — admin บันทึกโปรโมชันไม่ได้/user login ไม่เห็นราคาโปร), `src/lib/checkout-service.ts` + Pages Functions `/api/checkout` `/api/stripe-webhook` (ตรวจลายเซ็นเอง ไม่พึ่ง Stripe SDK), ปุ่ม "ซื้อฟอนต์นี้" ใน FontDetail, หน้า `/checkout/success` — unit test 34 ข้อ + ทดสอบ DB จริง + UI จริงแล้ว (รอ user ตั้งค่า Stripe จริง)
- [x] **Phase 2 เก็บตกค้าง — เอกสาร PDF + เลขเอกสารฝั่ง DB** (11 ก.ค. 2026):
  gen PDF ใบเสนอราคา/ใบเสร็จในเบราว์เซอร์ (`src/lib/quote-doc.ts` — pdf-lib +
  Noto Sans Thai ฝังใน `public/fonts/pdf/`) + ปุ่มดาวน์โหลด/ส่งอีเมลลูกค้าใน
  PrintLightbox (email type `document` แนบ base64, ตรวจสิทธิ์ + lookup ผู้รับ
  ฝั่ง server), เลข QT/RC ออกผ่าน RPC `issue_quote_doc` (migration 0035 —
  atomic/idempotent/seed counter), 0036 ปิด NULL-role bypass ใน
  `confirm_quote_paid`, ข้อมูลผู้ขายดึงจาก designer เจ้าของ quote
- [x] **Phase 4.2 Revenue & Payout** (11 ก.ค. 2026): ตาราง `payouts`
  (migration 0037 — 1 แถว/designer/เดือน), `src/lib/revenue.ts` (B2C หัก 25/75,
  B2B รับตรง 100% แยกหมวด), `/admin/revenue` (เห็นบัญชีธนาคาร + บันทึกจ่าย/
  ยกเลิก + กลุ่มยอดสตูดิโอ), `/designer/revenue` (statement + สถานะจ่าย) —
  ทุก query ใช้ `src/lib/fetch-all.ts` กันเพดาน 1000 แถว PostgREST
- [x] **Phase 4.3 Analytics + Search** (11 ก.ค. 2026): ตาราง `font_events`
  (migration 0038 — view/free_download, กัน spoof user_id, designer เห็นเฉพาะ
  ของตัวเอง, kind ขยายรับ subscription metrics ได้), `src/lib/track.ts`
  (dedupe 1 view/ฟอนต์/วัน ผ่าน localStorage), หน้า `/designer/analytics`
  ("สถิติ" ใน sidebar), `/fonts` filter bar บรรทัดเดียว (ค้นหาชื่อ/tag/designer +
  dropdown หมวดหมู่/ราคา ฟรี/ลดราคา)
- [x] **Designer ออกใบเสนอราคา/ใบเสร็จเองได้** (11 ก.ค. 2026, integrate จาก
  worktree): หน้า `/designer/quotes` ครบวงจร (ออกเลข → พรีวิว → PDF → อีเมล)
  เหมือน admin, migration 0039 ขยายสิทธิ์ `issue_quote_doc` เป็น admin หรือ
  designer เจ้าของ quote (+ กัน null-role ด้วย coalesce แบบ 0036), quote form
  เก็บ `tier.name` แทน index `custom_N` (ราคาไม่เพี้ยนเมื่อ designer แก้ tiers),
  แก้ print CSS PrintLightbox ที่พิมพ์ได้หน้าเปล่า / งานแทรกที่เสร็จแล้ว:
  แก้ quote insert error ที่ถูกกลืนเงียบ (`c78515a`)
- [x] **แก้ quote-to-cash 5 จุดจากการทดสอบจริง** (12 ก.ค. 2026, commit `37cf17f`,
  ทำแบบ multi-agent ตาม `.claude/subagents.md`):
  1. ขอใบเสนอราคาไม่ได้ตอน login ค้าง — root cause: ไม่เคย `grant insert on
     quotes to authenticated` (มีแค่ anon) → admin/designer โดน permission
     denied ก่อนถึง RLS (migration 0042)
  2. ยืนยันรับชำระรวมเป็นปุ่มเดียว — `confirm_quote_paid` ออกใบเสร็จ RC
     อัตโนมัติ + คืน `receipt_no` → หน้า quotes gen PDF ใบเสร็จแล้วส่งอีเมล
     `delivery` ฉบับเดียวแนบไฟล์ + ลิงก์ดาวน์โหลด (ลบปุ่ม "ออกใบเสร็จ" แยกทิ้ง);
     ยอดดึงจาก quote ที่ออกแล้ว ไม่กรอกมือ
  3. `IssueQuoteModal` ใหม่ — ตรวจ/แก้ราคา + ใส่ส่วนลด (บาท) ก่อนออกใบเสนอราคา
     ผ่าน RPC `issue_quotation_priced` ใหม่ (เก็บ fonts_detail+discount+total
     บน quote) ส่วนลดไหลไปทั้งใบเสนอราคา/ใบเสร็จ/อีเมล (migration 0043)
  4. license label กลาง `src/lib/license.ts` `licenseLabel()` แทน raw
     `large_agency` ทุกจุด (list/detail/modal/MyDownloads/email)
  5. ลบใบเสนอราคาได้จริง — grant delete + policy `designer delete own
     quotes` (migration 0042) + เพิ่มปุ่มลบหน้า designer + เช็ค error จริง
  6. **0044** เก็บตกจาก Verifier review: `confirm_quote_paid` ยึดราคาจาก
     `fonts_detail` ที่บันทึกไว้เป็นหลัก (กัน client แก้ยอด) + backfill ให้
     quote เก่าที่ไม่มี fonts_detail — ใบเสร็จตรงกับยอดที่ชำระเสมอ
  **ตัดสินใจ:** อีเมล delivery คงโชว์ `total_amount` (gross ไม่หัก WHT 3%)
  เพราะอีเมลเดียวกันใช้ร่วมกับ B2C Stripe checkout ที่ไม่มี WHT — ใบเสร็จ PDF
  ยังคำนวณ WHT ตามเดิม (ราคาต่างกันโดยตั้งใจ ไม่ใช่บั๊ก)
  **ทดสอบแล้ว:** build + tsc source ผ่าน, migrations apply จริงบน DB +
  verify grants/policy/RPC/columns ผ่าน execute_sql, หน้า /quote render ไม่มี
  console error. **ยังไม่ทดสอบ e2e ด้วย login จริง** (ดูข้อทดสอบด้านล่าง)

### งานปฏิบัติการที่เหลือ (เรียงตามลำดับที่ควรทำ)

- [ ] **ทดสอบ flow quote-to-cash ที่เพิ่งแก้ (12 ก.ค. 2026)** ด้วยบัญชีจริง:
  (1) login เป็น designer/admin แล้วขอใบเสนอราคา (เดิม error ต้อง logout ก่อน)
  (2) ออกใบเสนอราคาพร้อมใส่ส่วนลด → เช็ค PDF โชว์ส่วนลด + ยอดถูกต้อง
  (3) กดยืนยันรับชำระ → เช็คว่าลูกค้าได้อีเมล 1 ฉบับ แนบไฟล์ใบเสร็จ + ยอดตรง
  กับใบเสนอราคา (4) ลบใบเสนอราคาของตัวเอง (designer) → ลบได้จริง
- [ ] **ทดสอบ 5 flow บน production** — ดูรายละเอียดข้อ 0.6
  (signup→apply designer / promote+อีเมล / ตั้งร้าน+เพิ่มฟอนต์ / publish+tester / quote+อีเมล)
- [ ] **ทดสอบฟีเจอร์ใหม่ด้วยบัญชีจริง** (DB/RPC ทดสอบผ่านหมดแล้ว — เหลือหน้า UI
  ที่ต้อง login): (1) `/designer/quotes` ออกใบเสนอราคา → ดาวน์โหลด PDF →
  ส่งอีเมลลูกค้า (2) `/admin/revenue` บันทึกจ่ายแล้ว/ยกเลิกการบันทึก
  (3) `/designer/revenue` + `/designer/analytics` แสดงตัวเลขถูกต้อง
  (4) เลขเอกสารใบแรกต้องเป็น QT-2569-0001 (รีเซ็ต counter แล้ว
  เพราะยังไม่มีเอกสารจริงในระบบ)
- [ ] **ย้ายฟอนต์ 35 ตัว** — ต่อฟอนต์: เตรียมรูป cover 1280×720 (ไม่มีขอบในไฟล์รูป),
  ตั้งชื่อไฟล์เต็ม `ชื่อ-weight.otf`, กรอกฟอร์ม → เลือกไฟล์เต็ม → กด ⚡ → บันทึก →
  ตรวจใน Font Review → Publish → ครบชุดแล้วกด Publish เว็บไซต์ (rebuild) ทีเดียว
- [ ] **Zoho Mail ตั้ง info@dhammadha.com** — สมัคร Zoho Mail free → verify domain
  (เพิ่ม TXT ใน Cloudflare DNS) → เพิ่ม MX records 3 ตัวของ Zoho → สร้าง mailbox
  → ทดสอบส่ง-รับ → (ถ้าใช้ Apple Mail: อัปเกรด Mail Lite ~US$1/เดือน เพื่อเปิด IMAP)
- [ ] **DNS cutover ไป dhammadha.com** — ทำตามลำดับ: (1) เพิ่ม custom domain ใน
  Cloudflare Pages (2) ตั้ง CNAME/A ชี้ Pages (3) **อัปเดต Supabase → Auth →
  URL Configuration: Site URL + Redirect URLs เป็นโดเมนจริง** (ลืม = ลิงก์ยืนยัน
  อีเมล/รีเซ็ตรหัสพัง) (4) อัปเดต Turnstile hostname ถ้าจำกัดโดเมนไว้
  (5) ทดสอบ login/signup บนโดเมนจริงทันที
- [ ] **ประกาศเปิดตัว + เริ่มชวน designer** ผ่าน `/become-a-designer`
- [ ] **ทดสอบ Phase 2 e2e กับไฟล์จริง** — สร้าง quote → ยืนยันรับชำระ → เช็คอีเมลลูกค้า →
  login ด้วยอีเมลลูกค้า → ดาวน์โหลดจาก /account → เปิดไฟล์ใน Font Book ดู License
  Description ต้องมีเลข order → เลขนั้นตรวจผ่านที่ /verify
- [ ] **ตั้งค่า Stripe (Phase 3)** — ทำตามลำดับ:
  (1) สมัคร/เปิดบัญชี Stripe ประเทศไทย + เปิดใช้ **PromptPay** ใน Dashboard →
  Settings → Payment methods (ถ้ายังไม่เปิด ปุ่มซื้อจะ error ตอนสร้าง session)
  (2) Cloudflare Pages → Settings → Environment variables เพิ่ม:
  `STRIPE_SECRET_KEY` (sk_live_... หรือ sk_test_... ทดสอบก่อน),
  `STRIPE_WEBHOOK_SECRET` (จากข้อ 3), `SUPABASE_SERVICE_ROLE_KEY`
  (Supabase → Settings → API — ตัวเดียวกับที่ Edge Function ใช้)
  (3) Stripe Dashboard → Developers → Webhooks → Add endpoint:
  URL = `https://dhammadha.com/api/stripe-webhook` เลือก event
  `checkout.session.completed` + `checkout.session.async_payment_succeeded`
  → copy Signing secret (whsec_...) ไปใส่ข้อ 2
  (4) ทดสอบ test mode: ซื้อฟอนต์ด้วยบัตรทดสอบ 4242... → เช็คอีเมล →
  /account เห็นไฟล์ → ดาวน์โหลด → /verify ผ่าน → order มี platform_amount 25%
  (5) สลับเป็น live keys + webhook ใหม่ของ live mode
- [ ] **เปิด Turnstile กลับบนฟอร์ม quote** — ตอนนี้ถูกปิดชั่วคราว (commit
  `fdee19a` ถอด widget + `69bb091` server ข้ามตรวจเมื่อไม่มี token)
  ขั้นตอน: สร้าง site ใน Cloudflare Turnstile → ตั้ง
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Pages build env) + `TURNSTILE_SECRET_KEY`
  (Pages Function env) → คืน widget ในฟอร์ม quote + เอา bypass ฝั่ง server ออก
  → ทดสอบส่งฟอร์มบน production

เอกสารนี้อธิบายแผนงานทั้ง 5 เฟสอย่างละเอียด: แต่ละอย่างคืออะไร ทำไปทำไม
ทำงานยังไง และเสร็จเมื่อไหร่ถึงเรียกว่า "เสร็จ" — เขียนไว้ให้กลับมาอ่านแล้ว
เข้าใจได้โดยไม่ต้องไล่ประวัติแชท

---

## ภาพรวมธุรกิจ (ตัดสินใจแล้ว)

| เรื่อง | ข้อสรุป |
|---|---|
| รายได้หลัก | **B2C ขายรายฟอนต์** ผ่านเว็บ — designer ได้ 75% / เว็บได้ 25% (เว็บแบกค่า payment gateway เองจากส่วน 25% นั้น) |
| B2B quote | เป็น **เครื่องมืออำนวยความสะดวกให้ designer** ไม่ใช่รายได้เว็บ — ลูกค้าองค์กรโอนเงินเข้าบัญชี designer ตรง เว็บช่วยรวบรวมคำขอ + ออกเอกสารให้ (ยกเว้นฟอนต์ของ DHAMMADHA เองที่เงินเข้าสตูดิโอ) |
| Subscription | แผนระยะยาว — ลูกค้าจ่ายรายเดือน เข้าถึงทุกฟอนต์ที่ designer เลือกเข้าร่วม / เว็บ 50% + pool designer 50% แบ่งตามการใช้งานจริง |
| ฟอนต์ฟรี | ดึง traffic + ดึง designer สายฟอนต์ฟรีเข้าแพลตฟอร์ม + บังคับ login ก่อนโหลดเพื่อเก็บ email list |
| ภาษี | ยังไม่จด VAT — ออกใบเสร็จรับเงินเท่านั้น จดบริษัทเมื่อธุรกิจแข็งแรง |

## สถาปัตยกรรมระบบ

```
ผู้ใช้ (browser)
   │
   ├── หน้าเว็บ static (Next.js output:export) ── Cloudflare Pages (ฟรี)
   │        └─ อ่านข้อมูลตรงจาก Supabase ด้วย anon key (RLS คุมสิทธิ์)
   │
   ├── /api/send-email ───────────────────────── Cloudflare Pages Function
   │        └─ ส่งอีเมลผ่าน Resend + ตรวจ Turnstile + lookup ผู้รับจาก DB
   │
   └── ไฟล์ต่าง ๆ ──────────────────────────────── Supabase Storage
            ├─ public: covers, previews, specimens, fonts-demo, fonts-free
            └─ private: fonts-full (เข้าถึงผ่าน signed URL เท่านั้น — Phase 2)
```

**หลักการสำคัญ 3 ข้อ:**

1. **RLS (Row Level Security) ใน Supabase คือแนวป้องกันจริง** — การซ่อนปุ่ม
   ฝั่งหน้าเว็บเป็นแค่ UX ใครก็ยิง API ตรงได้เสมอ ดังนั้นทุกตารางต้องตั้ง
   policy ว่า role ไหนเห็น row ไหนได้
2. **เว็บเป็น static เพื่อให้ต้นทุนเกือบศูนย์** — ส่วนที่ต้องมี server จริง ๆ
   (ส่งอีเมล, ตรวจสิทธิ์ดาวน์โหลด, รับ webhook จ่ายเงิน) ใช้ Pages Functions
   เป็นจุด ๆ ไป ไม่ต้องย้ายทั้งเว็บเป็น SSR
3. **Publish = rebuild ทั้งเว็บ** (~2 นาที) — ยอมรับได้ที่ scale ปัจจุบัน
   ถ้าอนาคตฟอนต์เยอะจน build ช้า ค่อยพิจารณา SSR/ISR (Phase 4)

---

# Phase 0 — ซ่อมฐานราก ✅ (โค้ดเสร็จ 8 ก.ค. 2026)

เป้าหมาย: อุดช่องโหว่ที่ทำให้ "ขายจริงไม่ได้/อันตราย" ก่อนเอาของจริงขึ้นระบบ

## 0.1 ระบบอีเมล — ย้ายไป Cloudflare Pages Function

**ปัญหาเดิม:** โปรเจกต์ build แบบ `output: "export"` (static HTML ล้วน)
ซึ่ง Next.js จะ**ตัด API route ทิ้งทั้งหมด** — โฟลเดอร์ `out/` ที่ deploy ขึ้น
Pages ไม่มี `/api/send-email` อยู่เลย ผลคือบนเว็บจริง การส่ง quote และอีเมล
แจ้ง designer **ล้มเหลวเงียบ ๆ มาตลอด** (ทำงานเฉพาะตอน `next dev` ในเครื่อง)

**วิธีแก้:** Cloudflare Pages มีฟีเจอร์ "Pages Functions" — ไฟล์ในโฟลเดอร์
`functions/` ที่ repo root จะถูก deploy เป็น serverless function คู่กับ
static site อัตโนมัติ โดย path ตรงกับตำแหน่งไฟล์:

- `functions/api/send-email.ts` → รับ `POST /api/send-email` บน production
- `src/app/api/send-email/route.ts` → ตัวเดิม เหลือไว้ใช้ตอน dev เท่านั้น
- `src/lib/email-service.ts` → logic กลางที่สองตัวบนเรียกใช้ร่วมกัน
  (template อีเมล, validation, การส่งผ่าน Resend)

**ความปลอดภัยที่เพิ่มเข้ามาพร้อมกัน:**

- **Escape HTML ทุก field** — ข้อความที่ลูกค้ากรอก (ชื่อ, หมายเหตุ ฯลฯ)
  ถูกแปลงอักขระพิเศษก่อนใส่ลงอีเมล กันการฝัง HTML/ลิงก์ปลอม
- **ผู้รับอีเมลถูก lookup ฝั่ง server** — เดิม client ส่ง `designer_email`
  มาเองใน payload แปลว่าใครก็ยิง API เพื่อส่งอีเมลปลอมในนาม
  `noreply@dhammadha.com` ไปหาใครก็ได้ (open relay) ตอนนี้ client ส่งแค่
  `designer_id` แล้ว server ไปดึงอีเมลจริงจากตาราง `users` เอง
- **อีเมล promote ต้องเป็น admin จริง** — ต้องแนบ Supabase access token
  และ server ตรวจ role กับฐานข้อมูลผ่าน `get_my_role()` ก่อนส่ง
- **Cloudflare Turnstile** (กล่องกันบอท) บน quote form — เปิดใช้เมื่อตั้ง
  env `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
  ถ้าไม่ตั้ง ระบบข้ามการตรวจให้ (dev ยังใช้ได้ปกติ)

**Env ที่ Pages Function ต้องมี:** `RESEND_API_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_ADMIN_EMAIL` (+ Turnstile 2 ตัวถ้าเปิดใช้)

## 0.2 ปิดช่องโหว่ไฟล์ฟอนต์เต็ม

**ปัญหาเดิม (ร้ายแรงที่สุดที่พบ):** URL ไฟล์ฟอนต์เต็มถูกเก็บใน column
`full_font_files` ของตาราง `fonts` ซึ่งเปิดให้ anon (คนไม่ login) SELECT
ได้ทั้ง row และ bucket `fonts-full` เป็น public — สรุปคือ**ใครก็ตามที่เปิด
DevTools หรือยิง Supabase REST API ได้ URL โหลดฟอนต์เต็มฟรีทุกตัว**

**วิธีแก้ (migration `0028_protect_full_font_files.sql`):**

1. สร้างตาราง **`font_files_private`** — เก็บ path ไฟล์เต็มแยกจากตาราง
   `fonts` โดย RLS อนุญาตเฉพาะ **เจ้าของฟอนต์ (owner_id) และ admin**
   ไม่ grant อะไรให้ anon เลย
2. เก็บเป็น **storage path** (เช่น `suratana/suratana-bold.otf`) แทน URL
   เต็ม — เพราะ bucket private ไม่มี public URL อยู่แล้ว และ path นี้คือ
   สิ่งที่ใช้สร้าง signed URL ตอนขายจริงใน Phase 2
3. ย้ายข้อมูลเดิมอัตโนมัติ (แปลง URL → path) แล้วล้าง column เก่าในตาราง
   `fonts` ให้เป็น null ทั้งหมด (รวม `obfuscated_*` ที่ค้างจากยุค Firebase)
4. สั่ง `update storage.buckets set public = false where id = 'fonts-full'`
   — URL เก่าที่เคยหลุดไปจะใช้ไม่ได้อีก

**ผลต่อโค้ด:** FontForm อ่าน/เขียนไฟล์เต็มผ่านตารางใหม่, อัปโหลดไฟล์เต็ม
ได้ path กลับมาแทน URL (`uploadProtectedFile` ใน `storage.ts`)

**สิ่งที่ต้องรู้:** bucket public ที่เหลือ (covers, previews, specimens,
fonts-demo, fonts-free) **ตั้งใจให้ public** เพราะหน้าเว็บต้องใช้แสดงผล

## 0.3 Type tester (ทดสอบฟอนต์บนหน้าเว็บ) — ปรับใหม่ใน Phase 1

**สาเหตุจริงที่ไม่ทำงาน:** โค้ดเดิมรอไฟล์จาก `obfuscated_font_files`
ซึ่ง**ไม่มีระบบไหน generate เลย** (เป็นแนวคิดค้างจากเว็บเก่ายุค Firebase)
ฟอนต์ขายทุกตัวเลยไม่มีไฟล์ให้ tester โหลด

**ทางแก้สุดท้าย (Phase 1):** สร้างระบบ obfuscation ขึ้นจริงตามแนวคิดเดิม —
tester แสดง**ฟอนต์จริงครบทุก weight** จากไฟล์ที่ผ่านการ "สลับรหัสอักษร"
(ดู 1.2) ถ้าฟอนต์ไหนยังไม่มีไฟล์ tester จะ fallback ไปใช้ไฟล์ demo แทน
จำนวน weight บนหน้าเว็บแสดงจาก `weight_count` ที่นับจากไฟล์เต็มตอนบันทึก

## 0.4 กรอบดำบนรูป cover ใน slider — ไม่ใช่ bug

ตรวจ pixel ของรูปแล้ว: เส้นขอบสีเทาเข้ม (RGB 76,76,76) **อยู่ในไฟล์รูป
ทดสอบเอง** ทั้ง 4 ด้าน ส่วน CSS ไม่มี border — รูปจริงที่ export มาไม่มีขอบ
จะไม่เจอปัญหานี้

## 0.5 Code quality

- **AuthContext loading race** — ตอนเปิดเว็บครั้งแรก `fetchRole` ไม่เคลียร์
  สถานะ loading → เพิ่ม `.finally(() => setLoading(false))`
- **Nav กระพริบ** — ระหว่างเช็ค session เดิมแสดงปุ่ม "เข้าสู่ระบบ" แวบหนึ่ง
  ก่อนเปลี่ยนเป็น avatar → ตอนนี้แสดง placeholder กลม ๆ จนกว่าจะรู้ผล
- **หน้า admin เงียบเมื่อ error** — โหลด/ซ่อน/ลบฟอนต์ล้มเหลวแล้วไม่บอกอะไร
  → ตอนนี้ขึ้น toast แจ้ง error message
- **ลบ `console.error`** ใน production path
- **`robots.txt`** — บอก crawler ว่าเก็บหน้าไหนได้ (บล็อก /admin, /account,
  /auth) + ชี้ตำแหน่ง sitemap
- **`sitemap.xml`** — generate ตอน build จากฟอนต์ที่ publish แล้ว
  (publish ใหม่ = rebuild = sitemap อัปเดตเอง)

## 0.6 ✋ เช็คลิสต์ก่อนปิด Phase 0

- [x] Apply migration 0028 (`supabase db push`)
- [x] ตั้ง Turnstile keys ใน Pages env
- [ ] ตั้ง/ตรวจ `RESEND_API_KEY` + `NEXT_PUBLIC_ADMIN_EMAIL` ใน Pages env
- [ ] Push 3 commits (`45c8c22`, `8e8528e`, `8808b2c`) → Cloudflare deploy
- [ ] **ทดสอบ 5 flow บน production จริง:**
  1. Signup + ติ๊กสมัคร Designer + portfolio URL → application เป็น pending
  2. Admin เข้า `/admin/designers` → Promote → role เปลี่ยน + **อีเมลถึง
     designer** (ครั้งแรกที่อีเมล production จะออกจริง)
  3. Designer ตั้ง slug (lock หลังบันทึกแรก) + ข้อมูลผู้ขาย + เพิ่มฟอนต์
     พร้อมไฟล์ demo + ราคา
  4. Admin กด Publish → รอ build ~2 นาที → ฟอนต์ขึ้นเว็บ + type tester ทำงาน
  5. ขอ quote จากหน้าฟอนต์ → ผ่าน Turnstile → **อีเมลถึง designer ถูกคน**
     + ลูกค้าได้อีเมลยืนยัน + admin เห็นใน `/admin/quotes`

---

# Phase 1 — Go Live (dhammadha.com) + เปิดรับ designer

> **สถานะ (10 ก.ค. 2026):** งานโค้ดของ Phase 1 **เสร็จครบทุกข้อแล้ว**
> เหลือเฉพาะงานปฏิบัติการ — ดู "เช็คลิสต์ตามงาน" ต้นเอกสาร

เป้าหมาย: เว็บจริงบนโดเมนจริง มีฟอนต์ครบ 35 ตัว และพร้อมรับ designer
ภายนอกตั้งแต่วันแรก (ตัดสินใจแล้วว่าเปิดรับทันทีที่ live)

## 1.1 ย้ายฟอนต์ 35 ตัวจากเว็บเก่า

ทั้งหมดเป็นของ DHAMMADHA เอง — กรอกผ่าน admin form ทีละตัว
**เงื่อนไข: ทำหลัง Phase 0 ผ่านการทดสอบแล้วเท่านั้น** เพราะ (ก) ไฟล์เต็ม
จะเข้า private table อัตโนมัติผ่านฟอร์มเวอร์ชันใหม่ (ข) ทุกตัวต้องมีไฟล์
demo ไม่งั้น type tester ไม่ทำงาน (ค) รูป cover อย่าให้มีขอบในไฟล์

## 1.2 Pipeline เตรียมไฟล์ฟอนต์ ✅ (อัตโนมัติในเบราว์เซอร์ + CLI)

รับไฟล์ฟอนต์เต็มทุก weight แล้วผลิต 2 อย่าง:

1. **Tester fonts (obfuscated)** — .woff2 ทุก weight glyph ครบทุกตัว แต่ cmap
   ถูกสลับภายในหมวดอักขระเดียวกัน (พยัญชนะ↔พยัญชนะ, สระบน↔สระบน,
   วรรณยุกต์↔วรรณยุกต์ ฯลฯ เพื่อไม่ให้ shaping ไทยพัง) + `obfuscated_map.json`
   ที่เว็บใช้แปลงข้อความก่อน render — **tester จึงแสดงฟอนต์จริงครบทุก weight
   แต่ไฟล์ที่ถูกดูดไปติดตั้งจะพิมพ์ออกมาเป็นตัวมั่ว ใช้งานจริงไม่ได้**
   (ป้องกัน 100% ไม่มีจริงสำหรับฟอนต์บนเว็บ — นี่คือ deterrent ระดับเดียวกับ
   ที่ foundry ใหญ่ใช้)
2. **Demo font ดาวน์โหลด** — เฉพาะ Regular ตัด glyph เหลือภาษาไทย+เว้นวรรค
   เปลี่ยนชื่อเป็น "<ชื่อ> DEMO"

**วิธีหลัก — ในฟอร์มเลย (commit fade3a8):** เลือกไฟล์ Full Family ใน FontForm
แล้วกดปุ่ม **"⚡ สร้าง Tester + Demo อัตโนมัติ"** — ประมวลผลในเบราว์เซอร์ด้วย
fonttools ผ่าน Pyodide (โหลดครั้งแรก ~10MB จาก CDN แล้ว cache) ระบบเติมไฟล์
tester + map + demo ลงช่องให้เอง ไฟล์เต็มไม่ออกจากเครื่องระหว่างประมวลผล
(logic อยู่ที่ `src/lib/font-pipeline.ts`)

**วิธีสำรอง — CLI สำหรับงาน batch:** `pip install fonttools brotli` แล้ว
`python3 scripts/prepare_font_assets.py --slug <slug> --family "<ชื่อ>"
--out ./font-assets <ไฟล์ทุก weight>` แล้วอัปโหลดผลลัพธ์ผ่านช่อง manual ใน FontForm

## 1.3 หน้า "ร่วมเป็น Designer" (recruiting landing)

หน้าขาย value ให้ designer ที่จะเข้าร่วม จุดขายหลัก:
- **ได้ส่วนแบ่ง 75%** สูงกว่า marketplace ทั่วไป (เจ้าใหญ่ระดับโลกหัก 30–50%)
- **ระบบ quote B2B ให้ใช้ฟรี** — มีหน้าร้านของตัวเอง รับคำขอใบเสนอราคา
  ออกเอกสารได้ โดยเงิน B2B เข้าบัญชีตัวเองตรง ๆ เว็บไม่หักอะไร
- มี dashboard ยอดเข้าชม/ยอดขายของตัวเอง ไม่ต้องดูแลเว็บเอง

## 1.4 ข้อตกลง Designer (ต้องมีก่อนรับคนแรก)

เอกสารที่ designer กดยอมรับตอน onboarding ระบุอย่างน้อย:
- ส่วนแบ่ง 75/25 สำหรับ B2C + **สงวนสิทธิ์ปรับอัตราโดยแจ้งล่วงหน้า 30–60
  วัน** (สำคัญ — กันตอนจด VAT/บริษัทแล้วต้นทุนเปลี่ยน)
- ยืนยันว่าเป็นเจ้าของลิขสิทธิ์ฟอนต์ที่อัปโหลดจริง และรับผิดชอบหากละเมิด
- เงื่อนไขการถอนฟอนต์ออกจากระบบ (แจ้งล่วงหน้า, ผลต่อลูกค้าที่ซื้อไปแล้ว)
- ระบุว่าบริการ quote/เอกสาร **อาจคิดค่าบริการในอนาคต** (ฟรีช่วงเปิดตัว)

## 1.5 Onboarding + Quality checklist ✅ (10 ก.ค. 2026)

**สิ่งที่ทำจริง (ปรับจากแผน wizard เต็มรูปแบบ ให้เข้ากับหน้า Settings ที่มีอยู่แล้ว):**

- **ฝั่ง designer** (`src/components/designer/SetupGate.tsx`):
  - การ์ด "ตั้งค่าร้านของคุณให้พร้อมขาย" บน dashboard — แสดง 3 ขั้น
    (slug / ข้อมูลผู้ขาย / บัญชีธนาคาร) พร้อมสถานะ ✓ และลิงก์ไปหน้าตั้งค่า
    ซ่อนตัวเองอัตโนมัติเมื่อครบ
  - **Gate หน้าเพิ่มฟอนต์**: ยังไม่ตั้ง slug จะเพิ่มฟอนต์ไม่ได้ (บล็อกพร้อม
    อธิบายเหตุผล) — เพราะ slug เป็นส่วนหนึ่งของ URL หน้าฟอนต์ ไม่มีแล้วลิงก์พัง
- **ฝั่ง admin** (หน้า Font Review): ปุ่ม Publish เปลี่ยนเป็น **"ตรวจ & Publish"**
  เปิด checklist อัตโนมัติ — เช็คข้อบังคับ (ชื่อ, designer slug, cover, ราคา,
  ไฟล์เต็มใน private bucket / ไฟล์ฟรี) ครบถึงกด Publish ได้ และเตือนข้อแนะนำ
  (tester+map, demo, คำอธิบาย, weight_count, specimen) แบบไม่บังคับ

## แผนเดิมข้อ 1.5 (เก็บไว้อ้างอิง)

- **Wizard ฝั่ง designer:** หลัง promote ครั้งแรก บังคับให้ตั้งค่าครบใน
  flow เดียว: slug → ข้อมูลผู้ขาย/บัญชีธนาคาร → license config →
  แนะนำ spec ไฟล์ (format, ตั้งชื่อไฟล์แบบ `ชื่อ-weight.otf` เพื่อให้ระบบ
  อ่าน weight ถูก, ขนาดรูป cover 1280×720)
- **Checklist ฝั่ง admin ก่อน Publish:** ไฟล์เปิดได้จริง, glyph ไทยครบ,
  demo ไม่ใช่ไฟล์เต็ม, รูปไม่แตก/ไม่มีขอบ, ราคาสมเหตุสมผล

## 1.6 ฟอนต์ฟรี: บังคับ login ก่อนโหลด

เปลี่ยนปุ่ม "ดาวน์โหลดฟรี" ให้เช็ค session ก่อน — ถ้ายังไม่ login พาไป
สมัคร/เข้าสู่ระบบแล้วค่อยโหลด พร้อม **checkbox ยินยอมรับข่าวสาร (PDPA)**
ผลคือได้ email list สำหรับการตลาดจากกลุ่มที่สนใจฟอนต์ไทยจริง ๆ
(บันทึกการยินยอมไว้เป็นหลักฐานด้วย — เช่น column `marketing_consent_at`)

## 1.7 Pricing section → waitlist

หน้าแรกส่วน Subscription ยังโชว์ "฿XXX" ซึ่งดูไม่เสร็จ — เปลี่ยนเป็น
"เร็ว ๆ นี้" + ช่องกรอกอีเมลรอเปิดตัว ได้ประโยชน์สองต่อ: เว็บดูตั้งใจ
และ**ยอด waitlist คือข้อมูลจริงไว้ตัดสินใจราคา/จังหวะเปิด subscription**

## 1.8 หน้า Legal (จำเป็นตามกฎหมาย)

- **Privacy Policy (PDPA)** — เราเก็บชื่อ อีเมล เบอร์ ที่อยู่ เลขผู้เสียภาษี
  → เข้าข่าย พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคลแน่นอน ต้องแจ้งว่าเก็บอะไร
  ใช้ทำอะไร ลบได้อย่างไร
- **Terms of Service** — เงื่อนไขการใช้เว็บ/การซื้อ
- **Refund Policy** — สินค้า digital ปกติไม่คืนเงินหลังดาวน์โหลด แต่ต้อง
  เขียนให้ชัดก่อนขาย

## 1.9 งานเทคนิคก่อน cutover

- **Security headers** — เพิ่มไฟล์ `public/_headers` (Cloudflare Pages
  อ่านอัตโนมัติ): `X-Frame-Options: DENY`, `Referrer-Policy`,
  Content-Security-Policy เท่าที่ไม่ชนกับ AdSense/Turnstile
- **Zoho Mail** ตั้ง `info@dhammadha.com`: verify domain (TXT) → เพิ่ม MX
  records ใน Cloudflare → สร้าง mailbox → ถ้าจะใช้ Apple Mail ผ่าน IMAP
  ต้องแผน Mail Lite (~US$1/เดือน) เพราะ free tier ใช้ได้เฉพาะเว็บ
- **AdSense** — แทน placeholder ด้วย slot จริง
- **DNS cutover** — ชี้ dhammadha.com → Cloudflare Pages แล้ว **ห้ามลืม**:
  อัป Supabase Auth → Site URL + Redirect URLs เป็นโดเมนจริง (ไม่งั้นลิงก์
  ยืนยันอีเมล/รีเซ็ตรหัสพัง) + ตั้ง redirect เว็บเก่า `/:slug` → `/fonts/:slug`

---

# Phase 2 — Quote-to-cash แบบ manual (ขายได้จริงก่อนมี payment gateway)

> **สถานะ (10 ก.ค. 2026): โค้ดเสร็จครบ + apply/deploy บนระบบจริงแล้ว** —
> migration 0032, Edge Function `download-font` (สแตมป์ด้วย sfnt patcher เขียนเอง
> ใน `supabase/functions/download-font/stamp.ts` — byte-preserving ทั้ง TTF/OTF,
> ไม่ใช้ fonteditor-core เพราะมันแปลง CFF→glyf ตอน parse), ConfirmPaidModal,
> MyDownloads, /verify, อีเมล type `delivery` / เหลือทดสอบ e2e กับไฟล์จริงบน production
>
> **เก็บตกค้างเสร็จ (11 ก.ค. 2026):** PDF ใบเสนอราคา/ใบเสร็จ gen อัตโนมัติใน
> เบราว์เซอร์ (`src/lib/quote-doc.ts` — pdf-lib + Noto Sans Thai ฝังใน
> `public/fonts/pdf/`, layout เดิมของ PrintLightbox) → ปุ่ม "ดาวน์โหลด PDF" +
> "ส่งอีเมลถึงลูกค้า" (กดยืนยันเอง ไม่ auto-send, อีเมล type `document`
> ตรวจ admin + lookup ผู้รับฝั่ง server, แนบ base64 ผ่าน Resend) /
> เลขที่ QT/RC ออกผ่าน RPC `issue_quote_doc` (migration 0035 — atomic ผ่าน
> `next_doc_no`, idempotent, seed counter กันชนเลขเดิม, admin เท่านั้น) /
> ข้อมูลผู้ขายบนเอกสารดึงจาก designer เจ้าของ quote (เดิมใช้ admin ที่ login) /
> 0036 ปิดช่อง NULL-role bypass ใน `confirm_quote_paid`
>
> **เพิ่มเติม (11 ก.ค. 2026 — integrate จาก worktree):** designer ออกเอกสาร
> เองได้จากหน้า `/designer/quotes` (ออกเลข → พรีวิว PrintLightbox → ดาวน์โหลด
> PDF → ส่งอีเมลลูกค้า — ครบเหมือนฝั่ง admin) / migration 0039 ขยายสิทธิ์
> `issue_quote_doc` จาก admin-only เป็น admin **หรือ** designer เจ้าของ quote
> (`designer_id = auth.uid()`, กัน null-role ด้วย coalesce แบบเดียวกับ 0036 —
> apply + ทดสอบ rollback บน DB จริงแล้ว) / quote form เก็บ `tier.name` แทน
> index `custom_N` กันราคาเพี้ยนเมื่อ designer แก้/ลบ tiers (ฝั่งอ่านมี
> backward-compat กับค่า custom_N เดิม) / แก้ print CSS ของ PrintLightbox
> ที่พิมพ์ได้หน้าเปล่า (เปลี่ยนเป็น visibility-based isolation)
>
> **แก้ 5 จุดจากการทดสอบจริง (12 ก.ค. 2026, commit `37cf17f`):** (1) grant
> insert/delete บน `quotes` ให้ authenticated (0042) — เดิม admin/designer
> login อยู่ขอ/ลบ quote ไม่ได้เพราะ grant มีแค่ anon (2) ยืนยันรับชำระรวมเป็น
> ปุ่มเดียว — `confirm_quote_paid` ออกใบเสร็จ RC อัตโนมัติ + อีเมล `delivery`
> ฉบับเดียวแนบ PDF ใบเสร็จ (ลบปุ่มออกใบเสร็จแยก) (3) `IssueQuoteModal` +
> RPC `issue_quotation_priced` (0043) — แก้ราคา/ใส่ส่วนลดบาทก่อนออกใบเสนอราคา
> เก็บลง `quotes.fonts_detail`/`discount` (4) license label กลาง
> `src/lib/license.ts` แทน raw enum ทุกจุด (5) 0044: `confirm_quote_paid`
> ยึดราคาจาก `fonts_detail` เป็นหลัก กัน client ส่งราคาเอง + backfill quote
> เก่า — ดูรายละเอียดเต็มในเช็คลิสต์ด้านบน / **ยังไม่ทดสอบ e2e ด้วย
> login จริง**

เป้าหมาย: ปิดการขายได้ครบวงจรบนเว็บ โดยเงินยังโอนตรงเข้าบัญชี designer
(ไม่ต้องรอ Stripe) — นี่คือเฟสที่เปลี่ยนเว็บจาก "โชว์ฟอนต์" เป็น "ขายฟอนต์"

## 2.1 โครงข้อมูลใหม่ 3 ตาราง

- **`orders`** — บันทึกการสั่งซื้อ: ใครซื้อ ฟอนต์อะไร license tier ไหน
  ราคาเท่าไหร่ สถานะ (รอชำระ/ชำระแล้ว/ยกเลิก) เลขที่เอกสาร
- **`entitlements`** — "สิทธิ์" ที่เกิดหลังชำระ: user X มีสิทธิ์ดาวน์โหลด
  ฟอนต์ Y ภายใต้ license Z — **ตารางนี้คือหัวใจ** เพราะเป็นสิ่งที่ระบบเช็ค
  ก่อนออกลิงก์ดาวน์โหลด และเป็นโครงเดียวกับที่ Stripe (Phase 3) และ
  subscription (Phase 4) จะมาต่อยอด
- **`download_logs`** — ใครโหลดไฟล์ไหนเมื่อไหร่จาก IP อะไร ไว้จำกัดจำนวน
  ครั้ง/วัน และตรวจย้อนหลังถ้าไฟล์หลุด

## 2.2 เอกสาร: เลขที่ + ใบเสนอราคา/ใบเสร็จ PDF

- ระบบเลขที่เอกสารอัตโนมัติ (เช่น `QT-2026-0001`, `RC-2026-0001`)
- gen PDF จากข้อมูล quote + ข้อมูลผู้ขาย (ชื่อ/ที่อยู่/เลขภาษีของ designer
  หรือของสตูดิโอ) — designer กดปุ่มเดียวได้เอกสารส่งลูกค้า ไม่ต้องทำเอง
  ใน Excel/Word อีก

## 2.3 Flow "ยืนยันรับชำระ → ส่งไฟล์อัตโนมัติ"

```
ลูกค้าขอ quote → designer ตกลงราคา/ส่งใบเสนอราคา PDF
→ ลูกค้าโอนเงินเข้าบัญชี designer โดยตรง
→ designer กด "ยืนยันรับชำระ" ใน dashboard
→ ระบบสร้าง order (paid) + entitlement
→ อีเมลถึงลูกค้าอัตโนมัติ: ลิงก์หน้าดาวน์โหลด + ใบเสร็จ + license PDF
```

**Signed URL คืออะไร:** ลิงก์ดาวน์โหลดชั่วคราวที่ Supabase สร้างให้จาก
private bucket มีอายุสั้น (~5 นาที) และผูกกับไฟล์เดียว — ระบบจะออกให้
**หลังตรวจ entitlement แล้วเท่านั้น** ลิงก์หมดอายุก็กดขอใหม่ได้จากหน้า
"ดาวน์โหลดของฉัน" ดังนั้นต่อให้ลิงก์หลุดไปก็ใช้ได้แค่ไม่กี่นาที

## 2.4 หน้า "ดาวน์โหลดของฉัน" ใน account

ลูกค้าเห็นทุกฟอนต์ที่มีสิทธิ์ตลอดไป (จาก entitlements) กดดาวน์โหลดซ้ำได้
ไม่ต้องพึ่งลิงก์ในอีเมล — ลดภาระ support "ขอไฟล์ใหม่" ในอนาคต

## 2.5 License stamping — ประทับข้อมูลผู้ซื้อลงไฟล์ฟอนต์ตอนส่งมอบ

ไฟล์ที่ลูกค้าดาวน์โหลดหลังชำระเงิน ถูกประทับข้อมูลการซื้อลง **name table
ของ OpenType** (ช่องข้อมูลมาตรฐานที่ Font Book บน macOS, Properties บน
Windows หรือ fontdrop.info เปิดดูได้):

- **nameID 13 (License Description):** `Licensed to <ชื่อลูกค้า> —
  Order <เลขที่> — <วันที่> — via dhammadha.com`
- **nameID 14 (License URL):** ลิงก์ตรวจสอบ เช่น `dhammadha.com/verify/<เลข order>`
- **nameID 3 (Unique ID):** เลข order ฝังซ้ำอีกชั้น
- Copyright/Trademark ของ designer คงเดิม ไม่แตะ

**วิธีทำคร่าว ๆ:** Supabase **Edge Function** `download-font` —
ปุ่มดาวน์โหลดเรียก function นี้แทนการขอ signed URL จาก bucket ตรง ๆ

1. ลูกค้ากดดาวน์โหลด → เรียก function พร้อม auth token
2. function ตรวจ `entitlements` (ข้อ 2.1) ว่ามีสิทธิ์จริง
3. อ่านไฟล์ต้นฉบับจาก private bucket ด้วย service role
4. แก้ name table ด้วย lib JS เช่น `fonteditor-core`
   (Edge Function เป็น Deno — ใช้ fontTools แบบ pipeline ฝั่ง browser ไม่ได้)
5. ส่งไฟล์ที่ stamp แล้วกลับ + บันทึก `download_logs`

**ทำไมต้องฝั่ง server (ไม่ใช้ Pyodide ฝั่ง browser):** การ stamp เกิดหลัง
ตรวจสิทธิ์ในจุดที่ลูกค้าแก้ไม่ได้, ลูกค้าไม่ต้องรอโหลด Pyodide ~10MB,
และไฟล์ต้นฉบับไม่ต้องเปิดให้ client อ่านตรง

**ข้อจำกัดที่ต้องเข้าใจ:** metadata ลบ/แก้ได้ด้วยเครื่องมือ font —
นี่คือ audit trail + ตัวป้องปรามการแชร์ไฟล์ ไม่ใช่ DRM ดังนั้น
`entitlements` ใน DB ยังเป็น source of truth เสมอ / ขั้นสูงกว่า
(hidden watermark ลบยาก) อยู่ Phase 4.3

**จุดขายฝั่ง designer:** ไฟล์ที่หลุดสู่สาธารณะ trace กลับถึง order
ต้นทางได้ — ระบุไว้ในหน้า /become-a-designer แล้ว

## 2.6 ค่าบริการ

**ฟรีช่วงเปิดตัว** เพื่อดึง designer เข้าระบบ อนาคตถ้าจะคิด ให้เป็น
**fixed rate ตาม tier ยอด** (เช่น ยอดต่ำกว่า X คิด ฿99, เกิน X คิด ฿299)
— **ห้ามคิดเป็น %** เพราะยอด B2B สูง designer จะไม่อยากเข้าร่วม

---

# Phase 3 — B2C self-serve checkout (รายได้หลักของเว็บ)

เป้าหมาย: ลูกค้ารายย่อยกดซื้อ → จ่าย → ได้ไฟล์ทันที ไม่ต้องมีคนกดอะไรเลย

> **สถานะ: โค้ดเสร็จครบ + migration apply แล้ว (10 ก.ค. 2026)** — เหลืองาน
> ปฏิบัติการฝั่ง user: เปิดบัญชี Stripe + ตั้ง env + webhook (ดูเช็คลิสต์ต้นเอกสาร)
>
> **ที่สร้างจริง:**
> - `POST /api/checkout` (Pages Function) — รับ `font_id` คำนวณราคาจาก DB ฝั่ง
>   server (ราคา sale / โปรโมชันส่วนกลาง ตรงกับที่ FontDetail โชว์) → สร้าง
>   Stripe Checkout Session (PromptPay ขึ้นก่อนบัตร, THB, locale th) → redirect
> - `POST /api/stripe-webhook` (Pages Function) — ตรวจลายเซ็นด้วย WebCrypto
>   (ไม่ใช้ Stripe SDK — ไม่มี dependency เพิ่ม) → RPC `create_checkout_order`
>   (service_role เท่านั้น, idempotent ด้วย unique session id — Stripe ยิงซ้ำ
>   ได้ปลอดภัย) → ส่งอีเมล delivery ระบบเดียวกับ Phase 2 → ลูกค้าโหลดผ่าน
>   Edge Function `download-font` (ไฟล์ stamp license เหมือน order จาก quote)
> - order จาก checkout บันทึก `platform_rate/platform_amount/designer_amount`
>   (25/75) ทุกใบ — เป็นข้อมูลตั้งต้น payout Phase 4 / order จาก quote ไม่หัก
> - หน้า `/checkout/success` — poll สถานะจนกว่า webhook สร้าง order เสร็จ
>   แล้วโชว์เลขที่คำสั่งซื้อ + ผูกสิทธิ์เข้าบัญชีอัตโนมัติถ้า login อยู่
> - dev routes (`src/app/api/checkout`, `src/app/api/stripe-webhook`) สำหรับ
>   ทดสอบ local — logic ร่วมอยู่ที่ `src/lib/checkout-service.ts`
>
> **ขอบเขตที่ตั้งใจ:** ขาย self-serve เฉพาะสิทธิ์บุคคลทั่วไป — license องค์กร
> ยังไปทาง quote (B2B flow เดิม) ตามโมเดลธุรกิจ

## 3.1 Payment gateway

- ใช้ **Stripe** (หรือเทียบ Opn/Omise ตอนลงมือ) — ไม่มีค่ารายเดือน
  คิดเป็น % ต่อรายการ: บัตร ~3.65%, **PromptPay ~1.6%**
- **ดัน PromptPay เป็นช่องทางหลัก** ในหน้า checkout — ค่าธรรมเนียมถูกกว่า
  บัตรเกินครึ่ง ทำให้ส่วนแบ่งจริงของเว็บขยับจาก ~21% → ~23.4%
  (จาก 25% ที่ต้องจ่าย gateway เอง) และลูกค้าไทยคุ้นเคยอยู่แล้ว

## 3.2 Flow

```
หน้าฟอนต์ → เลือก license tier → Stripe Checkout (PromptPay/บัตร)
→ Stripe ยิง webhook มาที่ Pages Function
→ Function ตรวจลายเซ็น webhook → สร้าง order (paid) + entitlement
   (ระบบเดียวกับ Phase 2 เป๊ะ — ต่างแค่คนสร้างคือ webhook แทน designer)
→ อีเมลใบเสร็จ + ลิงก์ดาวน์โหลดอัตโนมัติ
```

## 3.3 บัญชีและส่วนแบ่ง

- บันทึกส่วนแบ่ง 75/25 ต่อ order อัตโนมัติ → เป็นข้อมูลตั้งต้นของ
  revenue/payout ใน Phase 4
- ออกใบเสร็จรับเงินอัตโนมัติ (ยังไม่ใช่ใบกำกับภาษีเพราะยังไม่จด VAT —
  โครงสร้างเอกสารเผื่อ field ภาษีไว้ เปลี่ยนทีหลังได้)

## 3.4 อัป Supabase Pro (~฿900/เดือน) เมื่อเริ่มขายจริง

เหตุผลหลักคือ **backup รายวัน** — มีข้อมูลเงิน/สิทธิ์ของลูกค้าจริงแล้ว
เสี่ยงข้อมูลหายไม่ได้ (+ storage 100GB, egress 250GB)
จุดคุ้มทุน: ยอดขายผ่านเว็บ ~฿4,500–5,000/เดือน (ที่ส่วนแบ่งสุทธิ ~21%)

---

# Phase 4 — Growth

> **สถานะ (11 ก.ค. 2026): 4.2 + 4.3 โค้ดเสร็จ + apply DB จริงแล้ว** (4.1
> Subscription รอข้อมูลยอดขายจริง + waitlist ตามแผน)
>
> **4.2 Revenue & Payout:** ตาราง `payouts` (migration 0037 — 1 แถว/designer/เดือน
> บันทึกการโอนมือ, RLS admin เขียน/designer อ่านของตัวเอง), `src/lib/revenue.ts`
> (สรุปยอดรายเดือน: B2C checkout หัก 25/75 จาก platform_amount/designer_amount,
> B2B quote รับตรง 100% แยกหมวด ไม่มี payout), หน้า `/admin/revenue` (เลือกเดือน →
> แถวต่อ designer + ยอดสตูดิโอ (order ไม่ผูก designer) → panel เห็นบัญชีธนาคาร +
> ปุ่ม "บันทึกจ่ายแล้ว"/ยกเลิก, tile "ค้างโอน" หักที่จ่ายแล้ว), หน้า
> `/designer/revenue` (statement รายเดือน + สถานะจ่าย + note เลขอ้างอิงสลิป)
>
> **4.3 Analytics + Search:** ตาราง `font_events` (migration 0038 — kind
> view/free_download ขยายรองรับ subscription metrics อนาคตได้, anon insert +
> กัน spoof user_id, designer เห็นเฉพาะฟอนต์ตัวเอง), `src/lib/track.ts` (dedupe
> view 1/ฟอนต์/วัน ผ่าน localStorage, fire-and-forget ไม่พัง UX), FontDetail
> ยิง view + free download event, หน้าใหม่ `/designer/analytics` ("สถิติ" ใน
> sidebar — tiles เดือนนี้ + ตารางต่อฟอนต์ รวม download_logs ยอดโหลดซื้อ),
> หน้า `/fonts` มี filter: ค้นหาชื่อ/tag + หมวดหมู่ + ฟรี/ลดราคา/ขาย + designer
> (ตัดสินใจ: ไม่ทำ filter น้ำหนัก — ไม่มีข้อมูลชื่อ weight และ user ไม่ค้นจากมุมนี้)
>
> **การตัดสินใจ:** ส่วนแบ่งคงที่ 25% ทุกคน (`users.revenue_share_percent` เป็น
> field เผื่ออนาคตจาก 0004 ก่อนตัดสินใจโมเดล — ยังไม่ใช้) / ทุก query สถิติ/รายได้
> ใช้ `src/lib/fetch-all.ts` วน .range() กันเพดาน 1000 แถวของ PostgREST นับขาดเงียบ ๆ
>
> **ทดสอบแล้ว:** RLS ทั้ง payouts + font_events ผ่าน transaction+rollback บน DB
> จริง, /fonts filter + view tracking + dedupe ทดสอบผ่านเบราว์เซอร์จริง, build ผ่าน
> / ยังไม่ทดสอบ: หน้า revenue/analytics บน production ด้วยบัญชีจริง (ต้อง login)

## 4.1 Subscription

- **โมเดล:** ลูกค้าจ่ายรายเดือน → ใช้ได้ทุกฟอนต์ที่ designer opt-in /
  รายได้แบ่ง เว็บ 50% + pool designer 50%
- **การแบ่ง pool:** แนะนำใช้ **"จำนวน subscriber ที่ใช้ฟอนต์ของ designer
  นั้นในเดือนนั้น" (unique subscriber–font pairs)** ไม่ใช่ยอดดาวน์โหลดดิบ
  — กันการปั๊มยอด (โหลดฟอนต์ตัวเองวน ๆ) เพราะ 1 คนต่อ 1 ฟอนต์นับได้แค่ 1
  ต่อเดือนไม่ว่าโหลดกี่ครั้ง
- **ราคา:** แนะนำช่วง ฿199–349/เดือน โดย anchor กับราคาฟอนต์เดี่ยว
  (ให้คุ้มเมื่อใช้ ≥1-2 ฟอนต์ใหม่ต่อเดือน) + มีแผนรายปีลดราคา —
  **ตัดสินใจจริงเมื่อมีข้อมูลยอดขาย Phase 3 + ยอด waitlist แล้ว**
- ต้องมีระบบวัดการใช้งาน (ผ่าน download หรือ desktop app) ก่อนเปิด

## 4.2 Revenue & Payout

- Statement รายเดือนต่อ designer: ยอดขาย, ส่วนแบ่ง, สถานะจ่าย
- จ่ายเงินโอนมือได้ในช่วงแรก แต่ตัวเลขต้องมาจากระบบ ไม่ใช่นับเอง

## 4.3 อื่น ๆ

- **Analytics ต่อ designer** — ยอดเข้าชม/ยอดโหลดของฟอนต์ตัวเอง
- **Hidden watermark ในไฟล์ฟอนต์** — ต่อยอดจาก license stamping (2.5):
  ฝังลายนิ้วมือแบบซ่อนต่อ order เช่น ขยับพิกัด glyph เล็กน้อย —
  ลบยากกว่า name table มาก ไว้ trace ไฟล์หลุดแม้ metadata ถูกลบ
- **Search/filter ขั้นสูง** — หมวดหมู่, น้ำหนัก, ฟรี/ขาย, designer
- **Tauri Desktop App** (Windows/macOS) — ตัวติดตั้ง/จัดการฟอนต์สำหรับ
  ลูกค้า subscription และเป็นแหล่งข้อมูลการใช้งานจริงสำหรับแบ่ง pool
- **ย้าย SSR/ISR** (@opennextjs/cloudflare) — ทำเมื่อ catalog โตจน rebuild
  ช้าเกินรับ ไม่ต้องทำก่อนหน้านั้น

---

# ภาคผนวก

## คำศัพท์

| คำ | ความหมาย |
|---|---|
| **RLS** | Row Level Security — กฎใน PostgreSQL/Supabase ว่า role ไหนอ่าน/เขียน row ไหนได้ เป็นแนวป้องกันหลักของระบบ |
| **anon key** | กุญแจสาธารณะของ Supabase ที่ browser ใช้ — ปลอดภัยเพราะ RLS จำกัดสิ่งที่ทำได้ ไม่ใช่เพราะกุญแจลับ |
| **Signed URL** | ลิงก์ดาวน์โหลดชั่วคราวจาก private bucket มีวันหมดอายุ ออกให้เฉพาะคนมีสิทธิ์ |
| **Entitlement** | บันทึก "ใครมีสิทธิ์ใช้ฟอนต์ไหนภายใต้ license อะไร" — เกิดจากการซื้อ/การมอบสิทธิ์ |
| **Webhook** | การที่บริการภายนอก (เช่น Stripe) ยิง HTTP มาแจ้งระบบเราเมื่อมีเหตุการณ์ (เช่น จ่ายเงินสำเร็จ) |
| **Pages Function** | serverless function ที่ deploy คู่กับ static site บน Cloudflare Pages (โฟลเดอร์ `functions/`) |
| **Turnstile** | ระบบกันบอทของ Cloudflare (แบบเดียวกับ CAPTCHA แต่ส่วนใหญ่มองไม่เห็น) ฟรี |
| **SSG / SSR / ISR** | สร้างหน้าเว็บตอน build / ตอนมีคนเข้า / ตอน build แต่ refresh ได้เป็นระยะ |

## ต้นทุนสรุป

| ช่วง | ค่าใช้จ่าย/เดือน |
|---|---|
| ตอนนี้ → Go live → Phase 2 | **฿0–80** (โดเมนเฉลี่ย ~฿40 + Zoho IMAP ~฿36 ถ้าใช้) |
| Phase 3 เริ่มขายจริง | **~฿950–1,000** (Supabase Pro) + ค่า gateway ตามยอดขาย |
| จุดคุ้มทุน Supabase Pro | ยอดขาย ~฿4,500–5,000/เดือน |

## ลำดับที่แนะนำ (ย่อ — อัปเดต 11 ก.ค. 2026: งานโค้ดเสร็จหมดแล้ว เหลือปฏิบัติการ)

1. ทดสอบ 5 flow + ฟีเจอร์ใหม่ด้วยบัญชีจริงบน production
   (designer quotes / admin revenue / analytics)
2. ย้ายฟอนต์ 35 ตัว → Zoho Mail → DNS cutover (+ Supabase Site URL)
   → เปิดตัว + ชวน designer ผ่าน /become-a-designer
3. ตั้งค่า Stripe + เปิด Turnstile กลับ → ทดสอบ e2e เงินจริง/ไฟล์จริง
4. อัป Supabase Pro (~฿950/เดือน) เมื่อเริ่มขายจริง — เพื่อ backup รายวัน
5. งานโค้ดอนาคตตามข้อมูลจริง: Phase 4.1 Subscription (รอยอดขาย + waitlist
   กำหนดราคา/กติกา pool), hidden watermark ต่อ order, Tauri desktop app,
   ย้าย SSR/ISR เมื่อ catalog โตจน rebuild ช้า
