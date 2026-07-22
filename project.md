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

## สถานะปัจจุบัน (22 ก.ค. 2026)

| ส่วน | สถานะ |
|---|---|
| Backend Phase 0–3 (ซ่อมช่องโหว่ / go-live / quote-to-cash manual / Stripe checkout) | ✅ โค้ดเสร็จ + apply DB จริงแล้ว |
| Backend Phase 4.2–4.3 (Revenue & Payout / Analytics + Search) | ✅ โค้ดเสร็จ + apply DB จริงแล้ว |
| Backend Phase 4.1 (Subscription) | ⏸ รอข้อมูลยอดขายจริง + waitlist ก่อนเคาะราคา/กติกา — Milestone A+B เสร็จ, C (`sub-font` Edge Fn + Tauri app) และ D (เปิด trial) ยกไปหลัง go-live |
| Redesign หน้าสาธารณะ Phase 0–10 (หน้าแรก, /fonts, FontDetail, เอกสาร, become-a-designer, contact, verify, auth, account, quote, subscribe, checkout) | ✅ เสร็จหมด — merge เข้า `main` แล้ว |
| Redesign dashboard admin/designer | ⏳ ยังไม่เริ่ม — เจ้าของสั่งรอรอบแยก |
| Go-live จริง (ย้ายฟอนต์ 35 ตัว, Stripe, Zoho, DNS cutover) | ⏳ ยังไม่ทำ — เป็นงานปฏิบัติการของเจ้าของทั้งหมด ดูด้านล่าง |

**Branch:** ทำงานบน `main` สายเดียว (ไม่มี feature branch ค้าง ณ ตอนนี้)

## งานที่เหลือ (เรียงลำดับ)

1. ทดสอบ B2C Stripe + quote-to-cash + designer quotes/revenue/analytics ด้วยบัญชีจริงบน production
2. ตั้งค่า Stripe จริง (env keys + webhook) — มีบัญชี "DHAMMADHA STUDIO" + PromptPay แล้ว
3. ย้ายฟอนต์ 35 ตัวจากเว็บเก่า (ใช้ปุ่ม ⚡ ใน FontForm)
4. Zoho Mail `info@dhammadha.com` (ตอนนี้ใช้ `dhammadha@outlook.com` ชั่วคราว)
5. DNS cutover → dhammadha.com (ต้อง proxied/เมฆส้ม) + **อัป Supabase Auth Site URL/Redirect URLs**
6. เปิดตัว + เริ่มชวน designer ผ่าน `/become-a-designer`
7. (แยกรอบ) Redesign dashboard admin/designer
8. (รอข้อมูลขาย) Phase 4.1 Subscription ต่อ

รายละเอียด/เหตุผลของแต่ละข้อ → [docs/ROADMAP.md](docs/ROADMAP.md) §"เช็คลิสต์ตามงาน" ต้นไฟล์

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
*อัปเดตล่าสุด: 22 ก.ค. 2026*
