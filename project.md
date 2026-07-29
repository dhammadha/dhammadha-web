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
| เทียบ payment gateway: Payso vs Stripe vs Omise | ✅ ตัดสินใจแล้ว (29 ก.ค. 2026, ไม่แตะโค้ด — บันทึกไว้กันรื้อซ้ำ) **สรุป: อยู่กับ Stripe ต่อ ไป go live ให้จบ** · ค่าธรรมเนียม (บวก VAT 7% ทั้ง 3 เจ้าเหมือนกัน) บัตรไทย Payso 2.95% / Omise 3.65% / Stripe 3.65%+฿10 · PromptPay 1.35% / 1.65% / 1.65% → **ฟอนต์ ฿990 จ่าย PromptPay ต่างกันแค่ ~฿3/ออเดอร์** (บัตรต่าง ฿18) และยังไม่เปิดขายจึงไม่รู้สัดส่วนบัตร:PromptPay · **Payso = PaySolutions** (`paysolutions.asia`) — redirect flow พื้นฐานเป็น HTML form POST ส่ง `total` ดิบ **ไม่มีลายเซ็น แก้ราคาเป็น ฿1 ได้** ต้องใช้ Secure Link API เท่านั้น · **postback ไม่มี signature** ต้องยิง Inquiry API (`/order/orderdetailpost`) ถามยอดจริงทุกครั้งก่อน mark paid · ไม่มี line items (มีแค่ `orderDetail` string เดียว) → ต้อง look up ตะกร้าจาก `order_items` ด้วย refno เอง + refno ต้องเป็นตัวเลข 12 หลัก unique · **ย้ายแล้วเสีย `consent_collection` = หลักฐานยอมรับสัญญาอนุญาตที่ Stripe เก็บให้ ซึ่งธุรกิจขายสิทธิ์ฟอนต์ต้องการ Payso/Omise ไม่มีเทียบเท่า** · **recurring ของ Payso มีจริงแต่ดิบ** — `restpayrecurring` สั่งตัดทีละงวด เราต้องยิงเองล่วงหน้า 1 วัน ระบบตัด 07:30–09:00 น. เท่านั้น ไม่มี plan object/auto-renew/dunning/retry/portal → ต้องเขียน scheduler เอง (pg_cron / Cloudflare Cron เพราะ static export) scheduler พลาด = ไม่ถูกตัดเงินเงียบ ๆ · **จุดเดียวที่ Payso ชนะขาดคือ subscription ฿290/ด. (3.2% vs Stripe 7.6%) เพราะ ฿10 คงที่ทำร้ายยอดเล็ก — แต่ Phase 4.1 ยัง pause อยู่** · **กลับมาพิจารณาใหม่เมื่อ:** ขายจริง 2–3 เดือนแล้วบัตรเกิน ~40% ของออเดอร์ / ตัดสินใจเปิด subscription จริงจัง · ถ้าทำ subscription บน Stripe → ดันรายปี ฿2,900 เป็นตัวหลัก (4.3% vs 7.6%) · แผนเต็ม: `~/.claude/plans/payso-virtual-hennessy.md` |
| **แยกแบรนด์แพลตฟอร์มออกจาก Dhammadha** — เตรียมโค้ด | ✅ โค้ดเสร็จ (29 ก.ค. 2026, ไม่แตะ DB) **ชื่อยังไม่เคาะ โค้ดยังเป็น DHAMMADHA STUDIO ทั้งหมด** · เหตุผลที่ต้องแยก: designer ต้องฝากขายในร้านของคู่แข่งที่กินค่าคอม 25% ด้วย = conflict of interest (เหตุผลรอง: แผนขยายอาเซียน) · โครงสร้างที่เลือก: แพลตฟอร์ม = แบรนด์ใหม่, **Dhammadha Studio = foundry เจ้าหนึ่งบนแพลตฟอร์ม** (`dhammadha.com` เก็บไว้เป็นเว็บสตูดิโอ ชี้เข้าหน้าร้าน) · **`src/lib/brand.ts` = จุดเดียวที่นิยามชื่อ/โดเมน/อีเมล** เปลี่ยนชื่อ = แก้ไฟล์เดียว (ทดสอบแล้วจริง: สลับเป็น TYPEDEE → title/nav/footer/mailto/เนื้อสัญญาเปลี่ยนตามทั้งเว็บ) · **แยกสามชั้นในโค้ด: แพลตฟอร์ม (เปลี่ยน) / foundry Dhammadha (คง) / `LEGAL_ENTITY` "ธรรมดาสตูดิโอ" = คู่สัญญาในหน้ากฎหมาย (คง — สัญญายังออกในนามนิติบุคคลเดิม)** · **ผลค้นโดเมน RDAP: `typedee.com` ว่าง · รากอาเซียนชนกำแพงหมด** (nimit/likhit/lontar/kawi/likha + รูปแปลง จดหมดตั้งแต่ 2000–2021 → ต้องซื้อตลาดรอง $3k–30k) · `Aksara` ถูก foundry อินโดฯ ใช้แล้ว |
| **โครงสร้างนิติบุคคล + ภาษี** | ✅ ตัดสินใจแล้ว (30 ก.ค. 2026, ไม่แตะโค้ด) — ธรรมดาสตูดิโอเป็นชื่อในวงการเท่านั้น **โดยนิตินัยยังเป็นบุคคลธรรมดา ไม่เคยจดบริษัท** · **เลือกแบบ A: บริษัททำแพลตฟอร์มอย่างเดียว รับเฉพาะ 25% · ธรรมดาสตูดิโอรับ 75% ในนามบุคคลเหมือน designer ทุกคน** · เหตุผลหลัก: **75/25 เป็นอัตราประกาศสาธารณะที่ทุกคนได้เท่ากัน = หลักฐาน arm's length ที่พิสูจน์ได้เอง** (ธุรกรรมบริษัท↔กรรมการคือจุดที่สรรพากรเพ่งเล็งที่สุด) · แบบ B (รวมรายได้ฟอนต์เข้าบริษัท) ตกเพราะ **บังคับโอนลิขสิทธิ์ฟอนต์เข้าบริษัท** (จำหน่ายทรัพย์สิน ต้องตีมูลค่า) + รื้อเหตุผลที่เพิ่งแยกแบรนด์ไป · ภาษีไม่ใช่ตัวตัดสิน: CIT SME 15% + ปันผลหัก 10% ≈ 23.5% ซึ่งไม่ได้ชนะ PIT ขั้นบันไดในช่วงรายได้ต่ำ · **ถ้ารายได้ฟอนต์ส่วนตัวโตมากค่อยตั้งบริษัทที่สองสำหรับ foundry** (แยกทีหลังง่ายกว่าแยกของที่รวมไปแล้ว) · **ราคาที่แสดง (฿990) = รวม VAT แล้ว** พอจด VAT ค่อยแยก 7% ในใบเสร็จ ลูกค้าไม่เห็นราคาขึ้น |
| Stripe Connect (จ่ายเงินเข้า designer โดยตรง) | ❌ **พิจารณาแล้วไม่เอา** (30 ก.ค. 2026) — ไทยรองรับ **direct charges + application fee เฉพาะ TH→TH** แต่ **`separate charges & transfers` ไม่รองรับ ระบุชัดเจน** และ destination charges ไม่อยู่ในรายการ · direct charge 1 ครั้งผูก connected account เดียว → **ตะกร้าข้ามร้าน (`0069`–`0071`, ใบ OR-2569-0008) ต้องถอดทิ้ง** ตะกร้าจาก 3 คน = 3 charges = PromptPay สแกน QR 3 ครั้ง · designer ทุกคนต้องผ่าน KYC + **selfie (API ทำไม่ได้ ต้อง redirect)** และสมัครแทนไม่ได้ ต้องติดต่อฝ่ายขาย Stripe → กั้น funnel รับ designer · เงินเข้าทันที = ขัดนโยบายจ่ายรายไตรมาส · **ทางที่เลือกแทน: แก้ที่สัญญาไม่แตะท่อเงิน** เพราะตัวการ/ตัวแทนตัดสินที่ "ใครควบคุมสินค้าก่อนส่งมอบ" ไม่ใช่เส้นทางเงิน |
| Go-live จริง (ย้ายฟอนต์ 35 ตัว, Stripe, Zoho, DNS cutover) | ⏳ ยังไม่ทำ — **ต้องเคาะชื่อ+โดเมน (ข้อ 0) และจดบริษัท (ข้อ 0b) ก่อน** เพราะงานข้อ 2/3/5/6 ผูกกับทั้งโดเมนและนิติบุคคล (บัญชี Stripe ต้องตรงกับนิติบุคคลที่รับเงิน) ทำก่อนแล้วเปลี่ยนทีหลัง = รื้อใหม่หมด ดูด้านล่าง |

**Branch:** ทำงานบน `main` สายเดียว — งานถึง `85b0b8c` commit แล้วครบ
(เจ้าของ push เองผ่าน GitHub Desktop · push ถึง `2f30cce` แล้ว เหลือ `85b0b8c` รอ push)
· **ก่อนทดสอบ Stripe บน production ต้องเช็คว่า Cloudflare deploy รอบล่าสุดขึ้นแล้วจริง** —
DB apply 0069–0071 ไปก่อนหน้าโค้ด ถ้าเว็บยังเป็น bundle เก่าจะได้ทดสอบตะกร้าเวอร์ชันเก่า

## งานที่เหลือ (เรียงลำดับ)

0. **🔴 เคาะชื่อแพลตฟอร์ม + จดโดเมน — บล็อกงาน go-live ทั้งหมด**
   · ข้อ 2/3/5/6 ด้านล่าง (Stripe ToS URL + webhook, Zoho, DNS, Supabase Site URL) ผูกกับโดเมน
     ทำบนโดเมนเก่าแล้วเปลี่ยนทีหลัง = รื้อทำใหม่ทุกข้อ + license PDF ที่ออกไปแล้วอ้างโดเมนเก่า
   · ตอนนี้แพลตฟอร์มมีลูกค้า 0 คน designer 0 คน = จังหวะที่ถูกที่สุดเท่าที่จะเป็นไปได้
   · **จดโดเมนก่อนพูดชื่อในที่สาธารณะ** + ค้นเครื่องหมายการค้าที่กรมทรัพย์สินฯ (จำพวก 9/35/42)
   · โค้ดพร้อมแล้ว — เคาะชื่อเมื่อไร แก้ `src/lib/brand.ts` ไฟล์เดียว แล้วเหลืองานที่ **ยังไม่ได้ทำ**:
     (ก) `supabase/functions/download-font/index.ts` มี `BRAND_DOMAIN` สำเนาของตัวเอง (Deno import
         `lib/brand.ts` ไม่ได้) แก้แล้ว **ต้อง redeploy** ไม่งั้นไฟล์ที่ขายออกไปถูกประทับโดเมนเก่า
     (ข) โลโก้/wordmark ใหม่ใน `/public` (`LOGO_SRC`) — ตอนนี้ยังเป็นโลโก้ Dhammadha
     (ค) ทบทวน**ถ้อยคำ**หน้ากฎหมาย (terms/privacy/refund/agreement/designer-agreement) ว่าประโยคไหน
         ควรพูดถึงแพลตฟอร์ม ประโยคไหนพูดถึงนิติบุคคล — โค้ดแยกตัวแปรให้แล้ว แต่ถ้อยคำยังไม่ได้ทบทวน
     (ง) โซเชียล (`SOCIAL` ใน brand.ts) ยังเป็นของสตูดิโอ — ตัดสินใจว่าจะเปิดบัญชีใหม่ให้แพลตฟอร์มไหม
     (จ) `dhammadha.com` → ทำเป็นเว็บสตูดิโอ ชี้ปุ่มซื้อไปหน้าร้านบนแพลตฟอร์ม

0b. **🔴 จดบริษัท (แบบ A) — บล็อก go-live เท่ากับข้อ 0**
   · **บัญชี Stripe ต้องตรงกับนิติบุคคลที่รับเงิน** เปิดขายในนามบุคคลก่อนแล้วค่อยจดบริษัท
     = onboard Stripe ใหม่ทั้งชุด (KYC/bank/ToS/webhook) + ทำสัญญา designer ใหม่ภายหลัง
   · โดเมน/Supabase/Cloudflare ควรอยู่ในชื่อบริษัทด้วย
   · **คำถามที่ต้องถาม CPA (หยิบไปคุยได้เลย):**
     1. **บริษัทลงบัญชีเป็นตัวการ (principal) หรือตัวแทน (agent)?** — กระทบเกณฑ์ VAT 4 เท่า:
        ตัวการบันทึก ฿990 เต็ม ถึง 1.8 ล้านที่ ~152 ชุด/เดือน · ตัวแทนบันทึกค่าคอม ฿247.50
        ถึงที่ ~606 ชุด/เดือน · **ข้อสรุป "รายได้ยังไม่ถึงเกณฑ์ VAT" ขึ้นกับข้อนี้ทั้งหมด**
        ข้อเท็จจริงเอียงไปทางตัวแทน (designer ตั้งราคาเอง + สัญญาเป็นฉบับ designer +
        ลิขสิทธิ์เป็นของ designer + ไม่มี inventory risk) แต่เงินเข้า Stripe เต็มจำนวน
     2. **"75% ของอะไร" เมื่อจด VAT** — ฿990 รวม VAT → ฐานสุทธิ ฿925.23 · 75% ของฐานสุทธิ
        = ฿693.92 vs 75% ของราคาเต็ม = ฿742.50 **ต่างกัน ฿48.58/ชุด (~6.5%)**
        ⚠️ ต้องเขียนในสัญญา**ก่อนเซ็น designer คนแรก** ไม่งั้นวันที่จด VAT = ไปเปลี่ยน
        เงื่อนไขกับคนที่เซ็นไปแล้ว (`/designer-agreement` ข้อ 3 ตอนนี้เขียนแค่ "75/25")
     3. ส่วนแบ่งที่จ่าย designer เป็นเงินได้ประเภท **40(3) ค่าลิขสิทธิ์ หรือ 40(8) ธุรกิจ**
        และ**อัตราหัก ณ ที่จ่าย**เท่าไร (ต่างกันตาม `entity_type` บุคคล/นิติบุคคล)
     4. จังหวะจดทะเบียน VAT และผลต่อ margin ตอนข้ามเกณฑ์
   · **สิ่งที่ต้องเขียนเพิ่มในสัญญา** (ยังไม่ได้เขียน): แพลตฟอร์มรับชำระเงิน**แทน**นักออกแบบ
     ในฐานะตัวแทนเรียกเก็บเงิน และนักออกแบบเป็นคู่สัญญากับผู้ซื้อ — ช่วยยันฝั่งตัวแทน
     โดยไม่ต้องรื้อท่อเงิน (ดูเหตุผลที่ไม่เอา Stripe Connect ในตารางสถานะ)

1. **ตรวจสด dashboard หลัง login** — Claude verify เองไม่ได้ (ไม่กรอกรหัสผ่าน) เจ้าของ spot-check
   หน้า admin/designer ทุกหน้าว่า restyle แล้วหน้าตาถูก + ทดสอบฟีเจอร์โปรร้าน (ตั้ง/ปิด แล้วส่วนลด
   รายฟอนต์ไม่หาย) + ปุ่มแชร์หน้า font detail
   · **รอบล่าสุด (24 ก.ค.)**: เทียบ `/admin` กับ `/designer` ทีละหน้าว่าเหมือนกัน, ลอง login ด้วย
   บัญชี designer จริงด้วย (แตะ shared component), กดลบฟอนต์ที่ `/admin/font-review`,
   หน้า `/admin/payouts` ตารางสรุปรายไตรมาส
1b. **ส่งตัวอย่างเอกสารใบสรุปการโอนส่วนแบ่ง** ให้ Claude แก้ `src/lib/payout-doc.ts` (ตอนนี้เป็น
   layout ชั่วคราว)
   · **เคาะแล้ว (30 ก.ค. 2026): ต้องมีหัก ณ ที่จ่าย** — พอเป็นบริษัท เวลาจ่ายส่วนแบ่งมีหน้าที่
     หักภาษี ณ ที่จ่ายและ**ออกใบ 50 ทวิ**ให้ designer ทุกราย (เหลือแค่รออัตราจาก CPA — ข้อ 0b.3)
   · **ของที่มีอยู่แล้ว ไม่ต้องสร้างใหม่:** `users.entity_type` (`'individual'|'juristic'`,
     migration `0008` + CHECK) เก็บผ่าน onboarding/`OwnSettings` แล้ว → แยกอัตราได้ทันที ·
     `users.tax_id` (13 หลัก validate แล้ว) / `business_name` / `address` ครบสำหรับใบ 50 ทวิ ·
     `doc_counters` (`0035`/`0061`) ออกเลขที่เอกสารได้ด้วยกลไกเดิม
   · **มีตัวอย่างการหัก 3% ทำงานอยู่แล้ว** ที่ `quote-doc.ts:200` + `PrintLightbox.tsx:70`
     ⚠️ **แต่เป็นคนละธุรกรรม ห้าม reuse อัตราอัตโนมัติ** — ของ quote คือลูกค้าองค์กรหักจาก
     designer (แพลตฟอร์มไม่แตะเงิน) ของ payout คือบริษัทหักตอนจ่ายส่วนแบ่ง
   · **สิ่งที่ต้องแก้เมื่อได้อัตรา:** รวม `0.03` ที่ hardcode ซ้ำ 2 ที่เป็น helper ใน
     `src/lib/revenue.ts` (แบบเดียวกับ `designerShareOf()`) แยกสองเคส · `PayoutDocData`
     เพิ่ม `whtRate`/`whtAmount`/`netAmount`/`docNo` · `admin/payouts` แสดงยอดก่อนหัก/
     ภาษีหัก/ยอดโอนจริง — **ช่องบันทึกจ่ายต้องเป็นยอดสุทธิ** ไม่งั้นยอดค้างไม่ตรง ·
     `/designer-agreement` เพิ่มข้อความว่าจ่ายหลังหักภาษี + ออกใบ 50 ทวิให้
   · `users.vat_registered` เก็บแล้วแต่ยังไม่ถูกใช้คำนวณ (UI เขียนเองว่า "ยังไม่มีผลต่อ
     การคำนวณ") — ต้องเคาะพร้อมข้อ 0b.2
2. **Stripe ขั้นที่ 2 — ทดสอบบน production ด้วย test key** (ขั้นที่ 1 ที่เครื่องผ่านแล้ว)
   · push + deploy โค้ดล่าสุดก่อน
   · Cloudflare Pages env ให้ครบ: `STRIPE_SECRET_KEY` (มีแล้ว) + **`STRIPE_WEBHOOK_SECRET`** +
     `SUPABASE_SERVICE_ROLE_KEY` + `RESEND_API_KEY` + Turnstile + `CF_DEPLOY_HOOK`
   · Stripe (โหมด Test) → Webhooks → endpoint `https://<โดเมน>/api/stripe-webhook`
     เลือก 2 events: `checkout.session.completed` + `checkout.session.async_payment_succeeded`
   · **Terms of service URL → `https://<โดเมน>/agreement/`** (Settings → Public details)
     ตั้งได้ **ค่าเดียวทั้งบัญชี override ต่อ session ไม่ได้** จึงชี้ไปสัญญาอนุญาต ไม่ใช่ `/terms/`
     — หน้า `/agreement/` มีย่อหน้า "ร่ม" อ้างถึงข้อกำหนดการใช้งาน + สัญญาฉบับของดีไซน์เนอร์แล้ว
     (29 ก.ค. 2026) · ต้องตั้ง **ทั้งโหมด test และ live** ไม่งั้นสร้าง session ไม่ได้ = ปุ่มซื้อพัง
   · **⚠️ ต้องลองตอนนี้: `custom_text[terms_of_service_acceptance][message]`** (เพดาน 1200 ตัวอักษร)
     ตอนนี้ `checkout-service.ts` **ยังไม่ได้ตั้ง** → หน้าจ่ายเงินโชว์ข้อความ default ของ Stripe
     ("ยอมรับข้อกำหนดในการให้บริการ" เพราะ `locale: "th"`) ซึ่งอ่านแล้วเหมือนข้อกำหนดเว็บ
     ทั้งที่ลิงก์ชี้ไปสัญญาอนุญาต → ควรเขียนทับเป็น "ข้าพเจ้าได้อ่านและยอมรับสัญญาอนุญาตใช้งานฟอนต์"
     **เอกสาร Stripe ไม่ระบุว่ารองรับลิงก์/markdown ในข้อความนี้ไหม — ต้องลองจริงบนหน้าจ่ายเงิน**
     ถ้าใส่ลิงก์ไม่ได้ ต้องพึ่งลิงก์จากช่องติ๊กมาตรฐานอย่างเดียว
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
*อัปเดตล่าสุด: 30 ก.ค. 2026 (โครงสร้างนิติบุคคล: จดบริษัททำแพลตฟอร์มอย่างเดียว จ่าย 75% ให้ธรรมดาสตูดิโอในนามบุคคล · ราคารวม VAT · Stripe Connect ไม่เอา · หัก ณ ที่จ่าย = ต้องมี · ก่อนหน้า 29 ก.ค.: แยกแบรนด์แพลตฟอร์ม `src/lib/brand.ts` + ค้นโดเมน — รอเคาะชื่อ · เทียบ payment gateway Payso/Stripe/Omise → ตัดสินใจอยู่กับ Stripe · ก่อนหน้า 26 ก.ค.: ต่อ Stripe จริง + ทดสอบขั้นที่ 1 ผ่าน · ตะกร้าหลายฟอนต์ + `order_items` 0069–0071 · สัญญาอนุญาตของดีไซน์เนอร์แสดงในหน้าฟอนต์/ดาวน์โหลด · ตะกร้าบนมือถือ + ประวัติดาวน์โหลดใน admin orders)*
