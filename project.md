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

## สถานะปัจจุบัน (24 ก.ค. 2026)

| ส่วน | สถานะ |
|---|---|
| Backend Phase 0–3 (ซ่อมช่องโหว่ / go-live / quote-to-cash manual / Stripe checkout) | ✅ โค้ดเสร็จ + apply DB จริงแล้ว |
| Backend Phase 4.2–4.3 (Revenue & Payout / Analytics + Search) | ✅ โค้ดเสร็จ + apply DB จริงแล้ว |
| Backend Phase 4.1 (Subscription) | ⏸ รอข้อมูลยอดขายจริง + waitlist ก่อนเคาะราคา/กติกา — Milestone A+B เสร็จ, C (`sub-font` Edge Fn + Tauri app) และ D (เปิด trial) ยกไปหลัง go-live |
| Redesign หน้าสาธารณะ Phase 0–10 (หน้าแรก, /fonts, FontDetail, เอกสาร, become-a-designer, contact, verify, auth, account, quote, subscribe, checkout) | ✅ เสร็จหมด — merge เข้า `main` แล้ว |
| Redesign dashboard admin/designer | ✅ restyle ครบทุกหน้า (Phase D1–D4) — ดู [docs/design/DESIGN.md](docs/design/DESIGN.md) §18 · ยังไม่ตรวจสดหลัง login |
| Dashboard: รวม designer section ของ admin + ปุ่มลบฟอนต์ + share มือถือ | ✅ โค้ดเสร็จ (24 ก.ค. 2026) — `/admin/*` designer section เป็น wrapper ครอบ `src/components/dashboard/Own*.tsx` ชุดเดียวกับ `/designer/*` แล้ว (ไม่มีปุ่มลบ) · ปุ่มลบย้ายไป `/admin/font-review` พร้อม modal พิมพ์ชื่อยืนยัน |
| Payout รายไตรมาส + สรุปยอดต่อ designer + เอกสาร/อีเมล | ✅ โค้ดเสร็จ + apply DB จริงแล้ว (0064/0065, 24 ก.ค. 2026) — จ่ายทุก 3 เดือน โอน ม.ค./เม.ย./ก.ค./ต.ค. · **เลย์เอาต์ PDF ใน `src/lib/payout-doc.ts` ยังเป็น placeholder รอตัวอย่างเอกสารจากเจ้าของ** |
| Dashboard รอบ 2: รายได้ designer 4 กล่องกดได้ + Payouts filter ช่วงเวลา + Fonts search | ✅ โค้ดเสร็จ (24 ก.ค. 2026) — filter dropdown (ไตรมาสนี้/ก่อน/3 ปี/**ทั้งหมด**) helper กลางใน `src/lib/revenue.ts` (`periodOptions`/`monthsInPeriod`/`buildFontSales`) · ศัพท์บนจอ B2C→Retail Font · โหมดรายปี/ทั้งหมดใน Payouts = อ่านอย่างเดียว · ตาราง Retail Font **แยกแถวตามจุดราคา** · ยอดค้างโอน = **all-time outstanding** (`earned Retail − paid`) เงินค้างเก่าไม่หาย |
| Dashboard: เมนู Orders + สถานะการโอนตามเวลา | ✅ โค้ดเสร็จ + apply DB (0066/0067, 24 ก.ค. 2026) — หน้า `/admin/orders` (Retail/Subscription tab) · สถานะ payout ต่อ designer (rollup): **ยังไม่ถึงรอบโอน**(เขียวอ่อน)/**รอโอน**(เหลือง)/**ค้างชำระ**(แดง โผล่เสมอ)/จ่ายครบ · badge นับ รอโอน+ค้างชำระ (due-based, 0067) |
| เกณฑ์เลือกฟอนต์ "น่าจะสนใจ" / "คัดสรรพิเศษ" | ⏳ ยังไม่ทำ (เฟส 3 ของแผน) — ตอนนี้สุ่มล้วน ต้องเปลี่ยนเป็นตาม tag/category + ยอดขาย ซึ่งต้องมี RPC `font_sales_counts()` ใหม่ |
| Go-live จริง (ย้ายฟอนต์ 35 ตัว, Stripe, Zoho, DNS cutover) | ⏳ ยังไม่ทำ — เป็นงานปฏิบัติการของเจ้าของทั้งหมด ดูด้านล่าง |

**Branch:** ทำงานบน `main` สายเดียว — **มีงาน dashboard redesign ค้างอยู่แบบยังไม่ commit**
(เจ้าของขอ commit เองผ่าน GitHub Desktop รอบนี้ ไม่ใช่ Claude commit ให้)

## งานที่เหลือ (เรียงลำดับ)

1. **ตรวจสด dashboard หลัง login** — Claude verify เองไม่ได้ (ไม่กรอกรหัสผ่าน) เจ้าของ spot-check
   หน้า admin/designer ทุกหน้าว่า restyle แล้วหน้าตาถูก + ทดสอบฟีเจอร์โปรร้าน (ตั้ง/ปิด แล้วส่วนลด
   รายฟอนต์ไม่หาย) + ปุ่มแชร์หน้า font detail
   · **รอบล่าสุด (24 ก.ค.)**: เทียบ `/admin` กับ `/designer` ทีละหน้าว่าเหมือนกัน, ลอง login ด้วย
   บัญชี designer จริงด้วย (แตะ shared component), กดลบฟอนต์ที่ `/admin/font-review`,
   หน้า `/admin/payouts` ตารางสรุปรายไตรมาส
1b. **ส่งตัวอย่างเอกสารใบสรุปการโอนส่วนแบ่ง** ให้ Claude แก้ `src/lib/payout-doc.ts` (ตอนนี้เป็น
   layout ชั่วคราว) + เคาะว่าต้องมีหัก ณ ที่จ่าย/เลขที่เอกสารไหม
2. ทดสอบ B2C Stripe + quote-to-cash + designer quotes/revenue/analytics ด้วยบัญชีจริงบน production
3. ตั้งค่า Stripe จริง (env keys + webhook) — มีบัญชี "DHAMMADHA STUDIO" + PromptPay แล้ว
4. ย้ายฟอนต์ 35 ตัวจากเว็บเก่า (ใช้ปุ่ม ⚡ ใน FontForm)
5. Zoho Mail `info@dhammadha.com` (ตอนนี้ใช้ `dhammadha@outlook.com` ชั่วคราว)
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
*อัปเดตล่าสุด: 24 ก.ค. 2026 (session dashboard: designer section + payout รายไตรมาส/all-time + Orders + สถานะการโอน)*
