# DHAMMADHA — project.md (จุดเริ่มอ่านตอนเปิด session ใหม่)

> ไฟล์นี้คือ**แผนที่** ไม่ใช่แหล่งความจริงทั้งหมด — อ่านที่นี่ก่อนเพื่อรู้ว่า
> "ตอนนี้อยู่ตรงไหน" แล้วค่อยกดลิงก์ไปอ่านรายละเอียดเฉพาะจุดที่ต้องใช้จริง
> ไม่ต้องไล่อ่านประวัติแชทเก่า

## โปรเจกต์นี้คืออะไร

แพลตฟอร์มตลาดฟอนต์ไทย (dhammadha.com) — designer ฝากขายฟอนต์ ลูกค้าซื้อ/ขอใบเสนอราคา
รายได้หลัก B2C ขายรายฟอนต์ (designer 75% / เว็บ 25%), B2B quote เป็นเครื่องมือฟรีให้ designer
(เงินเข้า designer ตรง), subscription เป็นแผนอนาคต — รายละเอียดโมเดลธุรกิจเต็ม ๆ ดู
[docs/ROADMAP.md](docs/ROADMAP.md) หัวข้อ "ภาพรวมธุรกิจ"

## Stack + สถาปัตยกรรม (สรุป — เต็ม ๆ ดู [CLAUDE.md](CLAUDE.md))

Next.js `output:"export"` (**ไม่มี server runtime จริง**) → Cloudflare Pages ·
Supabase (Postgres+RLS+Storage เป็นแนวป้องกันจริง ไม่ใช่การซ่อนปุ่ม) · จุดที่ต้องมี server
ใช้ Pages Functions เฉพาะจุด (`/api/send-email`, `/api/checkout`, `/api/stripe-webhook`)
Publish ฟอนต์ = rebuild ทั้งเว็บ (~2 นาที เพราะหน้า detail เป็น SSG)

## สถานะปัจจุบัน (25 ก.ค. 2026)

| ส่วน | สถานะ |
|---|---|
| Backend Phase 0–3 (ซ่อมช่องโหว่ / go-live / quote-to-cash manual / Stripe checkout) | ✅ โค้ดเสร็จ + apply DB จริงแล้ว |
| Backend Phase 4.2–4.3 (Revenue & Payout / Analytics + Search) | ✅ โค้ดเสร็จ + apply DB จริงแล้ว |
| Backend Phase 4.1 (Subscription) | ⏸ รอข้อมูลยอดขายจริง + waitlist ก่อนเคาะราคา/กติกา — Milestone A+B เสร็จ, C (`sub-font` Edge Fn + Tauri app) และ D (เปิด trial) ยกไปหลัง go-live |
| Redesign หน้าสาธารณะ Phase 0–10 (หน้าแรก, /fonts, FontDetail, เอกสาร, become-a-designer, contact, verify, auth, account, quote, subscribe, checkout) | ✅ เสร็จหมด — merge เข้า `main` แล้ว |
| Redesign dashboard admin/designer | ✅ restyle ครบทุกหน้า (Phase D1–D4) — ดู [docs/design/DESIGN.md](docs/design/DESIGN.md) §18 · ยังไม่ตรวจสดหลัง login |
| Dashboard: รวม designer section ของ admin + ปุ่มลบฟอนต์ + share มือถือ | ✅ โค้ดเสร็จ (24 ก.ค. 2026) — `/admin/*` designer section เป็น wrapper ครอบ `src/components/dashboard/Own*.tsx` ชุดเดียวกับ `/designer/*` แล้ว (ไม่มีปุ่มลบ) · ปุ่มลบย้ายไป `/admin/font-review` พร้อม modal พิมพ์ชื่อยืนยัน |
| Payout รายไตรมาส + สรุปยอดต่อ designer + เอกสาร/อีเมล | ✅ โค้ดเสร็จ + apply DB จริงแล้ว (0064/0065, 24 ก.ค. 2026) — จ่ายทุก 3 เดือน โอน ม.ค./เม.ย./ก.ค./ต.ค. · **เลย์เอาต์ PDF ใน `src/lib/payout-doc.ts` ยังเป็น placeholder รอตัวอย่างเอกสารจากเจ้าของ** |
| Dashboard รอบ 2: รายได้ designer 4 กล่องกดได้ + Payouts filter ช่วงเวลา + Fonts search | ✅ โค้ดเสร็จ (24 ก.ค. 2026) — filter dropdown (ไตรมาสนี้/ก่อน/3 ปี/**ทั้งหมด**) helper กลางใน `src/lib/revenue.ts` (`periodOptions`/`monthsInPeriod`/`buildFontSales`) · ศัพท์บนจอ B2C→Retail Font · โหมดรายปี/ทั้งหมดใน Payouts = อ่านอย่างเดียว · ตาราง Retail Font **แยกแถวตามจุดราคา** · top tile "สะสมทั้งหมด" = all-time outstanding (`earned Retail − paid`) เงินค้างเก่าไม่หาย |
| Dashboard: เมนู Orders + สถานะการโอนตามเวลา | ✅ โค้ดเสร็จ + apply DB (0066/0067, 24 ก.ค. 2026) — หน้า `/admin/orders` (Retail/Subscription tab) · สถานะ payout: **ยังไม่ถึงรอบโอน**(เขียวอ่อน)/**รอโอน**(เหลือง)/**ค้างชำระ**(แดง)/จ่ายครบแล้ว |
| Payout: สถานะ+ยอดค้างโอนเป็น**รายไตรมาสที่เลือก** + badge แจ้งเตือน all-time | ✅ โค้ดเสร็จ (24 ก.ค. 2026, `admin/payouts/page.tsx`) — `statusByDesigner` เลิก rollup ข้ามช่วง คิดเฉพาะ `quartersInPeriod` (ดูไตรมาสไหน = สถานะไตรมาสนั้น) · คอลัมน์ยอดค้างโอนในตาราง = ยอดรายไตรมาส (`r.pending`) · **badge "รอโอน/ค้างชำระ X ราย" บนแถวเลือกช่วงเวลา นับ all-time (รวมทุกไตรมาส) เจตนาให้เตือนข้ามช่วงกันตกหล่น** — ต่างจากคอลัมน์ที่เป็นรายไตรมาส |
| เกณฑ์เลือกฟอนต์ "น่าจะสนใจ" / สไลด์คัดสรร | ✅ โค้ดเสร็จ + apply DB (0068, 25 ก.ค. 2026) — **ยกเลิกแนวยอดขาย/RPC `font_sales_counts()`** และ **ลบ `is_popular` (dead column)** ตามที่เจ้าของสั่ง · เกณฑ์ใหม่ทำฝั่ง client ล้วน (runtime, re-roll): related บน FontDetail = 2 ฟอนต์ designer เดียวกัน + 2 จากทั้งหมด เลือกตัว tag ตรง≥1/category เดียวกันก่อน ไม่พอเติมสุ่ม (`pickRelated`) · หน้าแรก slider 8 = โควตาลดราคาสูงสุด 3 + สุ่มทั้งหมดอีก 5 · หน้า designer slider 4 = ลดราคาก่อนแล้วสุ่ม · **เพิ่ม sale badge "ลด X%" มุมขวาบน cover สไลด์ (หน้าแรก+designer) เฉพาะฟอนต์ลดราคา** — `CoverCarousel` map `saleLabel` จาก `effectiveSale()`, โหมด `slides` (font detail) ไม่ขึ้น |
| Type tester เร่งความเร็ว (interactive ลื่นขึ้น) | ✅ โค้ดเสร็จ (25 ก.ค. 2026, `TypeTester.tsx` ไฟล์เดียว — Edge Function ไม่แตะ/ไม่ต้อง redeploy) — client cache ต่อ session (combination ที่เคย render โชว์ทันที 0 request) · debounce ตามงาน (เปลี่ยนน้ำหนัก=ทันที, พิมพ์/สไลเดอร์=250ms) · pre-warm ข้อความ default · **probe CDN `tester-cache` เฉพาะข้อความ default** (ข้อความที่ผู้ใช้พิมพ์เองแทบไม่มีทาง hit → ยิง Edge Function ตรง ประหยัด 1 RTT ต่อการพิมพ์) · **แท็บ "พิมพ์ทดสอบ" mount ค้างไว้หลังเปิดครั้งแรก** (`testerOpened` ใน `FontDetail.tsx` — ยังไม่กดดู = ไม่ mount/ไม่ยิง Edge Function เหมือนเดิม, กดแล้วซ่อนด้วย `hidden` แทนถอดออก) เดิมสลับแท็บกลับมาเสีย ~2 วิ (ยิง `info` ใหม่ ~1–1.4 วิ) + ล้างข้อความ/ขนาด/น้ำหนัก/cache ทิ้ง ตอนนี้ 0 request ~20ms · client cache เป็น LRU เพดาน 40 ภาพ (revoke objectURL ตัวที่ถูกไล่ออก กัน blob บวมเพราะ panel อยู่ยาว) · **กับดัก: `normalizeTesterText()` + hash ต้อง byte-match กับ Edge Function เป๊ะ ๆ ไม่งั้น cache key ไม่ตรง** · **เจตนาคง server-render PNG ไม่ย้ายไป client-side path rendering (opentype.js) แม้จะเร็วกว่า เพราะไฟล์ฟอนต์จะหลุดถึงเบราว์เซอร์** |
| ไล่ตรวจเก็บงานค้าง (audit รอบ 25 ก.ค.) | ✅ เสร็จ — lint 0 errors / typecheck ซอร์สสะอาด · แก้ที่ผู้ใช้เห็น: ตัดคำ "B2B" 2 จุดที่ `admin/payouts` (ตกหล่นจากรอบเปลี่ยนศัพท์), ช่อง "ที่อยู่" ใน `OwnSettings.tsx` ถูก `h-[42px]` ทับ `rows={2}` จนเหลือบรรทัดเดียว, **เมนูมือถือฝั่ง designer ไม่มีปุ่มออกจากระบบ/กลับหน้าแรกเลย** (drawer จบที่ `</nav>` ต่างจาก admin) · รวมสูตรส่วนแบ่งที่กระจาย 4 ที่เป็น `designerShareOf()` ใน `lib/revenue.ts` (เดิม hardcode `* 0.75` + ไม่ `round2` → เศษ float หลุดไป input จำนวนเงินตอนบันทึกจ่าย) · ลบโค้ดตาย: `buildMonthlyStatements`/`MonthStatement`/`monthKey`, `storage.deleteFile`, `readFontMetaSummary`, `DesignerSetupCard` (ถูกแทนด้วย redirect ไป `/designer/onboarding` ตั้งแต่รอบ onboarding), ไฟล์ orphan `components/Button.tsx` + `components/ui/Card.tsx` · **จงใจไม่แก้:** lint warning 77 ตัว (`react-hooks/set-state-in-effect` ของ React 19 — warning ไม่ใช่ error) · ช่องกรอกสูง 42/38px ไม่เท่ากัน, แท็บ 3 สไตล์, toast `z-[200]` vs `z-[190]` (ไม่เนียนแต่ไม่ใช่บั๊ก) |
| Stripe: ต่อของจริง + ทดสอบขั้นที่ 1 (test key ที่เครื่อง) | ✅ ผ่านครบ (25 ก.ค. 2026) — บัตร/PromptPay/3DS/ถูกปฏิเสธ · ยิง event ซ้ำไม่เกิด order ซ้ำ · ลายเซ็นปลอม 400 · **บังคับติ๊กยอมรับสัญญาบนหน้า Stripe** (`consent_collection`) ลิงก์มาจาก Terms/Privacy URL ใน Stripe Dashboard · **กับดัก: คลิกใน iframe ของ Stripe ผ่านเครื่องมือไม่ได้ ต้องให้เจ้าของกดจ่ายเอง** |
| ตะกร้าหลายฟอนต์ (1 คำสั่งซื้อ N รายการ) | ✅ โค้ดเสร็จ + apply DB (0069/0070/0071, 25 ก.ค. 2026) — ตาราง `order_items` เก็บยอด/ส่วนแบ่งรายรายการ (ซื้อข้ามนักออกแบบในตะกร้าเดียวได้) · `create_checkout_order_multi` + webhook อ่าน line_items ของ Stripe (ต้องมี `STRIPE_SECRET_KEY` บน Pages ด้วย) · CartContext (localStorage เก็บแค่ font_id) + submenu ตะกร้าบน Nav + `/cart` จริง · ปุ่ม "ซื้อฟอนต์นี้" = ใส่ตะกร้าอยู่หน้าเดิม (ไอคอนเด้ง) · หน้า success เคลียร์เฉพาะฟอนต์ในใบนั้น · **ทดสอบจ่ายจริงข้ามร้านผ่านแล้ว (OR-2569-0008)** |
| กับดักที่เจอระหว่างทำตะกร้า (จดไว้กันพลาดซ้ำ) | ⚠️ **policy ของสองตารางห้ามอ้างถึงกันไปกลับ** — 0069 ทำ orders↔order_items วนกัน แล้ว *ทุก* query ที่แตะ orders พังหมด (แก้ใน 0070 ด้วย RPC security definer) · ทุกที่ที่คิดเงินต้องเริ่มจาก `groupOrdersByDesigner` ห้ามวน orders ดิบแล้วอ่าน `designer_id` (ใบข้ามร้านเป็น null → ตกหล่น/นับซ้ำ) |
| สัญญาอนุญาตฉบับของดีไซน์เนอร์ แสดงครบทุกหน้า | ✅ โค้ดเสร็จ (26 ก.ค. 2026, `48da337` — ไม่แตะ DB) — เดิมมีแค่ `/quote` กับหน้าร้านดีไซน์เนอร์ที่เคารพ `designer_license_config` ที่อื่น hardcode `/agreement` ทำให้ฟอนต์ของคนที่ตั้งสัญญาเองโชว์สัญญาผิดฉบับ · ตอนนี้ FontDetail + "ดาวน์โหลดของฉัน" เปิด PDF ของดีไซน์เนอร์ผ่าน `PdfLightbox` แล้ว · **เกณฑ์ตัดสินใจตัวเดียวกันทุกที่: `!use_default && license_pdf_url` → PDF ไม่งั้น `/agreement/`** (ยังไม่มี helper กลาง คัดลอกเงื่อนไขกัน 4 ที่) · MyDownloads ยิง config รวมทีเดียวด้วย `.in("designer_id", ...)` ไม่ยิงต่อฟอนต์ · **ตะกร้ายังชี้ `/agreement` ตายตัว — ตั้งใจ เพราะ 1 ใบมีได้หลายดีไซน์เนอร์ ต้องออกแบบใหม่ก่อน** |
| ตะกร้าบนมือถือ + ประวัติการดาวน์โหลดใน admin orders | ✅ โค้ดเสร็จ (26 ก.ค. 2026, `85b0b8c` — ไม่แตะ DB) — **บั๊กที่บล็อกการขายบนมือถือ: ไอคอนตะกร้าอยู่ในกลุ่ม `hidden md:flex` ทั้งกลุ่ม ต่ำกว่า 768px จึงไม่มีตะกร้า/ตัวเลขเลยสักที่** แก้ด้วยไอคอน `md:hidden` ข้างปุ่มสามขีด (ไม่ทำ submenu — ทัชไม่มี hover) · `/admin/orders` เพิ่มคอลัมน์ "ประวัติดาวน์โหลด" → popup แสดง ฟอนต์/ชื่อไฟล์/วันที่-เวลา/IP ล่าสุดขึ้นก่อน อ่านผ่าน `entitlements` เพราะ `download_logs` ผูกกับสิทธิ์ ไม่ได้ผูกกับ order · **สิ่งที่ log ไม่ได้เก็บ: น้ำหนักฟอนต์ (มีแค่ `file_path`) · ฟอนต์ฟรีลง `font_events` · ไฟล์ Demo ไม่ทิ้งร่องรอยเลย · subscription อยู่คนละตาราง (`sub_download_logs`)** |
| Go-live จริง (ย้ายฟอนต์ 35 ตัว, Stripe, Zoho, DNS cutover) | ⏳ ยังไม่ทำ — เป็นงานปฏิบัติการของเจ้าของทั้งหมด ดูด้านล่าง |

**Branch:** ทำงานบน `main` สายเดียว — งานถึง `85b0b8c` commit แล้วครบ
(เจ้าของ push เองผ่าน GitHub Desktop · push ถึง `2f30cce` แล้ว เหลือ `85b0b8c` รอ push)
· **ก่อนทดสอบ Stripe บน production ต้องเช็คว่า Cloudflare deploy รอบล่าสุดขึ้นแล้วจริง** —
DB apply 0069–0071 ไปก่อนหน้าโค้ด ถ้าเว็บยังเป็น bundle เก่าจะได้ทดสอบตะกร้าเวอร์ชันเก่า

## งานที่เหลือ (เรียงลำดับ)

1. **ตรวจสด dashboard หลัง login** — Claude verify เองไม่ได้ (ไม่กรอกรหัสผ่าน) เจ้าของ spot-check
   หน้า admin/designer ทุกหน้าว่า restyle แล้วหน้าตาถูก + ทดสอบฟีเจอร์โปรร้าน (ตั้ง/ปิด แล้วส่วนลด
   รายฟอนต์ไม่หาย) + ปุ่มแชร์หน้า font detail
   · **รอบล่าสุด (24 ก.ค.)**: เทียบ `/admin` กับ `/designer` ทีละหน้าว่าเหมือนกัน, ลอง login ด้วย
   บัญชี designer จริงด้วย (แตะ shared component), กดลบฟอนต์ที่ `/admin/font-review`,
   หน้า `/admin/payouts` ตารางสรุปรายไตรมาส
1b. **ส่งตัวอย่างเอกสารใบสรุปการโอนส่วนแบ่ง** ให้ Claude แก้ `src/lib/payout-doc.ts` (ตอนนี้เป็น
   layout ชั่วคราว) + เคาะว่าต้องมีหัก ณ ที่จ่าย/เลขที่เอกสารไหม
2. **Stripe ขั้นที่ 2 — ทดสอบบน production ด้วย test key** (ขั้นที่ 1 ที่เครื่องผ่านแล้ว)
   · push + deploy โค้ดล่าสุดก่อน
   · Cloudflare Pages env ให้ครบ: `STRIPE_SECRET_KEY` (มีแล้ว) + **`STRIPE_WEBHOOK_SECRET`** +
     `SUPABASE_SERVICE_ROLE_KEY` + `RESEND_API_KEY` + Turnstile + `CF_DEPLOY_HOOK`
   · Stripe (โหมด Test) → Webhooks → endpoint `https://<โดเมน>/api/stripe-webhook`
     เลือก 2 events: `checkout.session.completed` + `checkout.session.async_payment_succeeded`
   · ซื้อจริงบนเว็บ PromptPay 1 + บัตร 1 → delivery ต้อง 200 → ตรวจ order/อีเมล/ไฟล์
3. **Stripe ขั้นที่ 3 — live key** (ทำหลัง DNS cutover จะได้ตั้ง webhook รอบเดียว)
   · webhook ของโหมด live **ต้องสร้างใหม่** ได้ `whsec_` คนละตัว
   · ซื้อจริงฟอนต์ถูกสุด PromptPay + บัตร แล้ว refund ทั้งคู่
3b. **ล้างข้อมูลทดสอบใน DB** ก่อนเปิดขาย — order ทดสอบ (`cs_test_*`) + แถว seed `ORTEST-*`
   → ลบ `download_logs` → `entitlements` → `orders` (order_items ลบตามด้วย cascade)
   แล้วรีเซ็ต `doc_counters` prefix `OR` ถ้าอยากให้ใบจริงเริ่มที่ OR-0001
3c. **ถอดฟอนต์ทดสอบออกจากเว็บ** — `test-error` (฿25,000) และ `TEST 02` ยัง publish อยู่จริง
   โผล่ในสไลด์ "ฟอนต์ที่คุณน่าจะสนใจ" ด้วย
4. ย้ายฟอนต์ 35 ตัวจากเว็บเก่า (ใช้ปุ่ม ⚡ ใน FontForm)
5. Zoho Mail `info@dhammadha.com` (ตอนนี้ใช้ `dhammadha@outlook.com` ชั่วคราว)
   · **พอมีเมลจริงแล้วต้องกลับไปแก้ Stripe → Settings → Business → Customer support email**
   (ตอนนี้เป็น outlook ชั่วคราว ลูกค้าเห็นอีเมลนี้บนหน้าจ่ายเงิน/ใบเสร็จของ Stripe)
6. DNS cutover → dhammadha.com (ต้อง proxied/เมฆส้ม) + **อัป Supabase Auth Site URL/Redirect URLs**
7. เปิดตัว + เริ่มชวน designer ผ่าน `/become-a-designer`
8. (รอข้อมูลขาย) Phase 4.1 Subscription ต่อ

รายละเอียด/เหตุผลของแต่ละข้อ (Stripe/ย้ายฟอนต์/DNS ฯลฯ) → [docs/ROADMAP.md](docs/ROADMAP.md) แต่ละ Phase ·
Phase D dashboard → [docs/design/DESIGN.md](docs/design/DESIGN.md) §18

## แผนที่เอกสาร — ไปอ่านที่ไหนต่อ

| ต้องการอะไร | ไปที่ |
|---|---|
| Commands, route structure, auth/roles, DB tables | [CLAUDE.md](CLAUDE.md) |
| แผนธุรกิจเต็ม, รายละเอียดทุก phase backend, เช็คลิสต์ go-live | [docs/ROADMAP.md](docs/ROADMAP.md) |
| ดีไซน์ระบบ (สี/ฟอนต์/spacing), ประวัติ redesign แต่ละ phase, กับดัก/หนี้ที่จงใจไม่แก้ | [docs/design/DESIGN.md](docs/design/DESIGN.md) |
| Subscription phase 4.1 แผนละเอียด | [docs/PHASE-4.1-SUBSCRIPTION.md](docs/PHASE-4.1-SUBSCRIPTION.md) |
| Decision/gotcha ที่ derive จาก docs ไม่ได้, feedback วิธีทำงาน, งานค้างล่าสุด | memory index: `~/.claude/projects/-Users-montonn-Desktop-dhammadha-web/memory/MEMORY.md` |

## วิธีทำงานของ Claude ในโปรเจกต์นี้ (ย่อจาก memory — [[feedback_git_workflow]] [[feedback_scope]])

- Git: commit ในเครื่องบน branch ปัจจุบันเท่านั้น **ห้าม push/deploy/สร้าง branch เอง** — เจ้าของ push+deploy เอง
- ทำเฉพาะสิ่งที่สั่ง ห้ามแก้ที่ไม่เกี่ยวข้อง; copy หน้าเว็บห้ามใช้คำ B2B/B2C
- งานใหญ่หลายไฟล์/หลาย section (เช่นแก้ตาม DESIGN.md ทีละ phase) — เก็บ note ระหว่างทางไว้ใน
  scratchpad ของ session (ต่อ subsection ที่ทำ) แทนการเปิดอ่านไฟล์เอกสารใหญ่ซ้ำทั้งไฟล์ทุกครั้ง
  ที่ต้องการ context — อ่านเฉพาะ section ที่เกี่ยวกับงานจริง (`grep`/`offset+limit`) ประหยัด token
- จบงานแต่ละก้อน → อัปเดตตาราง "สถานะปัจจุบัน"/"งานที่เหลือ" ในไฟล์นี้ให้ตรง + เขียน/อัปเดต
  memory (`project` type) เก็บเฉพาะ decision/gotcha ที่หาที่อื่นไม่ได้ — **ไม่ log รายละเอียดที่
  derive จาก git log/docs ได้อยู่แล้ว**

---
*อัปเดตล่าสุด: 26 ก.ค. 2026 (ต่อ Stripe จริง + ทดสอบขั้นที่ 1 ผ่าน · ตะกร้าหลายฟอนต์ + `order_items` 0069–0071 · สัญญาอนุญาตของดีไซน์เนอร์แสดงในหน้าฟอนต์/ดาวน์โหลด · ตะกร้าบนมือถือ + ประวัติดาวน์โหลดใน admin orders)*
