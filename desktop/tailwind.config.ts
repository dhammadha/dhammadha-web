import type { Config } from "tailwindcss";

// คัด token มาจาก `/tailwind.config.ts` ของเว็บ — แหล่งความจริงคือ `docs/design/DESIGN.md`
//
// ⚠️ ไฟล์นี้เป็น **สำเนา ไม่ใช่ import** เพราะ desktop เป็นคนละ npm project
// เปลี่ยนสีบนเว็บแล้วต้องตามมาแก้ที่นี่ด้วย (ตั้งใจแลก: การ import ข้ามโปรเจกต์
// ทำให้ desktop ต้องรู้จัก build ของ Next ซึ่งไม่คุ้มกับ token 12 ตัว)
//
// สิ่งที่ **ตั้งใจไม่คัดมา**:
//   - token ชุด @deprecated (mint-light / mint-mid / bg / border) ของ dashboard เก่า
//   - fontSize hero / font-slug / h1 — แอปไม่มีหน้าที่มีหัวข้อขนาดนั้น
//   - maxWidth.site (1200px) — หน้าต่างแอปคุมความกว้างเองอยู่แล้ว
//
// ฟอนต์: เว็บโหลดผ่าน next/font/google แต่แอปโหลดไม่ได้เพราะ CSP เป็น `default-src 'self'`
// → ใช้ @fontsource ซึ่ง bundle ไฟล์ woff2 มาในแอปเลย (ดู src/styles.css)

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // มิเรอร์ค่าจาก tailwind.config.ts ที่ราก repo (รีแบรนด์เฟส 1, 8 ส.ค. 2569)
        // เดิมมี navy #2B1B3D + mint #5ECEC8 + mint-text — ยกเลิกทั้งชุดพร้อมฝั่งเว็บ
        // ⚠️ ไฟล์นี้ไม่ได้ import จากที่ราก (คนละ Vite project) จึงต้องแก้ตามด้วยมือเสมอ
        black: "#080808",
        grey: "#808080",
        orange: "#FF4D00", // ตัวอักษรบนพื้นนี้ต้องเป็นดำ (6.02:1)
        "orange-text": "#E03C00", // ตัวอักษร ≥24px / เส้นโฟกัส
        "orange-light": "#FF6A28", // ตัวอักษรบนพื้นมืด
        page: "#F0F0F0", // พื้นหน้าต่างแอป
        surface: "#FFFFFF", // พื้นการ์ด

        "grey-200": "#E0E0E0",
        "grey-400": "#B0B0B0",
        "grey-600": "#666666",
        "grey-800": "#333333",

        success: "#0A8A84",
        warning: "#F0C040",
        danger: "#E74C3C",
        "danger-dark": "#C0392B",
      },

      fontFamily: {
        // มิเรอร์จาก tailwind.config.ts ที่ราก repo (รีแบรนด์เฟส 2, 8 ส.ค. 2569)
        // เดิมเป็น Noto Sans Thai / Noto Sans Thai Looped — ยกเลิกทั้งคู่พร้อมฝั่งเว็บ
        //
        // `heading` = typedee ใช้ได้เฉพาะหัวข้อใหญ่ (text-hero/font-slug/h1) ซึ่ง **config นี้
        // ไม่ได้คัดมา** เพราะแอปไม่มีหน้าที่มีหัวข้อขนาดนั้น → ในทางปฏิบัติ typedee จึงยังไม่ถูกใช้
        // ที่นี่ ปล่อย key ไว้ให้ตรงกับฝั่งเว็บ (ไฟล์ woff2 bundle ไว้แล้วใน src/fonts)
        // ทุกอย่างที่แอปใช้จริง — หัวข้อรอง ปุ่ม แท็บ ป้าย label — เป็น Plex Bold
        heading: ["typedee", "system-ui", "sans-serif"],
        ui: ["IBM Plex Sans Thai Looped", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans Thai Looped", "system-ui", "sans-serif"],
      },

      fontSize: {
        // h2 เดิม 800 → 700 (Plex Bold) ตามฝั่งเว็บ
        h2: ["clamp(1.25rem, 0.44vw + 1.15rem, 1.5rem)", { fontWeight: "700" }],
        body: ["1rem", { fontWeight: "400" }],
        "body-sm": ["0.875rem", { fontWeight: "300" }],
        ui: ["1rem", { fontWeight: "700" }],
        "fc-heading": ["1rem", { fontWeight: "700" }],
        badge: ["0.75rem", { fontWeight: "700" }],
        footnote: ["0.75rem", { fontWeight: "300" }],
        "logo-sub": ["0.625rem", { fontWeight: "400" }],
        "fc-byline": ["0.75rem", { fontWeight: "300" }],
      },

      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.04)",
        md: "0 2px 12px rgba(0,0,0,0.08)",
        lg: "0 8px 32px rgba(0,0,0,0.12)",
      },

      transitionTimingFunction: {
        base: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
