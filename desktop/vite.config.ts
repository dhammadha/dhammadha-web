import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// พอร์ต 1420 = ค่าที่ tauri.conf.json อ้างใน devUrl — เปลี่ยนที่นี่ต้องเปลี่ยนที่นั่นด้วย
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true, // ชนพอร์ตแล้วให้ล้มไปเลย ดีกว่าเด้งพอร์ตอื่นแล้ว Tauri เปิดหน้าว่าง
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "safari15", // WKWebView บน macOS 12+ (ขั้นต่ำที่ Tauri v2 รองรับ)
    sourcemap: false, // ห้ามส่ง sourcemap ไปกับ release
  },
});
