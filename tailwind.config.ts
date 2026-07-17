import type { Config } from "tailwindcss";

// ระบบดีไซน์: docs/design/DESIGN.md — เอกสารนั้นคือแหล่งความจริง
//
// Phase 2 = เพิ่มอย่างเดียว (additive) token เดิมทุกตัวยังอยู่ค่าเดิม
// เพื่อให้ admin/designer dashboard ~15 ไฟล์ที่ยังอยู่บนดีไซน์เก่า render เหมือนเดิมเป๊ะ
//
// ทำไมสีถึง hardcode hex ที่นี่แทนที่จะอ้าง var(--x) จาก globals.css:
// Tailwind คำนวณ alpha modifier (bg-black/50, bg-white/20) จาก var() ที่เก็บ hex ไม่ได้
// ต้องเก็บเป็น channel (8 8 8) + rgb(var(--x) / <alpha-value>) ซึ่งเพิ่มความซับซ้อนโดยไม่จำเป็น
// → สีอยู่ที่นี่ที่เดียว ส่วน :root ใน globals.css เก็บแค่ฟอนต์ = ไม่ซ้ำซ้อนเหมือนกัน

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─────────────────────────────────────────────────────────────
        // PALETTE — 5 ตัวตาม Figma (DESIGN.md §3.1)
        // ─────────────────────────────────────────────────────────────
        navy: "#2B1B3D",
        mint: "#5ECEC8",
        white: "#FFFFFF", // = ค่าเดียวกับ white ของ Tailwind → ทับแล้วไม่มีอะไรเปลี่ยน
        black: "#080808", // ⚠️ ทับ black ของ Tailwind (#000) — ดูหมายเหตุท้ายไฟล์
        grey: "#808080",

        // mint สำหรับ "ตัวหนังสือบนพื้นขาว" (DESIGN.md §3.5)
        // ตอนนี้ = mint เดิม ตามที่เจ้าของเลือก แม้จะได้แค่ 1.89:1 (ตก AA 4.5)
        // token นี้มีไว้เพื่อให้วันหน้าปรับได้ด้วยการแก้บรรทัดเดียว แทนการไล่แก้หลายสิบจุด
        // ค่าสำรองที่ผ่าน AA แล้ว: #27817C (4.65:1) — เฉดเดียวกับ mint เป๊ะ H 176.8°
        "mint-text": "#5ECEC8",

        // ─────────────────────────────────────────────────────────────
        // NEUTRAL RAMP — ปั่นจาก grey #808080 (DESIGN.md §3.2)
        // ทุก step เป็นเทากลาง (R=G=B) เฉดเดียวกัน ต่างแค่ความสว่าง
        // แทนเทาดิบ 12 เฉดที่ไล่กันเองอยู่ในโค้ด
        // ─────────────────────────────────────────────────────────────
        "grey-50": "#F5F5F5", // พื้นอ่อน — แถบล่าง footer
        "grey-200": "#E0E0E0", // เส้นคั่น
        "grey-400": "#B0B0B0", // ไอคอนตกแต่ง — ห้ามใช้กับตัวหนังสือ (2.17:1)
        "grey-600": "#666666", // ตัวหนังสือรองบนพื้นขาว (5.74:1 ✅)
        "grey-800": "#333333", // ตัวหนังสือเข้มรองจากดำ (12.63:1 ✅)
        // หมายเหตุ: grey #808080 บนขาวได้ 3.95:1 = ตกสำหรับตัวหนังสือเล็ก
        // ใช้ได้กับพื้นดำ (5.07:1 ✅) ซึ่งคือที่ทางของมันตาม moodboard

        // ─────────────────────────────────────────────────────────────
        // FEEDBACK (DESIGN.md §3.3)
        // ─────────────────────────────────────────────────────────────
        success: "#0A8A84",
        warning: "#F0C040",
        danger: "#E74C3C", // 3.82:1 — ใช้เป็นพื้น/ตัวใหญ่เท่านั้น
        "danger-dark": "#C0392B", // 5.05:1 ✅ — สำหรับตัวหนังสือเล็ก

        // ─────────────────────────────────────────────────────────────
        // @deprecated — ดีไซน์เก่า ใช้โดย admin/designer dashboard
        // ห้ามแก้ค่า ห้ามลบ จนกว่าจะรื้อ dashboard (คนละ milestone)
        // ห้ามใช้กับ component ใหม่
        // ─────────────────────────────────────────────────────────────
        "mint-light": "#e8faf9", // → ไม่มีตัวแทน ใช้ grey-50 หรือ mint ตรง ๆ
        "mint-mid": "#b8ecea", // → ไม่มีตัวแทน
        bg: "#f5f5f2", // → grey-50
        border: "#e8e8e0", // → grey-200
      },

      fontFamily: {
        // DESIGN.md §2.1 — Heading ใช้ 700/800 เท่านั้น ลำดับความสำคัญมาจากขนาด ไม่ใช่น้ำหนัก
        heading: ["var(--font-noto-thai)", "system-ui", "sans-serif"],
        body: ["var(--font-noto-thai-looped)", "system-ui", "sans-serif"],
        ui: ["var(--font-noto-thai)", "system-ui", "sans-serif"],

        // @deprecated — config ตาย ไม่มีใครใช้เลยตั้งแต่แรก ปล่อยไว้ ไม่ต้องลบ
        thai: ["var(--font-noto-thai)", "system-ui", "sans-serif"],
      },

      // ─────────────────────────────────────────────────────────────
      // TYPE SCALE (DESIGN.md §2.3) — ตรงจาก Figma Styles panel
      //
      // line-height เป็น "Auto" ใน Figma = ใช้ metrics ของฟอนต์เอง
      // → ตั้งใจไม่กำหนด lineHeight ที่นี่ (ตกลงกันว่าใช้ค่าเดิมไปก่อน)
      //
      // ใช้ clamp() แทน breakpoint class → responsive อัตโนมัติ ไม่ต้องเขียน md:text-*
      // ค่าที่ได้ตรงกับตารางใน DESIGN.md §2.5 พอดี:
      //   hero      375→40  768→64  1280→96
      //   font-slug 375→28  768→37  1280→48
      //   h1        375→24  768→31  1280→40
      //   h2        375→20  768→22  1280→24
      // ─────────────────────────────────────────────────────────────
      fontSize: {
        hero: ["clamp(2.5rem, 6.19vw + 1.06rem, 6rem)", { letterSpacing: "-0.03em", fontWeight: "800" }],
        "font-slug": ["clamp(1.75rem, 2.21vw + 1.23rem, 3rem)", { letterSpacing: "-0.02em", fontWeight: "800" }],
        h1: ["clamp(1.5rem, 1.77vw + 1.08rem, 2.5rem)", { letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["clamp(1.25rem, 0.44vw + 1.15rem, 1.5rem)", { letterSpacing: "-0.01em", fontWeight: "700" }],
        body: ["1rem", { fontWeight: "400" }], // 16px — เนื้อความ
        "body-sm": ["0.875rem", { fontWeight: "400" }], // 14px — พื้นล่าง ห้ามต่ำกว่านี้
        ui: ["1rem", { fontWeight: "500" }], // 16px — ปุ่ม nav control
        "fg-heading": ["1rem", { fontWeight: "700" }], // 16px — หัวคอลัมน์ footer
      },

      // DESIGN.md §5.2
      screens: {
        sm: "375px",
        md: "768px",
        lg: "1280px",
        xl: "1536px",
      },

      // DESIGN.md §4.3 — moodboard แทบไม่ใช้เงา ใช้เส้นคั่นกับพื้นต่างระดับแทน
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.04)",
        md: "0 2px 12px rgba(0,0,0,0.08)", // = ค่าเดิมของ FontCard hover
        lg: "0 8px 32px rgba(0,0,0,0.12)",
      },

      // DESIGN.md §4.4
      transitionTimingFunction: {
        base: "cubic-bezier(0.25, 0.1, 0.25, 1)", // = ค่าเดิมของ carousel
      },

      maxWidth: {
        site: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;

// ─────────────────────────────────────────────────────────────────────
// หมายเหตุ — borderRadius: ตั้งใจไม่แตะ (DESIGN.md §4.1)
//
// ดีไซน์ใหม่ "เหลี่ยมหมด ยกเว้นของที่กลมจริง" แต่ไม่ต้องตั้ง borderRadius.DEFAULT: 0
// เพราะ border-radius ใน CSS เริ่มต้นเป็น 0 อยู่แล้ว และ Tailwind preflight ไม่ได้ใส่ให้
// → component ที่ไม่มี class rounded-* ก็เหลี่ยมอยู่แล้ว
//
// และห้ามตั้ง DEFAULT: 0 เด็ดขาด — มี `rounded` เปล่า ๆ อยู่ 8 จุด และอยู่ใน admin ทั้งหมด
// (admin/page.tsx:129-130, admin/font-review/page.tsx:282-283,
//  designer/(dashboard)/page.tsx:125-126, admin/FontForm.tsx:581,583)
// ทับ DEFAULT = thumbnail กับป้ายใน admin เหลี่ยมตาม = ผิดขอบเขต
//
// ─────────────────────────────────────────────────────────────────────
// หมายเหตุ — black: ข้อยกเว้นที่จงใจ
//
// black: "#080808" ทับ black ของ Tailwind (#000000) ซึ่งกระทบทั้งแอปรวม admin
// จุดที่ใช้: bg-black/50 ใน admin/FontForm.tsx:581,583 (ป้ายลำดับบนรูป preview)
//            bg-black/20 ใน FontDetail.tsx:278,287 · DesignerDetail.tsx:203-204
//
// ยอมรับเพราะ: #080808 กับ #000000 ต่างกัน 3% และทุกจุดที่ใช้เป็น overlay ที่ opacity
// 20-50% ทับบนรูปภาพ → ความต่างต่ำกว่าที่ตาคนแยกออก
// แลกกับการรักษาคำศัพท์ให้ตรงกับ Figma ซึ่งกันไม่ให้ดีไซน์กับโค้ดเลื่อนออกจากกัน
// ─────────────────────────────────────────────────────────────────────
