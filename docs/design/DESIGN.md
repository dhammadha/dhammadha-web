# DESIGN.md — ระบบดีไซน์หน้าสาธารณะ DHAMMADHA STUDIO

> ## 🚀 เริ่มงานต่อใน session ใหม่
>
> **เอกสารนี้คือตัวส่งต่องาน — ไม่ต้องลากบทสนทนาเก่ามาด้วย** ทุกการตัดสินใจ · ทุกกับดัก
> อยู่ในนี้หมดแล้ว **ไม่ต้องเปิดรูป moodboard ซ้ำ** — สเปกถูกถอดเป็นตัวเลขไว้แล้ว (รูปมีไว้อ้างอิงตอนสงสัยเท่านั้น)
>
> สถานะ: **Phase 0–10 (หน้าสาธารณะ) เสร็จทั้งหมด** · **กำลังทำ: Phase D — dashboard admin/designer (§18)**

> **เอกสารนี้คือแหล่งความจริง** ถ้าขัดกับ Claude Design project — **รีโปชนะ**
> ที่มา: moodboard จาก Figma ใน [`moodboard/`](./moodboard/) — โดยเฉพาะ [`style.png`](./moodboard/style.png)

---

## 0. ย้อนกลับเมื่อพัง — อ่านก่อน

**ถ้า production พัง: ใช้ Cloudflare Pages deployment rollback** (~30 วินาที) **อย่าคว้า `git revert`** — ช้ากว่า ต้องรอ build ใหม่

git tag มีไว้ **rebuild ของเดิม** ไม่ใช่เครื่องมือกู้ production:
- `v1-pre-redesign` @ `36fa60b` = ดีไซน์เดิมทั้งหมดก่อนรื้อ
- กู้ทีละไฟล์: `git checkout v1-pre-redesign -- src/components/Footer.tsx`
- แต่ละ phase มี tag ของตัวเอง (`redesign/p2-tokens`, …)

---

## 1. ข้อตกลงที่แช่แข็ง (ห้ามละเมิดโดยไม่ถามเจ้าของ)

> **ขอบเขตหมายถึง:** หน้าตาเปลี่ยนได้เต็มที่ (markup/เลย์เอาต์/โครงสร้าง element) — **ห้ามแตะคือ
> codebase/ฟีเจอร์** (logic, การคำนวณ, flow) **ถ้าเปลี่ยนหน้าตาต้องเปลี่ยน "ข้อมูลที่เรียกมาแสดง" → ถามก่อนเสมอ**

| กฎ | เหตุผล |
|---|---|
| ~~ขอบเขต = หน้าสาธารณะเท่านั้น~~ **ยกเลิกแล้ว 2026-07-22** — dashboard admin/designer เข้าคิวแล้ว | ดู §18 (Phase D) |
| **เปลี่ยนข้อมูลที่เรียกมาแสดง = ต้องถามก่อน** | เส้นแบ่งจริงระหว่าง "ดีไซน์" กับ "ฟีเจอร์" |
| ~~`src/components/Button.tsx` แช่แข็ง~~ **ยกเลิกแล้ว 2026-07-22** | dashboard เปลี่ยนไปใช้ `ui/Button` แล้ว ดู §18.1 |
| **`globals.css` บรรทัด `body { font-family }` ห้ามแตะ** | ฟอนต์ถูกใส่ที่นั่น**ที่เดียว** สลับเป็น Looped ตรงนั้น = admin เปลี่ยนฟอนต์ทั้งหมด |
| **ไม่มี dark mode — ไม่เพิ่ม dependency** | ไม่มีใครขอ / `cn()` เขียนเองพอ ไม่ต้อง clsx/cva |
| **ห้ามแตะ logic คิดราคา / flattenFont / handleBuy** | ดู §8 |
| **ทุกฟังก์ชันต้องทำงานเหมือนเดิมเป๊ะ** | นี่คือรอบดีไซน์ ไม่ใช่รอบฟีเจอร์ |

---

## 2. Typography

### 2.1 ตระกูลฟอนต์

| บทบาท | ฟอนต์ | ใช้กับ |
|---|---|---|
| **Heading** | Noto Sans Thai | หัวข้อทุกระดับ, ชื่อฟอนต์บนการ์ด, ราคา |
| **Body** | **Noto Sans Thai Looped** | เนื้อความ, คำอธิบาย, ป้ายกำกับ |
| **UI** | Noto Sans Thai | ปุ่ม, nav, control, input |

โหลดผ่าน **variable font ทั้งคู่** · CSS var `--font-noto-thai` / `--font-noto-thai-looped` ·
`Noto Sans Thai UI` ตัดทิ้ง (ไม่มีใน `next/font/google` allowlist) → UI text ใช้ Noto Sans Thai แทน

> **วัดจริง:** variable font ของทั้งคู่รวมกัน 140KB (6 ไฟล์) เทียบตัวเดียว 71KB (3 ไฟล์) — **+68KB คือราคาจริง
> ของการให้ body เป็น Looped** ไม่มีทางลดด้วยการ "ประกาศน้อยลง" เพราะ `next/font` resolve เป็น variable
> เสมอไม่ว่าจะประกาศกี่ weight ถ้าจะลด: ตัด subset `latin`/`latin-ext` ของ Looped ทิ้งได้ (~41KB) แต่ต้อง
> เช็คว่าไม่มีเนื้อความละตินปนอยู่ก่อน

### 2.2 น้ำหนัก

- **Heading ใช้ 700 (bold) กับ 800 (extra bold) เท่านั้น**
- **ลำดับความสำคัญมาจาก*ขนาด* ไม่ใช่น้ำหนัก** — ห้ามใช้ weight ไล่ชั้น

### 2.3 Type scale — ตรงจาก Figma Styles panel

**Tailwind preflight ตั้ง `html, :host { line-height: 1.5 }`** ทุกอย่างสืบทอด 1.5 มา (ไม่ใช่ font
metrics แม้ Figma จะเป็น "Auto") — ตรงกับที่เว็บทำอยู่แล้ววันนี้ ไม่ได้เปลี่ยนอะไร ผลคือหัวข้อใหญ่จะโปร่งกว่า
moodboard เล็กน้อย ถ้าต้องแก้ ใส่ `lineHeight` เฉพาะ step นั้นใน `fontSize` token

ที่มา: สเปกเต็มทีละสไตล์ใน [`moodboard/style/`](./moodboard/style/) — อ่านจาก Figma Edit-text-style dialog

| ชื่อ | ฟอนต์ | น้ำหนัก | ขนาด | tracking | ใช้ที่ |
|---|---|---|---|---|---|
| `hero` | Noto Sans Thai | ExtraBold 800 | 60 | 0% | ข้อความ hero หน้าแรก |
| `font-slug` | Noto Sans Thai | ExtraBold 800 | 48 | 0% | ชื่อฟอนต์บนหน้ารายละเอียด |
| `h1` | Noto Sans Thai | ExtraBold 800 | 40 | 0% | หัวข้อหมวด |
| `h2` | Noto Sans Thai | ExtraBold 800 | 24 | 0% | หัวข้อรอง |
| `body` | Noto Looped Thai | Regular 400 | 16 | 0% | เนื้อความ |
| `body-sm` | Noto Looped Thai | Light 300 | 14 | 0% | ป้ายกำกับ, ลิงก์ footer, **ทุกช่องกรอกฟอร์ม** |
| `ui` | Noto Sans Thai | Bold 700 | 16 | 0% | ปุ่ม, nav, control |
| `fc-heading` | Noto Sans Thai | Bold 700 | 16 | 0% | ชื่อฟอนต์บนการ์ด |

**หัวข้อทุกระดับ ExtraBold 800 เท่ากันหมด — tracking = 0% ทุกตัว ห้ามใส่ letter-spacing เอง**

### 2.4 สไตล์เพิ่มนอกเหนือ Figma (เจ้าของอนุมัติ 2026-07-17)

| ชื่อ | ฟอนต์ | น้ำหนัก | ขนาด | ใช้ที่ |
|---|---|---|---|---|
| `badge` | Noto Sans Thai | Bold 700 | 12 | ป้าย Sale / FREE / NEW / tag |
| `footnote` | Noto Looped Thai | Light 300 | 12 | `© 2012–2026 …` ท้าย footer |
| `fc-byline` | Noto Looped Thai | Light 300 | 10 | "โดย {ดีไซน์เนอร์}" บนการ์ดฟอนต์ (ข้อยกเว้นพื้นล่าง §2.5) |

### 2.5 พื้นล่างของขนาด

| ประเภท | พื้นล่าง | สไตล์ที่ใช้ได้ |
|---|---|---|
| เนื้อความ, ลิงก์, ป้ายกำกับที่ต้องอ่านเป็นประโยค | **14px** | `body` (16) · `body-sm` (14) |
| ป้ายสั้น ๆ ที่อ่านเป็นก้อน | **12px** | `badge` (12) · `footnote` (12) |
| ต่ำกว่า 12px | ❌ ห้าม | — |

เหตุผล: อักษรไทยมีสระบน-ล่าง ที่ 9-11px ตีกันจนอ่านไม่ออก — ของเดิมมีจุดแบบนี้อยู่หลายสิบจุด (ที่มาของความ
"ดูอึดอัด" พอ ๆ กับเรื่องสี)

### 2.6 Responsive type

ใช้ **`clamp()` ใน `fontSize` token** → responsive อัตโนมัติ ไม่ต้องเขียน `md:text-*` เลยสักที่

| ชื่อ | 375 | 768 | 1280+ |
|---|---|---|---|
| `hero` | 32 | 44 | 60 |
| `font-slug` | 28 | 37 | 48 |
| `h1` | 24 | 31 | 40 |
| `h2` | 20 | 22 | 24 |
| `body`/`body-sm`/`ui`/`fc-heading` | เท่าเดิมทุกจอ | | |

---

## 3. Color

### 3.1 Palette — 5 ตัวตาม Figma (ใช้ชื่อ Figma ตรง ๆ ไม่แปลงเป็น role name)

**เหตุผลที่ไม่ใช้ role name (`accent`/`surface` แทน `navy`/`mint`):** palette มีแค่ 5 สี เล็กเกินกว่าจะคุ้ม
กับสองคำศัพท์ + Figma เป็นแหล่งความจริงด้านดีไซน์ + `navy`/`mint` มีอยู่แล้วในโค้ดด้วยค่าเดิมเป๊ะ

| Figma เรียก | ค่าจริง | ชื่อ Tailwind | ใช้ที่ |
|---|---|---|---|
| `navy` | `#2B1B3D` | `navy` | ยังไม่มีที่ใช้บนหน้าสาธารณะ — เก็บสำรอง (หัวข้อทั้งหมดเป็น `black`) |
| `mint` | `#5ECEC8` | `mint` | accent, hover ปุ่ม nav, logo, หัวใจ |
| `white` (Figma) | **`#F8F8F8`** | **`surface`** ⚠️ | พื้นการ์ด, แถบล่าง footer, ช่องกรอก, ปุ่มรอง |
| `black` | `#080808` | `black` | พื้น nav, พื้น footer, ตัวหนังสือเข้ม, ราคา |
| `grey` | `#808080` | `grey` | placeholder cover, ตัวหนังสือรองบนพื้นดำ (5.07:1 ✅) |

> ⚠️ **`white` ของ Figma = `#F8F8F8` ไม่ใช่ `#FFFFFF`** จึงตั้งชื่อ `surface` แทน — ทับ Tailwind `white`
> จริงจะกระทบ `bg-white`/`text-white` ~227 จุดใน admin/designer (เห็นได้ชัด) **เจ้าของเคาะแล้ว: ไม่ทับ**
> `body` background คงเป็น `#FFFFFF` เดิม (ดำแค่ nav/footer) → การ์ด `surface` ลอยขึ้นเองไม่ต้องพึ่งเส้นกรอบ

### 3.2 Neutral ramp — ปั่นจาก `grey #808080`

ของเดิมมีเทาดิบ ~12 เฉดไล่กันแบบไม่มีกฎ → ยุบเหลือ ramp เดียวปั่นจาก `#808080` (R=G=B ทุก step)

| token | ค่า | บนขาว | ใช้ทำอะไร |
|---|---|---|---|
| `grey-200` | `#E0E0E0` | 1.32:1 | พื้นต่างระดับ (ไม่ใช่เส้นคั่น — ดีไซน์ไม่มีเส้น) |
| `grey-400` | `#B0B0B0` | 2.17:1 | บนขาว: ไอคอนตกแต่งเท่านั้น (ห้ามตัวหนังสือ) · บนดำ: ตัวหนังสือได้ (9.23:1) |
| `grey` | `#808080` | 3.95:1 | ตัวหนังสือรอง**บนพื้นดำ**เท่านั้น (บนขาวตกคอนทราสต์ตัวเล็ก) |
| `grey-600` | `#666666` | **5.74:1 ✅** | ตัวหนังสือรอง**บนพื้นขาว** |
| `grey-800` | `#333333` | 12.63:1 ✅ | ตัวหนังสือเข้มรองจากดำ |

(`grey-50` ที่เคยปั่นเองถูกตัดทิ้ง — ซ้ำกับ `surface` จน 3/255 ตาแยกไม่ออก)

### 3.3 Feedback

`success` `#0A8A84` · `warning` `#F0C040` · `danger` `#E74C3C`

### 3.4 คอนทราสต์ (WCAG 2.1 คำนวณจริง)

`navy`/white 15.83:1 ✅ · white/black 20.03:1 ✅ · `mint`/black 10.62:1 ✅ · `grey`/black 5.07:1 ✅ ·
`grey-600`/white 5.74:1 ✅ · `grey-800`/white 12.63:1 ✅ · **`mint`/white 1.89:1 ❌ ดู §3.5**

### 3.5 🚨 `mint-text` — หนี้คอนทราสต์ที่รู้ตัวและยอมรับไว้

`mint` บนขาวตก AA (1.89:1) แต่บนดำผ่านสบาย (10.62:1) — **เจ้าของเคาะ (2026-07-17): ใช้ mint เดิมบนขาวไปก่อน**

ตั้ง token แยกไว้ให้ปรับได้บรรทัดเดียวในอนาคต: `mint-text: #5ECEC8` (**component ทุกตัวใช้ `text-mint-text`
ห้ามใช้ `text-mint` กับตัวหนังสือบนพื้นขาว**) ค่าสำรองถ้าวันหน้าอยากผ่าน AA: `#27817C` (4.65:1 ✅ เฉดเดียวกัน)

หนี้คอนทราสต์ของเดิม (ไม่เกี่ยวกับดีไซน์ใหม่): `#aaa` เดิมใช้เป็นตัวหนังสือรอง 38 จุด ได้แค่ 2.32:1 — ย้ายไป
`grey-600` (5.74:1) แก้ไปในตัว

---

## 4. รูปทรง (Shape)

### 4.0 🚫 ไม่มีเส้นกรอบ ไม่มีเส้นขอบ — ทุกส่วนของงาน (เจ้าของสั่งตรง ๆ 2026-07-17)

แยกลำดับชั้นด้วย**พื้นสี**แทนเส้น: การ์ด/ปุ่ม/ช่องกรอก/tag มีกรอบ → พื้น `surface` ลอยบน `body` แทน
เส้นคั่น footer/modal → ไม่ต้องมี พื้นดำ/surface แยกกันเองอยู่แล้ว

**ข้อยกเว้นเดียว: `focus-visible`** — CSS `outline` (ไม่ใช่ `border`) เป็นเรื่อง a11y ไม่ใช่ตกแต่ง

### 4.1 มุม — เหลี่ยม

ไม่มีมุมมนทั้งเว็บ ยกเว้นของที่กลมจริง (`rounded-full`: avatar, ปุ่มไอคอนวงกลม, จุด carousel)

**วิธีทำ:** ไม่ใส่ class `rounded-*` เลย (`border-radius` default = 0 อยู่แล้ว) **ห้ามตั้ง
`borderRadius.DEFAULT: 0` ใน config** — จะทับจุดที่เหลืออยู่ใน admin/designer โดยไม่ตั้งใจ (ผิดขอบเขตเดิม
ก่อน Phase D; ตอนนี้ dashboard เข้าคิว redesign แล้วดู §18.1 ที่ตัดจุดพวกนี้ตรง ๆ)

### 4.2 Spacing

ยึด scale ของ Tailwind (ฐาน 4px) — **ห้ามใช้ arbitrary spacing** จำนวน arbitrary value ต้องลดลงทุก phase

### 4.3 Elevation

เหลี่ยม + เงาต้องคุมมือ — moodboard แทบไม่ใช้เงาเลย ใช้พื้นต่างระดับแทน

| token | ค่า | ใช้ที่ |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | ยกเบา ๆ |
| `shadow-md` | `0 2px 12px rgba(0,0,0,0.08)` | hover การ์ด |
| `shadow-lg` | `0 8px 32px rgba(0,0,0,0.12)` | modal |

### 4.4 Motion

`duration-fast` 150ms · `duration-base` 250ms · easing `cubic-bezier(0.25, 0.1, 0.25, 1)`

---

## 5. Responsive

### 5.1 หลักการ

**Mobile-first เด็ดขาด** — class เปล่า = มือถือ แล้วค่อยเพิ่ม `sm:`/`md:`/`lg:` ขึ้นไป

### 5.2 Breakpoint — ใช้ค่าเริ่มต้นของ Tailwind ไม่ override

`sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536

> ⚠️ **บทเรียนราคาแพง:** เคย override `screens` ไว้แล้วเคลมว่า "แค่เพิ่ม ไม่พัง" — ผิด การเปลี่ยนนิยาม
> breakpoint เปลี่ยนความหมายของ `sm:` ทุกตัวที่เขียนไว้แล้ว (ทำให้ mobile grid พังจริง) **375/768/1280
> ใน §5.4 คือ "ความกว้างที่ใช้ตรวจงาน" ไม่ใช่ breakpoint — อย่าสับสนสองเรื่องนี้**

### 5.3 Container

`max-w-site` = 1200px คงเดิม · padding ไล่ตามจอ (ของเดิม `px-8` ตายตัวทำมือถือเหลือพื้นที่จริงแค่ 311px)

`ui/Container` = `max-w-site mx-auto px-4 md:px-6 lg:px-8` → ที่ 375px เหลือ **343px** (เดิม 311px)

### 5.4 ความกว้างที่ใช้ตรวจงาน

**ทุก component ต้องระบุพฤติกรรมที่ 375 / 768 / 1280** — ยังไม่ระบุ = ยังไม่เสร็จ

---

## 6. Component

### 6.1 เกณฑ์ "เสร็จ"

ต้องครบ 4 อย่าง: variants · states (`default`/`hover`/`focus-visible`/`active`/`disabled`/`loading`) ·
พฤติกรรมที่ 375/768/1280 · การ์ดใน Claude Design sheet — **`focus-visible` สำคัญเป็นพิเศษ ของเดิมไม่มีเลย**

### 6.2 รายการ (`src/components/ui/`)

| Component | สเปก |
|---|---|
| `Button` | API เหมือน `Button.tsx` เดิมเป๊ะ (`variant`/`size`/`as`) → ย้ายได้ด้วยเปลี่ยน import path |
| `Card` | ฐานของ FontCard + pricing card |
| `Badge` | Sale / FREE / NEW / tag — เหลี่ยม (เดิมเป็น pill) |
| `Input` | รวม search field ของ Nav |
| `Modal` | ใช้กับ specimen lightbox ใน `FontDetail` |
| `Container` | จัดการ `max-w-site` + responsive padding (§5.3) ที่เดียว |

### 6.3 สเปกจาก moodboard (สรุปสุดท้ายอยู่ที่ §13.x ถ้าขัดกัน §13 ชนะ)

**Nav** — พื้นดำ `#080808` · logo สี่เหลี่ยม mint + "DHAMMADHA/STUDIO" สองบรรทัด · hover ปุ่ม = พื้น mint ·
search พื้น `surface` · ไอคอนคน (anon→login, login→avatar) + ตะกร้า (`/cart` พักไว้ก่อน) · submenu หมวดหมู่
hover "ฟอนต์" (6 หมวดครบ ต้องตรง `CATEGORIES` ใน `fonts/page.tsx`)

**FontCard** — สัดส่วนการ์ด 270×215 · cover 2:1 · เหลี่ยมทั้งใบยกเว้นหัวใจ (กลม) · ป้าย Sale/FREE/NEW เก็บไว้
(moodboard ไม่วาดแต่ตัดออก = เสียฟังก์ชัน) `sale`=warning, `free`/`new`=mint

**Footer** — พื้นดำ, logo + 4 บล็อก social, 3 คอลัมน์ (ผลิตภัณฑ์/นโยบาย/ช่วยเหลือ), แถบล่างพื้นอ่อน —
โครงตรงกับของจริงเกือบหมด ทำแค่ restyle

---

## 7. หน้าแรก — โครงที่ตกลง (ผลจริงหลัง implement → §13)

ที่มา: [`main page (update).png`](./moodboard/main%20page%20(update).png) — **hero เป็นข้อความก่อน
แล้วสไลด์อยู่ใต้** (ไม่ใช่สไลด์ล้วนตามแผนรอบแรก)

| ส่วน | ทำยังไง |
|---|---|
| Hero | ข้อความ "ฟอนต์ไทยที่ *ออกแบบ* อย่างพิถีพิถัน" · **ไม่มีปุ่ม** ในกล่อง hero |
| สไลด์ใต้ hero | cover เดียวตรงกลาง ลูกศรเปล่า 8 จุด (active=ขีด mint) · **ไม่มีชื่อฟอนต์ในสไลด์** (เลี่ยงโหลดฟอนต์จริงเป็น webfont — ปลอดภัยเรื่องลิขสิทธิ์) · ไม่มีหัวข้อ "คัดสรรพิเศษ" |
| กริด "ฟอนต์ล่าสุด" | `GRID_SHOW` 7→11 + ช่อง "ดูฟอนต์ทั้งหมด" |
| ราคาและแผนบริการ | moodboard ไม่ได้วาดแต่**เก็บไว้** (เสีย = เสียทางเข้า `/subscribe` + waitlist) |

---

## 8. หนี้ที่จงใจไม่แก้ (Known debt, deliberately unfixed)

**hallmark จะฟ้องเรื่องพวกนี้ และมันจะ*ถูก*และ*ไม่เกี่ยว* — บันทึกแล้วเดินต่อ ห้ามให้ QA มารื้อเส้นขอบเขต**

| หนี้ | ทำไมไม่แก้ |
|---|---|
| **Ternary คิดราคา 5 กิ่งซ้อนใน JSX** (`FontDetail.tsx:441-473`, `FontCard.tsx:134-145`) | เข้ารหัสลำดับฟรี→ลดราคา→โปรรวม→ปกติ→ไม่มี ไม่มีเทสต์คอยจับ **โหมดพังคือลูกค้าเห็นราคาผิด** — เสี่ยงสูงสุดผลตอบแทนต่ำสุด **restyle รอบ ๆ มัน** |
| `activePromo` parse วันที่ DD/MM/YYYY ตอน render | เปลืองแต่ไม่พัง |
| `flattenFont`/`RawFont` ซ้ำ 4 ที่ | รวบแล้วเสี่ยง 401 = ฟอนต์หายทั้งกริด |
| `FontDetail.tsx` 689 บรรทัด ไม่แตกไฟล์ | markup ซ้ำที่ยอมรับได้ |
| modal เขียนเองซ้ำ 4 ตัว (admin/designer) | รวบคือ refactor นอกขอบเขต |
| `Button.tsx` legacy ค้าง `hover:bg-[#f5f5f2]` | **ถูกแล้ว** — จุดที่ยังไม่ได้ redesign ควรกลมกลืนกับของเก่าที่เหลือ |
| `font-thai` ใน `tailwind.config.ts:20` เป็น config ตาย | ไม่มีใครใช้ ปล่อยไว้ |
| search เดสก์ท็อป/มือถือใน `Nav.tsx` เขียนแยกกัน | แชร์ state `suggestions` — รวบคือ refactor เสี่ยงช่องค้นหาทุกหน้า |

✅ **บั๊กเดิม "carousel ตายถาวรถ้าโหลดในแท็บที่ซ่อนอยู่" (rAF ไม่ยิงในแท็บ hidden → autoplay ไต่เลยขอบ)
แก้แล้วใน Phase 7a** — `CoverCarousel` guard `document.hidden` ใน autoplay (ดู §13.2)

**ข้อยกเว้นเดียวที่อนุญาตให้แตะ logic:** `showCount`/`MAX_VISIBLE` ของ carousel หน้าแรก (ปลอดภัยเพราะ
`useEffect` reset `pos` เมื่อค่านี้เปลี่ยนอยู่แล้ว — รอยต่อที่ตั้งใจไว้) carousel อื่น (`DesignerDetail`,
`FontDetail`) **ห้ามแตะ logic** restyle ที่ชั้น CSS ได้หมด

---

## 9. ประตูรับรอง — ผ่านแล้ว ✅ (2026-07-17)

`black #080808` · `grey #808080` · neutral ramp ปั่น 6 step · `mint-text` แยก token (§3.5) · `hero` 96
เก็บในระบบไว้ก่อนยังไม่มีที่ลง — เจ้าของตรวจบน Claude Design sheet เคาะครบ

## 9.1 การตัดสินใจที่เกิดตอนลงมือ Phase 2

- **สีอยู่ใน `tailwind.config.ts` ที่เดียว `globals.css` ไม่แตะเลย** — แผนเดิมจะให้ `globals.css` เป็นแหล่ง
  เดียวผ่าน CSS var แต่ Tailwind คำนวณ alpha modifier (`bg-black/50`) จาก `var()` ที่เก็บ hex ตรง ๆ ไม่ได้
  (ต้องแปลงเป็น channel ซับซ้อนขึ้นโดยไม่ได้อะไร) → เก็บสีใน config ที่เดียวพอ
- **`black: #080808` ทับ token Tailwind (`#000000`)** — ยอมรับเพราะต่างกันแค่ 3% และทุกจุดใช้เป็น overlay
  โปร่งแสง 20-50% ทับรูป (ต่ำกว่าที่ตาคนแยกออก) แลกกับคำศัพท์ตรง Figma

---

## 10. งานที่แยกไป milestone อื่น (ไม่ใช่รอบนี้)

### 🛒 ตะกร้า — หลายฟอนต์ต่อหนึ่ง checkout (ยังไม่เริ่ม)

**นี่คืองาน money-path ไม่ใช่งานดีไซน์** — `checkout-service.ts` ผูกกับฟอนต์เดียวแบบตายตัวทุกชั้น
(`raw.font_id` เดี่ยว, `line_items[0]` index ตายตัว, webhook ให้สิทธิ์ฟอนต์เดียว) ต้องเปลี่ยนเป็น array +
วน RPC แบบ idempotent/atomic ต่อฟอนต์ **ความเสี่ยงตัวจริง: webhook พังกลางทาง = จ่ายเงินแล้วได้ฟอนต์ไม่ครบ**
ต้องมีแผนทดสอบของตัวเอง ไอคอนตะกร้าใส่ไว้ใน Nav แล้วหลัง `CART_ENABLED = false`

### หน้าที่เลื่อนไปรอบหลัง — ✅ ทำครบหมดแล้ว

`LegalPage` · `/agreement` · `/become-a-designer` · `/contact` · `/verify` (Phase 9, §16) ·
`/quote` · `/subscribe` · `auth/*` · `account/*` · `/checkout/success` (Phase 10, §17)

**ที่ยังเหลือจริง:** admin/designer dashboard ทั้งชุด (§18)

---

## 11. ลำดับงาน

| Phase | ไฟล์ | สถานะ | tag |
|---|---|---|---|
| 0 | tag + branch `redesign/public-v2` | ✅ | `v1-pre-redesign` |
| 1 | `DESIGN.md` + moodboard | ✅ | |
| 1.6 | Claude Design sheet — ประตูรับรอง | ✅ | |
| 2 | `layout.tsx`, `tailwind.config.ts`, `lib/cn.ts` (`globals.css` ไม่แตะ) | ✅ | `redesign/p2-tokens` |
| 3 | `components/ui/*` — ไฟล์ใหม่ล้วน | ✅ | `redesign/p3-primitives` |
| 4 | `Footer.tsx` | ✅ | `redesign/p4-footer` |
| 5 | `FontCard.tsx` | ✅ | `redesign/p5-fontcard` |
| 6 | `Nav.tsx` + submenu + `/fonts?category=` + `/cart` | ✅ | `redesign/p6-nav` |
| 7a | `page.tsx` (hero+สไลด์+กริด+ราคา) · `CoverCarousel` · `FontCard` | ✅ ดู §13 | |
| 7b | `fonts/page.tsx` · `DesignerDetail.tsx` · `FontGrid` | ✅ ดู §14 | |
| 8 | `FontDetail.tsx` · `TypeTester.tsx` | ✅ ดู §15 | |
| 9 | หน้ารอง: legal · become-a-designer · contact · verify | ✅ ดู §16 | |
| 10 | `auth/*` · `account/*` · `/quote` · `/subscribe` · `/checkout/success` | ✅ ดู §17 | |
| D | dashboard admin/designer | 🔲 กำลังทำ ดู §18 | |

**merge เข้า main เฉพาะที่ขอบ phase** — ทุก push = deploy ดังนั้นทุก commit ที่เข้า main ต้อง ship ได้เดี่ยว ๆ

---

## 12. การตรวจงาน (ใช้กับทุก phase รวม Phase D ที่กำลังทำ)

`npm run dev` (port 3000) ทุก page phase:

1. **ก่อน:** screenshot ที่ **375 / 768 / 1280** ของ tag ฐาน — จับ**การสูญหายเชิงโครงสร้าง** (การ์ดหาย,
   ปุ่มไม่ render) ไม่ใช่เทียบพิกเซล (พิกเซลเลื่อนคือประเด็นของงานนี้)
2. **Console:** `onlyErrors: true` ต้องว่าง — React key warning/hydration error คือโหมดพังจริงเวลา restyle `.map()`
3. **Network:** query Supabase ต้องยิงและได้แถวกลับ — จับโหมด "401 = กริดว่างเปล่า" ; เช็คว่าโหลดฟอนต์
   2 ตระกูล (Noto Sans Thai + Looped) รวม ~140KB
4. **ตรวจระบบ:** ไม่มี horizontal scroll ที่ 375px · arbitrary value ลดลงไม่ใช่เพิ่ม
   (`grep -oE '\[[^]]+\]' <ไฟล์>`) · ไม่มี `text-[9-13px]` เหลือ · ไม่มี `rounded-*` นอกจาก `rounded-full` ·
   `getComputedStyle` เนื้อความ = Looped (admin ยังเป็น Noto Sans Thai) · `focus-visible` มองเห็นได้ทุก element ที่กดได้
5. **Interaction:** ทดสอบทุก breakpoint หลังแก้ · ตรวจราคาครบทั้ง 5 กิ่งด้วยฟอนต์จริงในแต่ละสถานะ ·
   login/logout ทั้งสองสถานะ
6. **ไม่ตรวจ dark** — ไม่มีอยู่
7. **`npm run build` ก่อน tag ทุก phase** — `output:"export"` แปลว่า static export พัง = deploy พัง

**hallmark/frontend-design:** frontend-design หัว phase เท่านั้น (พอ markup มีแล้วหมดประโยชน์) ·
hallmark ท้าย page phase เป็นประตู รันบน diff ก่อน tag — พบนอกขอบเขต → บันทึกใน §8 แล้วเดินต่อ

---

## 13. Phase 7a — หน้าแรก ✅ (2026-07-18)

> commit `e602b00` → `c19bb02` บน `redesign/public-v2` — ถ้าขัดกับ §7 ให้ §13 ชนะ

**สิ่งที่ทำ:** Hero (`text-hero` ดำ, "ออกแบบ"=mint-text, ตัด 2 ปุ่ม) · สไลด์ full-bleed peek
(cover 16:9 กลางกว้างเท่าเนื้อหา, ลูกศรขาว+เงา, จุด overlay บน cover, autoplay 3s) · กริด `GRID_SHOW=11` ·
ราคา 2 การ์ด `surface` เหลี่ยม ไม่มี badge

**`CoverCarousel`** (`src/components/CoverCarousel.tsx`) — ยกออกจาก `page.tsx` เพื่อ reuse ที่
`DesignerDetail`/`FontDetail` (prop `slides` เพิ่มทีหลัง §15.2) รับ pool จากภายนอก ไม่ query เอง ·
geometry วัดด้วย `ResizeObserver` · `PAD=2` (clone ข้างละ 2 — ห้ามลดเหลือ 1 ไม่งั้น peek วูบตอน wrap) ·
guard `document.hidden` ในนี้แก้บั๊ก carousel ตายในแท็บซ่อน (§8)

**`FontCard` สเปกใหม่:** cover 270×150 (`aspect-[9/5]`) · 2 บรรทัดรายละเอียด (ตัด "x styles") · ราคา
baseline เดียวกับ "โดย Designer" · **`leading-none` ทั้ง 3 ชิ้นห้ามถอด** (ไม่งั้น line-height 1.5 ที่สืบทอด
มาดันบรรทัดห่างจนน่าเกลียด) · หัวใจ 24×24 พื้นวงกลม `bg-white/55 hover:bg-white/75`

**`Nav` เมนูบัญชี:** เปิดตอน hover (สะพาน `top-full pt-2` กันเมาส์หลุด) · avatar สี่เหลี่ยมพื้น mint ต้อง
`w-8 h-8` เป๊ะเท่าไอคอน logout ไม่งั้น search ขยับตอนสลับสถานะ · `text-ui` ไม่ใช่แค่ `font-ui`

**บั๊ก scroll เปลี่ยนหน้า** (nav 70px บังเนื้อหาบน) แก้ 2 ชั้น: `ScrollReset.tsx` (`scrollTo(0)` ทุกครั้ง
`pathname` เปลี่ยน ข้ามถ้ามี hash) + `globals.css` `scroll-padding-top: 78px`

**บทเรียนที่ใช้ซ้ำได้ทั่วโปรเจกต์:**
- `text-*` เป็น token ขนาด/น้ำหนัก **ไม่ได้ตั้ง font-family** — ต้องใส่ `font-body`/`font-heading` คู่กันเสมอ
- **`cn()` ในโปรเจกต์นี้ต่อสตริงเฉย ๆ ไม่ใช่ `tailwind-merge`** — class ที่มาทีหลังไม่ชนะเสมอ อย่าพึ่ง
  override ผ่าน `className` ให้เพิ่ม variant/size ใน component แทน
- `{/* comment */}` เป็นบรรทัดแรกของ ternary branch ใน JSX = parse error ต้องใช้ `// comment`
- อย่าแก้เกินที่สั่ง — stage เฉพาะไฟล์ที่แก้ (`next-env.d.ts` ห้าม commit)

---

## 14. Phase 7b — `/fonts` + `DesignerDetail` ✅ (2026-07-18)

**สิ่งที่ทำ:** `/fonts` ตัวกรองเปลี่ยนจาก `<select>` เป็นปุ่มแถว (active=mint, inactive=surface) ·
`DesignerDetail` ใช้ `CoverCarousel` เดียวกับหน้าแรก (`SLIDER_SIZE` 3→4) · token ดิบ/`rounded-*`/ตัวเล็ก
หายหมดทั้งสองไฟล์

**`FontGrid`** (`src/components/FontGrid.tsx`) — กริด + ad คั่นทุก N แถว ใช้ร่วมทั้งสองหน้า **กฎ: นับเป็น
"แถว" ไม่ใช่ "ใบ"** เดสก์ท็อปทุก 3 แถว มือถือทุก 4 แถว → เหลือ 2 ค่า (8 ใบ/ก้อน มือถือ, 12 ใบ/ก้อน 640px+)

**กับดักที่ใช้ซ้ำได้:**
- 🔴 **ห้าม render ad ทั้งสองชุดแล้วซ่อนด้วย `hidden sm:block`** — AdSense ไม่เติมโฆษณาในกล่อง `display:none`
  ต้องวัดจอด้วย `matchMedia` แล้ว render ชุดเดียว (ค่าเริ่มต้นก่อน mount = 12 เพราะ static export ต้อง
  render ก่อนรู้ขนาดจอ)
- 🔴 **`matchMedia().addEventListener("change")` ไม่ยิงใน viewport emulation ของ devtools** — ต้องฟังทั้ง
  `change` และ `window.resize` คู่กันเสมอ (เจอซ้ำใน `CoverCarousel` ที่ฟัง `ResizeObserver`+`resize`)
- ไม่แทรก ad ท้ายก้อนสุดท้าย (ต้อง "คั่น" ไม่ใช่ปิดท้าย) · margin ลบต้องล้อ padding ของ `Container`

---

## 15. Phase 8 — `FontDetail` + `TypeTester` ✅ (2026-07-20)

> ต้นแบบ [`moodboard/font detail alt.png`](./moodboard/font%20detail%20alt.png) — ผ่านรีวิวเจ้าของ 8 รอบ
> หลัง implement จริง (ของจริงต่างจากโครงร่างแรกในหลายจุด) — ค่าสุดท้ายเท่านั้นที่คุมโค้ดตอนนี้

**โครงหน้าสุดท้าย:**
```
สไลด์ full-bleed peek (นอก Container)
ชื่ออังกฤษ (text-h2 800) · หมวดหมู่+แท็ก (ป้ายพื้น surface ลิงก์ /fonts?category= หรือ ?q=)
ฟอนต์ "ชื่อไทย" (text-h1, sticky top-[70px] พร้อมชื่อ+หัวใจ) — pt ปรับจนระยะภาพเท่ากับ (ออกแบบโดย→แถบเมนู)
แถบเมนู 3 หัวข้อ (ไม่ sticky): รายละเอียด | พิมพ์ทดสอบ | สั่งซื้อฟอนต์/ขอใบเสนอราคา
เนื้อหาตามแท็บ (mobile: grid-cols-1 sm:3 เพื่อกันตัดคำ 3 บรรทัด)
ADSENSE + FontGrid "ฟอนต์ที่คุณน่าจะสนใจ"
```
แท็บสลับด้วย `useState` ในที่เดิม ไม่เปลี่ยน route · **แท็บที่ไม่ active ไม่ render** (TypeTester ยิง Edge
Function ตอน mount — ถ้าค้าง mount จะยิงทุกครั้งที่เปิดหน้าโดยยังไม่ได้กดดู) · แท็บสั่งซื้อ 2 คอลัมน์
(บุคคลทั่วไป+Demo+Subscription | องค์กร) · specimen lightbox ใช้ `ui/Modal` แทนเขียน overlay เอง

**`CoverCarousel` เพิ่ม prop `slides`** (additive, ไม่กระทบโหมดเดิม `fonts`) — ลบ state
slider เดิมของ `FontDetail` ทิ้งทั้งชุด (แทนที่ด้วย component ใช้ร่วม ไม่ใช่แก้ logic เดิม)

**สิ่งที่ยังไม่แตะตาม §8:** ternary ราคา 5 กิ่ง · `activePromo` · `handleBuy` · `flattenFont`/`RawFont` ·
`normalizeTesterText`/cache/debounce ของ `TypeTester`

**กับดักที่ใช้ซ้ำได้ทั่วโปรเจกต์:**
- 🔴 **dedupe ด้วย `Map`/`Set` เก็บ "ตัวหลัง"** — ฟอนต์ที่ category กับ tag ซ้ำคำกัน (เช่น `display`)
  ต้องวนเก็บ "ตัวแรก" เอง ไม่งั้นลิงก์ผิดประเภท (`?q=` แทน `?category=`)
- **sticky ต้องมี `bg-white` +ล้อ padding ของ `Container`** ไม่งั้นเนื้อหาที่เลื่อนผ่านทะลุซ้อน
- **`text-h2` ตั้ง `font-weight: 800` ในตัว** — span ลูกที่ไม่ได้ตั้ง weight เองจะสืบทอด 800 มาด้วย ต้อง
  ใส่ `font-normal` ทับถ้าไม่ต้องการ
- **ข้อมูล id ผสมจาก Edge Function เชื่อไม่ได้เสมอ** — `weightCss()` ไม่รู้จัก id ผสม (`bolditalic`) ตกเป็น
  400 หมด แก้ฝั่ง client (ถอด italic/oblique ออกจาก id ก่อนเปิดตาราง) โดยไม่ต้อง redeploy function
- **วัดระยะภาพจริงด้วย `getBoundingClientRect` เฉย ๆ เพี้ยนได้** — บรรทัดที่ `leading-none` กับบรรทัด
  line-height ปกติมี half-leading ต่างกัน เทียบ "ระยะเท่ากัน" ต้องหัก half-leading ออกก่อน ไม่ใช่ตั้ง
  padding เท่ากันแล้วจบ
- **native `<select>`/range slider สไตล์ผ่าน Tailwind ไม่ได้** — pseudo-element (`::-webkit-slider-thumb`)
  ต้องเขียน CSS จริงใน `globals.css` (scoped class ไม่กระทบที่อื่น) หรือเปลี่ยนเป็น custom dropdown/track
- **custom dropdown anchor ทิศตรงข้ามกันระหว่างมือถือ/เดสก์ท็อป** — ปุ่มที่ wrap ชิดซ้ายบนมือถือ ต้อง
  anchor เมนู `left-0`; ปุ่มที่ชิดขวาบนเดสก์ท็อป anchor `right-0` (ไม่ใช่ทิศเดียวกันทุกจอ)
- **Safari ต้องการ `w-full h-auto` + `width/height="100%"` บน `<svg>`** ที่อยู่ใน `aspect-square` (ไม่ใช่
  `h-full`) ไม่งั้น Safari ไม่ให้ความสูง · `transition-all` บน SVG ที่มี `stroke-dasharray` ทำให้ Safari
  ไล่ค่าตอน mount จนเส้นหาย ต้องระบุ property เจาะจง (`transition-[stroke-width]`)

**ผลตรวจงาน:** build ผ่าน (17 หน้าฟอนต์), console ว่าง, ราคาตรวจ 3/5 กิ่ง (ฟรี/ลดราคา/ปกติ — ยังไม่ได้ตรวจ
โปรรวมกับ "ไม่มีราคา" เพราะต้องเปิด promotion ใน settings ก่อน)

---

## 16. Phase 9 — หน้ารอง: เอกสาร · become-a-designer · contact · verify ✅ (2026-07-20)

ทั้งเฟสไม่แก้ token/component ใน `ui/` เลย — ใช้ของที่มีอยู่ทั้งหมด

- **หน้าเอกสาร 5 หน้า** ใช้ `LegalPage.tsx` ร่วมกัน (แก้ที่เดียวมีผลครบ) — เนื้อความ `font-body text-body
  text-grey-800 leading-[1.8]`, ไม่มีกล่อง/เส้นคั่นแล้ว (§4.0) **กับดัก:** ย้าย type scale ใหญ่ขึ้นแล้วต้องรื้อ
  spacing ตามเสมอ ไม่ใช่แค่สลับ class ตัวอักษร
- **`/become-a-designer` + `RevenueShareChart`** (chart ตัวแรกของโปรเจกต์ — โดนัท SVG เขียนเอง ไม่มี lib)
  ดึงตัวเลขจริงจาก `lib/subscription-revenue.ts`/`lib/revenue.ts` ห้าม hardcode ซ้ำ **กับดัก Safari** เดียวกับ
  §15 (`aspect-square`+`h-full`, `transition-all` บน `stroke-dasharray`)
- **`/contact`** หน้าใหม่แทน `mailto:` — ส่งเข้า `ADMIN_EMAIL` อย่างเดียว **ไม่ส่งสำเนากลับผู้กรอก** (ยังไม่
  พิสูจน์ว่าเป็นเจ้าของอีเมล ไม่งั้นกลายเป็นช่องยิงเมลใส่คนอื่นผ่านโดเมนเรา) ผ่าน Turnstile เสมอ
- **`/verify`** redesign เปลือกอย่างเดียว logic เดิมทั้งหมด — client component export `metadata` ผ่าน
  `layout.tsx` ของ route แทน
- **กฎที่เจ้าของเคาะเพิ่ม (ใช้กับงานถัดไปทุกจุด):**
  1. **ห้ามใช้คำว่า B2B/B2C ในข้อความที่ผู้ใช้เห็น** — ขายรายชุด = "Retail Font", งานองค์กร = "ระบบใบเสนอราคา
     (ฟรี ไม่หักส่วนแบ่ง)" (โค้ด/คอมเมนต์ใช้ได้)
  2. **ช่องกรอกข้อมูลทุกช่องในโปรเจกต์ = `font-body text-body-sm`** (Looped Light 14) อ้างอิงช่องค้นหา Nav
     หัวข้อช่อง = `font-ui text-ui` ไม่มี `*` ท้ายหัวข้อ
- **Sticky footer** — `<body>` เพิ่ม `min-h-screen flex flex-col` + `<footer>` เพิ่ม `mt-auto` (2 บรรทัด
  มีผลทุกหน้าทั้งเว็บ รวม admin เดิม) footer ชิดขอบล่างเมื่อเนื้อหาสั้นกว่าจอ
- **`AdBanner`** แก้ 4 จุด (`src/components/AdBanner.tsx` ที่เดียว มีผลทุกหน้า): เลิกเส้นกรอบ, `bg-surface`,
  `text-badge text-grey-600` (จาก 9px), ใช้ `<Container>` แทน `px-8` ตายตัว — **เหตุผลที่ต้องแก้แม้ ad จริงจะ
  ขึ้นแทน:** Google ยัด iframe เฉพาะใน `<ins>` เท่านั้น กรอบรอบนอกเป็นของเราเสมอ ad จริงจะทำให้แถบสูงขึ้นและ
  ของที่ผิดระบบเด่นชัดกว่าตอนว่าง

---

## 17. Phase 10 — auth · account · quote · subscribe · checkout ✅ (2026-07-21)

restyle หน้าที่เหลือทั้งหมด **logic เดิมทุกบรรทัด** (Supabase, validation, Turnstile, redirect, poll loop,
pricing ไม่แตะ) แค่สลับ legacy `@/components/Button` → `ui/Button` (API เหมือนกัน) + เนื้อหน้า

**ไฟล์ shared ใหม่:** `components/form/field.tsx` (`FIELD`/`LABEL`/`<Field>`) และ
`components/auth/AuthShell.tsx` (โครงการ์ด auth ที่ 4 หน้า auth ใช้ร่วมกัน)

**การตัดสินใจ:** `PdfLightbox` restyle ในที่ ไม่ย้ายไป `ui/Modal` (Modal มี Esc-close ในตัว = เพิ่ม
พฤติกรรมใหม่ ผิดกฎ logic เดิม) · `quote` tier ที่เลือก = พื้น `bg-mint` ตัวดำ (เจ้าของเคาะ) ·
`accent-black` สำหรับ radio/checkbox ทุกหน้า (DESIGN.md ไม่เคยระบุ เลือกตามพาเลต) · ตัด `*` หลัง label
ทุกหน้าตาม §16.5(2) ช่อง optional เขียน "(ไม่บังคับ)" แทน

**ตรวจงาน:** grep gate 14 ไฟล์ 0 hit token เก่า/สีดิบ/`components/Button"` · lint+tsc+build ผ่าน ·
375/768/1280 ผ่านทุกหน้าที่ไม่ต้อง login · หน้าที่ต้อง login (account/settings/downloads/favourites)
ตรวจด้วย code review + build เท่านั้น **ยังไม่ได้ spot-check สดหลัง deploy**

---

## 18. Phase D — Dashboard admin/designer (เริ่ม 2026-07-22)

ขยายขอบเขต §1 ครอบคลุม `src/app/admin/**` และ `src/app/designer/(dashboard)/**` ต่อจากหน้าสาธารณะ
(Phase 0–10 เสร็จหมดแล้ว) แบ่งเฟสแบบเดียวกัน: ตกลง token/กฎก่อน (D1) → shared shell/component ที่ใช้ซ้ำ
มากที่สุดก่อน (D2 = จุด calibration) → ไล่หน้าเดี่ยว ๆ (D3+)

### 18.1 D1 — กฎก่อนแตะโค้ด

- **เลิกใช้ `src/components/Button.tsx` เก่าในทุกหน้า admin/designer** → เปลี่ยนไปใช้ `src/components/ui/*`
  ชุดเดียวกับหน้าสาธารณะ (ไฟล์เก่ายังอยู่ในโค้ด ไฟล์อื่นอาจยัง import — เป้าคือไม่มีหน้า dashboard เหลือ import)
- **มุมเหลี่ยม (§4.1) ใช้กับ dashboard ด้วยแล้ว** — จุด `rounded-*` ค้าง (`admin/page.tsx:129-130`,
  `admin/font-review/page.tsx:282-283`, `designer/(dashboard)/page.tsx:125-126`,
  `admin/FontForm.tsx:581,583`) ตัดออกทุกจุด ยกเว้น `rounded-full` ของจริง
- **sidebar ใช้ `black` เหมือนหน้าสาธารณะ** (เจ้าของสั่ง 2026-07-22) — `navy` ยังคงสถานะสำรอง ไม่ใช้รอบนี้
- `black #080808` ที่ทับ token Tailwind ผลกับ `FontForm.tsx:581,583` — ไม่ต้องแก้ ยอมรับไว้แล้วตาม §9.1
- ไม่เพิ่ม dependency ใหม่ (กฎเดิมจาก §1)

### 18.2 D2 — Shared shell + shared component (แผน ไม่ใช่ผลตรวจแล้ว)

จุดที่ใช้ซ้ำมากสุด แก้ทีเดียวกระทบทุกหน้า: `admin/layout.tsx`, `designer/(dashboard)/layout.tsx`
(sidebar/shell, calibration checkpoint แรก) · `OwnRevenue.tsx`, `OwnAnalytics.tsx`, `OwnPricing.tsx`,
`admin/FontForm.tsx`, `admin/PrintLightbox.tsx` (ใช้ร่วม admin/designer ผ่าน thin wrapper pages)

ของใหม่ 2 อย่างที่เจ้าของสั่งเพิ่ม (ไม่ใช่แค่ restyle): ป้าย "รอ Publish" บนหน้า "ฟอนต์ของฉัน" ของ **admin**
(พอร์ต logic เดียวกับที่ designer มีอยู่แล้ว) · filter เดือน/ปีบนหน้า "สถิติ" (pattern เดียวกับหน้ารายได้)

### 18.3 D3+D4 — restyle ทุกหน้า admin/designer ✅ เสร็จ (2026-07-22)

เจ้าของเห็นผล D2 แล้วเคาะ "ทำครบทุกหน้า" → restyle ครบทั้ง dashboard (ทำแบบขนานด้วย Builder agents):
- **admin**: my-fonts (`page.tsx`), font-review, license, designers, payouts, subscriptions, settings, quotes, add
- **designer**: my-fonts (`page.tsx`), quotes, settings, add, onboarding · `SetupGate.tsx` (DesignerSetupCard/AddFontGate)
- **shared/modal**: `admin/FontForm.tsx` (848 บรรทัด), `admin/PrintLightbox.tsx`, `IssueQuoteModal.tsx`, `ConfirmPaidModal.tsx`
  — logic/flow/open-close ไม่แตะ restyle ล้วน

กฎที่ใช้ (สรุปจาก reference: `OwnRevenue`/`OwnAnalytics`/`OwnPricing`):
- เลย์เอาต์: page bg ขาว · การ์ด `bg-surface` · กล่องซ้อนในการ์ด `bg-white` — ไม่มีเส้นขอบ ไม่มี `rounded-*`
  (ยกเว้น `rounded-full` ของกลมจริง: จุด stepper, ปุ่ม ✕, check-bubble)
- หัวหน้า `font-heading text-h2` · หัวการ์ด `font-ui text-ui` · ข้อความรอง `font-body text-body-sm/footnote text-grey-600`
  · ค่า/ข้อมูล `text-black` — **ไม่มี `font-medium`/`font-semibold` เหลือ** (เน้นด้วยสี ไม่ใช่ weight)
- ป้ายสถานะเหลี่ยม `text-badge font-heading`: warning=`bg-warning text-black` · ok=`bg-success text-white` ·
  neutral=`bg-surface/bg-white text-grey-600` · danger=`bg-danger text-white`
- ปุ่ม: `ui/Button` (เลิก import `components/Button` เก่าทุกไฟล์แล้ว) · input/select ไร้เส้นขอบ `bg-surface/bg-white`
  focus-visible outline · checkbox/radio `accent-black` · toast `bg-black text-white`
- **หน้าไม่เต็มจอ** — คง `max-w-[...]` เดิมของแต่ละหน้า (เจ้าของสั่งชัด ไม่เอา full-width)

**ตกค้างยอมรับได้**: `text-[10px]/[11px]/[12px]` บนป้ายเลข/drag-handle/✕ ที่ทับบนรูป preview ใน `FontForm.tsx`
(overlay glyph บนภาพ = icon control ไม่ใช่ข้อความอ่าน เข้าข้อยกเว้น §2.5) · `bg-black/50-60` overlay คงไว้ตาม §9.1

grep gate สะอาด: 0 hit `text-navy|bg-navy|border-border|rounded-(ไม่ใช่ full)|text-[#hex]|components/Button"|font-medium|font-semibold`
· `npm run build` (static export ผ่าน) · `npx tsc --noEmit` สะอาด · lint 0 error

### 18.4 งานที่เหลือของ dashboard (ยังไม่ทำ)

- Phase D เสร็จครบ ไม่มีหน้า dashboard ค้าง — เหลือแค่ตรวจสดหลัง login (ต้องเจ้าของทำ)
