# DHAMMADHA — แผนพัฒนาแพลตฟอร์มตลาดฟอนต์ไทย

> **สถานะปัจจุบัน + งานที่เหลือ → [project.md](../project.md)** (root) — อ่านที่นั่นก่อนเสมอ
> เอกสารนี้เก็บเฉพาะ**รายละเอียดเชิงเทคนิคของแต่ละ Phase**: ทำไมออกแบบแบบนี้, ตัดสินใจอะไรไปแล้ว,
> gotcha ที่ไม่ derive จากโค้ดตรง ๆ — Phase 0–4.2/4.3 โค้ดเสร็จหมดแล้ว (เหลือ 4.1 รอข้อมูลขาย)

## ภาพรวมธุรกิจ (ตัดสินใจแล้ว)

| เรื่อง | ข้อสรุป |
|---|---|
| รายได้หลัก | **B2C ขายรายฟอนต์** ผ่านเว็บ — designer ได้ 75% / เว็บได้ 25% (เว็บแบกค่า payment gateway เองจากส่วน 25% นั้น) |
| B2B quote | เป็น **เครื่องมืออำนวยความสะดวกให้ designer** ไม่ใช่รายได้เว็บ — ลูกค้าองค์กรโอนเงินเข้าบัญชี designer ตรง เว็บช่วยรวบรวมคำขอ + ออกเอกสารให้ (ยกเว้นฟอนต์ของ DHAMMADHA เองที่เงินเข้าสตูดิโอ) |
| Subscription | แผนระยะยาว — ลูกค้าจ่ายรายเดือน เข้าถึงทุกฟอนต์ที่ designer เลือกเข้าร่วม / เว็บ 50% + pool designer 50% แบ่งตามการใช้งานจริง — รายละเอียด [PHASE-4.1-SUBSCRIPTION.md](PHASE-4.1-SUBSCRIPTION.md) |
| ฟอนต์ฟรี | ดึง traffic + ดึง designer สายฟอนต์ฟรีเข้าแพลตฟอร์ม + บังคับ login ก่อนโหลดเพื่อเก็บ email list |
| ภาษี | ยังไม่จด VAT — ออกใบเสร็จรับเงินเท่านั้น จดบริษัทเมื่อธุรกิจแข็งแรง |

## สถาปัตยกรรมระบบ

```
ผู้ใช้ (browser)
   │
   ├── หน้าเว็บ static (Next.js output:export) ── Cloudflare Pages (ฟรี)
   │        └─ อ่านข้อมูลตรงจาก Supabase ด้วย anon key (RLS คุมสิทธิ์)
   │
   ├── /api/send-email, /api/checkout, /api/stripe-webhook ── Cloudflare Pages Functions
   │
   └── ไฟล์ต่าง ๆ ──────────────────────────────── Supabase Storage
            ├─ public: covers, previews, specimens, fonts-demo, fonts-free
            └─ private: fonts-full (เข้าถึงผ่าน signed URL/Edge Function เท่านั้น)
```

**หลักการ 3 ข้อ:** (1) **RLS คือแนวป้องกันจริง** ไม่ใช่การซ่อนปุ่ม — ทุกตารางต้องมี policy
(2) **เว็บเป็น static เพื่อต้นทุนเกือบศูนย์** — จุดที่ต้องมี server ใช้ Pages Functions เฉพาะจุด ไม่ย้ายทั้งเว็บเป็น SSR
(3) **Publish = rebuild ทั้งเว็บ** (~2 นาที) ยอมรับได้ที่ scale ปัจจุบัน — ถ้า catalog โตจน build ช้า ค่อยย้าย SSR/ISR

---

# Phase 0 — ซ่อมฐานราก ✅ (8 ก.ค. 2026)

เป้าหมาย: อุดช่องโหว่ที่ทำให้ "ขายจริงไม่ได้/อันตราย" ก่อนเอาของจริงขึ้นระบบ

- **อีเมล → Cloudflare Pages Function** — `output:"export"` ตัด API routes ทิ้งหมด ตอน build จริง เดิม
  quote/แจ้ง designer ล้มเหลวเงียบ ๆ (ทำงานเฉพาะ `next dev`) แก้ด้วย `functions/api/send-email.ts`
  คู่กับ `src/lib/email-service.ts` (logic กลาง ใช้ร่วมกับ dev route) ผู้รับอีเมล **lookup ฝั่ง server จาก
  `designer_id`** (เดิม client ส่ง email ตรงมา = open relay) + escape HTML ทุก field + Turnstile
- **ปิดช่องโหว่ไฟล์ฟอนต์เต็ม** (migration `0028`) — เดิม URL ไฟล์เต็มอยู่ใน `fonts.full_font_files` ที่
  anon SELECT ได้ + bucket public = **ใครก็โหลดฟอนต์เต็มฟรีได้ทุกตัว** แก้ด้วยตาราง **`font_files_private`**
  (RLS เฉพาะ owner+admin) เก็บ **storage path ไม่ใช่ URL** + ตั้ง bucket `fonts-full` เป็น private
- **Type tester** เดิมรอไฟล์จาก `obfuscated_font_files` ที่ไม่มีระบบไหน generate เลย (ค้างจากเว็บเก่า) —
  แก้ด้วย pipeline obfuscation จริงใน Phase 1 (ดู 1.2)
- Code quality: AuthContext loading race, Nav กระพริบ, admin error ไม่บอกอะไร (→ toast),
  ลบ `console.error` prod, `robots.txt` + `sitemap.xml`

---

# Phase 1 — Go Live (dhammadha.com) + เปิดรับ designer ✅

เป้าหมาย: เว็บจริงบนโดเมนจริง มีฟอนต์ครบ 35 ตัว พร้อมรับ designer ภายนอกตั้งแต่วันแรก

- **Pipeline เตรียมไฟล์ฟอนต์** (`src/lib/font-pipeline.ts`, ในเบราว์เซอร์ผ่าน Pyodide) — ปุ่ม
  **"⚡ สร้าง Tester + Demo อัตโนมัติ"** ใน FontForm ผลิต 2 อย่างจากไฟล์เต็มทุก weight:
  1. **Tester (obfuscated)** — glyph ครบทุก weight แต่ cmap สลับภายในหมวดอักขระเดียวกัน (พยัญชนะ↔พยัญชนะ
     ฯลฯ กัน shaping ไทยพัง) → tester แสดงฟอนต์จริงแต่ไฟล์ที่ถูกดูดไปใช้งานจริงไม่ได้ (deterrent ระดับ foundry)
  2. **Demo** — Regular ตัด glyph เหลือไทย+เว้นวรรค เปลี่ยนชื่อเป็น "\<ชื่อ\> DEMO"
  - สำรอง CLI batch: `scripts/prepare_font_assets.py` (ต้อง `fonttools brotli`)
- **ข้อตกลง Designer** — ส่วนแบ่ง 75/25 + **สงวนสิทธิ์ปรับอัตราโดยแจ้งล่วงหน้า 30–60 วัน** (กันตอนจด VAT/
  บริษัทแล้วต้นทุนเปลี่ยน), ยืนยันเจ้าของลิขสิทธิ์, เงื่อนไขถอนฟอนต์, quote/เอกสารฟรีช่วงเปิดตัว **อาจคิดค่าบริการอนาคต**
- **Onboarding/Quality gate** — `SetupGate.tsx`: การ์ด checklist (slug/ข้อมูลผู้ขาย/บัญชี) บน designer dashboard
  + gate บล็อกเพิ่มฟอนต์ถ้ายังไม่ตั้ง slug · admin: ปุ่ม **"ตรวจ & Publish"** เช็คไฟล์/ข้อมูลครบก่อน publish ได้
- **ฟอนต์ฟรี** บังคับ login + checkbox PDPA ก่อนโหลด → ได้ email list การตลาด
- **Legal**: Privacy (PDPA — เก็บชื่อ/อีเมล/เบอร์/ที่อยู่/เลขภาษี), Terms, Refund Policy
- **DNS cutover checklist**: ชี้โดเมน → Cloudflare Pages → **ต้องอัป Supabase Auth Site URL/Redirect URLs**
  (ลืม = ลิงก์ยืนยันอีเมล/รีเซ็ตรหัสพัง) → redirect เว็บเก่า `/:slug` → `/fonts/:slug`

---

# Phase 2 — Quote-to-cash แบบ manual ✅

เป้าหมาย: ปิดการขายได้ครบวงจรบนเว็บ เงินยังโอนตรงเข้าบัญชี designer (ไม่ต้องรอ Stripe)

**โครงข้อมูล 3 ตาราง:** `orders` (ใคร/ฟอนต์/tier/ราคา/สถานะ/เลขเอกสาร) · **`entitlements`**
(หัวใจของระบบ — "user X มีสิทธิ์โหลดฟอนต์ Y ภายใต้ license Z" เช็คก่อนออกลิงก์ดาวน์โหลดเสมอ เป็นโครงเดียวกับที่
Stripe และ subscription ต่อยอด) · `download_logs` (จำกัด 30/วัน + audit)

**Flow:** ลูกค้าขอ quote → designer ส่งใบเสนอราคา PDF → ลูกค้าโอนตรงเข้าบัญชี designer → designer กด
"ยืนยันรับชำระ" → สร้าง order+entitlement อัตโนมัติ → อีเมลลิงก์ดาวน์โหลด+ใบเสร็จ+license อัตโนมัติ
(**Signed URL** อายุ ~5 นาที ออกให้หลังตรวจ entitlement เท่านั้น)

**License stamping** — Edge Function `download-font` (`supabase/functions/download-font/stamp.ts`,
byte-preserving sfnt patcher เขียนเอง ไม่ใช้ fonteditor-core เพราะแปลง CFF→glyf ตอน parse): ตรวจ
entitlement → อ่านจาก private bucket → แก้ **OpenType name table** (nameID 13 = "Licensed to
\<ชื่อ\> — Order \<เลข\> — via dhammadha.com", nameID 14 = ลิงก์ `/verify`, nameID 3 = เลข order ซ้ำ) →
ส่งไฟล์ + log ทำฝั่ง server เพราะต้อง stamp หลังตรวจสิทธิ์ในจุดที่ลูกค้าแก้ไม่ได้ (metadata ลบได้ด้วยเครื่องมือ
font — นี่คือ audit trail/deterrent ไม่ใช่ DRM, `entitlements` ใน DB ยังเป็น source of truth เสมอ)

**เอกสาร PDF** (`src/lib/quote-doc.ts`, pdf-lib + Noto Sans Thai ฝังใน `public/fonts/pdf/`) — เลขที่
QT/RC ออกผ่าน RPC `issue_quote_doc` (atomic/idempotent) ทั้ง admin และ designer เจ้าของ quote ออกเองได้
จากหน้า `/designer/quotes`

**ค่าบริการ quote:** ฟรีช่วงเปิดตัว อนาคตถ้าคิด ต้องเป็น **fixed rate ตาม tier ยอด ห้ามคิดเป็น %**
(ยอด B2B สูง designer จะไม่อยากเข้าร่วม)

**5 จุดที่แก้จากการทดสอบจริง (12 ก.ค. 2026, `37cf17f`):**
1. ขอ quote ไม่ได้ตอน login — root cause: `grant insert on quotes` มีแค่ `anon` ไม่มี `authenticated`
   (migration `0042`) — เตือนใจ: grant ต้องเช็คให้ครบทุก role ไม่ใช่แค่ RLS policy
2. ยืนยันรับชำระรวมเป็นปุ่มเดียว — `confirm_quote_paid` ออกใบเสร็จ + อีเมลอัตโนมัติในตัว
3. `IssueQuoteModal` + RPC `issue_quotation_priced` — แก้ราคา/ใส่ส่วนลดก่อนออกใบเสนอราคา
   (migration `0043`, เก็บ `fonts_detail`+`discount` บน quote)
4. license label กลาง `src/lib/license.ts` `licenseLabel()` แทน raw enum ทุกจุด
5. `confirm_quote_paid` ยึดราคาจาก `fonts_detail` ที่บันทึกไว้เป็นหลัก (migration `0044`) —
   กัน client ส่งราคาเอง ป้องกันใบเสร็จไม่ตรงยอดจริง

**ตัดสินใจ:** อีเมล delivery โชว์ `total_amount` (gross ไม่หัก WHT 3%) เพราะใช้ร่วมกับ B2C Stripe
checkout ที่ไม่มี WHT — ใบเสร็จ PDF คำนวณ WHT ตามเดิม (ต่างกันโดยตั้งใจ ไม่ใช่บั๊ก)

---

# Phase 3 — B2C self-serve checkout (รายได้หลักของเว็บ) ✅

เป้าหมาย: ลูกค้ารายย่อยกดซื้อ → จ่าย → ได้ไฟล์ทันที ไม่ต้องมีคนกดอะไรเลย

- **Gateway: Stripe** — ไม่มีค่ารายเดือน คิด % ต่อรายการ (บัตร ~3.65%, **PromptPay ~1.6%**) →
  **ดัน PromptPay เป็นช่องทางหลัก** ดันส่วนแบ่งจริงของเว็บจาก ~21% → ~23.4%
- **Flow:** หน้าฟอนต์ → เลือก tier → Stripe Checkout → webhook ยิงมาที่ Pages Function → ตรวจลายเซ็นด้วย
  WebCrypto (ไม่ใช้ Stripe SDK) → RPC `create_checkout_order` (idempotent ด้วย unique session id) →
  ระบบเดียวกับ Phase 2 ทุกจุดต่อจากนี้ (order+entitlement+อีเมล+stamping) ต่างแค่คนสร้าง order คือ webhook
- บันทึกส่วนแบ่ง 75/25 ต่อ order อัตโนมัติ → ข้อมูลตั้งต้นของ revenue/payout Phase 4
- ขอบเขตตั้งใจ: ขาย self-serve เฉพาะสิทธิ์บุคคลทั่วไป — license องค์กรยังไปทาง quote (B2B flow เดิม)
- **อัป Supabase Pro (~฿900/เดือน) เมื่อเริ่มขายจริง** — เหตุผลหลักคือ backup รายวัน (มีข้อมูลเงิน/สิทธิ์ลูกค้าจริงแล้ว)
  จุดคุ้มทุน: ยอดขาย ~฿4,500–5,000/เดือน

---

# Phase 4 — Growth

## 4.1 Subscription ⏸ รอข้อมูลยอดขายจริง

ดูรายละเอียดเต็ม → [PHASE-4.1-SUBSCRIPTION.md](PHASE-4.1-SUBSCRIPTION.md) (Milestone A+B เสร็จแล้ว)

## 4.2 Revenue & Payout ✅

ตาราง `payouts` (migration `0037`, 1 แถว/designer/เดือน) · `src/lib/revenue.ts` (B2C หัก 25/75 จาก
`platform_amount`/`designer_amount`, B2B รับตรง 100% แยกหมวด) · `/admin/revenue` (เห็นบัญชีธนาคาร +
บันทึกจ่าย/ยกเลิก) · `/designer/revenue` (statement + สถานะจ่าย) — ทุก query ผ่าน `src/lib/fetch-all.ts`
(วน `.range()` กันเพดาน 1000 แถวของ PostgREST นับขาดเงียบ ๆ)

## 4.3 Analytics + Search ✅

ตาราง `font_events` (migration `0038` — view/free_download, กัน spoof user_id, designer เห็นเฉพาะของ
ตัวเอง) · `src/lib/track.ts` (dedupe 1 view/ฟอนต์/วัน ผ่าน localStorage) · `/designer/analytics` ·
`/fonts` filter บรรทัดเดียว (ค้นหา + หมวดหมู่ + ราคา) — ตัดสินใจ: ส่วนแบ่งคงที่ 25% ทุกคน
(`users.revenue_share_percent` เป็น field เผื่ออนาคต ยังไม่ใช้ตอนนี้)

## งานอนาคตอื่น (ยังไม่เริ่ม)

- **Search/filter ขั้นสูง** — น้ำหนัก, หมวดหมู่ละเอียดขึ้น
- **ย้าย SSR/ISR** (`@opennextjs/cloudflare`) — ทำเมื่อ catalog โตจน rebuild ช้าเกินรับเท่านั้น ไม่ต้องรีบ

### หมายเหตุ: Hidden watermark ในไฟล์ฟอนต์ — **ตัดออกจากแผนแล้ว (25 ก.ค. 2026)**

เจ้าของเคาะว่า **ไม่ทำ** เพราะแคตตาล็อกมีทั้ง `.ttf` และ `.otf` ซึ่งเก็บเส้น outline คนละแบบ
ต้องเขียนตัวจัดการสองชุดแยกกัน ไม่คุ้มกับที่ได้เพิ่ม บันทึกไว้ตรงนี้เผื่อวันหน้าอยากรื้อมาทำต่อ

**ของที่มีอยู่แล้ววันนี้** — `supabase/functions/download-font/stamp.ts` (185 บรรทัด, Deno)
ประทับข้อมูลผู้ซื้อลง **name table** ตอนดาวน์โหลด แบบ byte-preserving (ไม่แตะตารางอื่นเลย):
nameID 3 = เลข order · nameID 13 = "Licensed to … Order … via dhammadha.com" · nameID 14 =
ลิงก์ `/verify?token=…` · ถอด DSIG ทิ้ง

**ข้อดีของ hidden watermark เทียบกับ name table ที่ใช้อยู่**

| | name table (ปัจจุบัน) | hidden watermark |
|---|---|---|
| ลบทิ้ง | เปิด FontForge/fontTools แก้ 30 วินาที ใครก็ทำได้ | ต้องรู้ว่าซ่อนตรงไหน — ลบมั่วจะทำให้ฟอนต์เพี้ยน |
| รอด subset/convert ไหม | ไม่รอด แปลงไฟล์ทีเดียวหาย | รอดถ้าไม่ได้แปลง outline ใหม่ทั้งชุด |
| ใช้เป็นหลักฐาน | อ่อน (อ้างได้ว่าโดนใครใส่ให้ก็ได้) | แข็งกว่า เพราะฝังในตัวเส้นฟอนต์เอง |
| ผลข้างเคียงกับตาฅน | ไม่มี | ไม่มี ถ้าขยับ ≤1 unit/em (1/1000 ของตัวอักษร) |

**วิธีคร่าว ๆ ถ้าจะทำต่อ** — ทำที่ Edge Function `download-font` ตอนสร้างไฟล์ให้ผู้ซื้อ
(ทำฝั่ง client ไม่ได้ เพราะไฟล์ต้นฉบับจะหลุดถึงเบราว์เซอร์ก่อนอยู่ดี) และ Deno **ไม่มี fontTools**
(Pyodide ที่โปรเจกต์ใช้อยู่ทำงานตอน upload ไม่ใช่ตอน download) → ต้องเขียน parser เอง

1. **ฝั่ง TTF** — เส้นอยู่ในตาราง `glyf` + `loca` เลือก glyph สัก 30–40 ตัว ขยับจุด on-curve
   ทีละ ±1 unit ให้แต่ละตัวแทน 1 บิตของ order id แล้ว rebuild `loca` + checksum ใหม่
   (ต้องเผื่อ composite glyph ที่อ้าง glyph อื่นด้วย) — ประเมิน ~1–2 รอบงาน
2. **ฝั่ง OTF** — เส้นอยู่ในตาราง `CFF ` เป็น Type2 charstring ต้องเขียน interpreter +
   re-encoder เอง **นี่คือส่วนที่ทำให้ทั้งงานไม่คุ้ม** ถ้าวันหน้าขายเป็น `.ttf` อย่างเดียว
   ค่อยรื้อมาทำเฉพาะข้อ 1 จะคุ้มกว่ามาก
3. **ตัวถอดกลับ** — หน้า admin ที่อัปไฟล์ต้องสงสัยแล้วบอกว่ามาจาก order ไหน (อีก ~1 รอบงาน)
   ไม่มีตัวนี้ watermark ก็ใช้เป็นหลักฐานไม่ได้
4. เช็ก CPU budget ของ Edge Function ต่อการดาวน์โหลด 1 ครั้งด้วย

---

# ภาคผนวก

## คำศัพท์

| คำ | ความหมาย |
|---|---|
| **RLS** | Row Level Security — กฎใน PostgreSQL/Supabase ว่า role ไหนอ่าน/เขียน row ไหนได้ เป็นแนวป้องกันหลักของระบบ |
| **anon key** | กุญแจสาธารณะของ Supabase ที่ browser ใช้ — ปลอดภัยเพราะ RLS จำกัดสิ่งที่ทำได้ ไม่ใช่เพราะกุญแจลับ |
| **Signed URL** | ลิงก์ดาวน์โหลดชั่วคราวจาก private bucket มีวันหมดอายุ ออกให้เฉพาะคนมีสิทธิ์ |
| **Entitlement** | บันทึก "ใครมีสิทธิ์ใช้ฟอนต์ไหนภายใต้ license อะไร" — เกิดจากการซื้อ/การมอบสิทธิ์ |
| **Webhook** | บริการภายนอก (เช่น Stripe) ยิง HTTP มาแจ้งเหตุการณ์ (เช่น จ่ายเงินสำเร็จ) |
| **Pages Function** | serverless function deploy คู่กับ static site บน Cloudflare Pages (โฟลเดอร์ `functions/`) |
| **Turnstile** | ระบบกันบอทของ Cloudflare (แบบเดียวกับ CAPTCHA แต่ส่วนใหญ่มองไม่เห็น) ฟรี |
| **SSG / SSR / ISR** | สร้างหน้าเว็บตอน build / ตอนมีคนเข้า / ตอน build แต่ refresh ได้เป็นระยะ |

## ต้นทุนสรุป

| ช่วง | ค่าใช้จ่าย/เดือน |
|---|---|
| ตอนนี้ → Go live → Phase 2 | **฿0–80** (โดเมนเฉลี่ย ~฿40 + Zoho IMAP ~฿36 ถ้าใช้) |
| Phase 3 เริ่มขายจริง | **~฿950–1,000** (Supabase Pro) + ค่า gateway ตามยอดขาย |
| จุดคุ้มทุน Supabase Pro | ยอดขาย ~฿4,500–5,000/เดือน |
