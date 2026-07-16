import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "**/.next/**", // build output — รวม worktree ใน .claude/ ที่มี .next ของตัวเอง
      "**/out/**", // static export
      "**/node_modules/**",
      "**/next-env.d.ts", // ไฟล์ที่ Next เจนเอง
      "supabase/functions/**", // Edge Function เป็น Deno คนละ runtime — กฎของ Next ใช้ไม่ตรง
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // กฎยุค React Compiler (eslint-plugin-react-hooks v6) — ลดเป็น warn ไม่ใช่ error
      //
      // set-state-in-effect ฟ้อง 27 ไฟล์ เพราะทั้งเว็บใช้แพตเทิร์น useEffect(() => { load() }, [load])
      // ดึงข้อมูลฝั่ง client ซึ่งเป็นผลจาก output:"export" (ไม่มี server runtime ให้ fetch ก่อน render)
      // ไม่ใช่บั๊ก และจะ "แก้" ได้ต้องรื้อวิธีดึงข้อมูลทั้งแอป — ถ้าปล่อยเป็น error
      // `npm run lint` จะแดงถาวรจนไม่มีใครรัน = เสียของ
      //
      // ปล่อยเป็น warn ไว้ให้ยังเห็นอยู่ เผื่อวันหลังย้ายไป React Compiler จริง
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      // เครื่องหมาย " ในข้อความ JSX — เรื่องความสวยงามล้วน ๆ ไม่กระทบการแสดงผล
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
