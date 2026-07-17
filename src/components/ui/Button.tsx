import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Button — ดีไซน์ใหม่ (docs/design/DESIGN.md §6.2)
 *
 * API เหมือน components/Button.tsx เดิมเป๊ะ ไม่มี prop เพิ่ม ไม่มี prop หาย
 * → ย้ายหน้าไหนก็เปลี่ยนแค่ import path บรรทัดเดียว
 *
 * ตั้งใจไม่มี prop `loading` แม้ DESIGN.md จะระบุ state นั้นไว้ —
 * โปรเจกต์นี้ใช้ pattern `disabled={loading}` + สลับข้อความลูกอยู่แล้ว
 * (auth/signup:241, auth/forgot-password:72, auth/reset-password:119)
 * เพิ่ม prop เข้ามาจะกลายเป็น API ที่ไม่มีใครเรียก
 *
 * ⚠️ components/Button.tsx (ตัวเก่า) แช่แข็ง ห้ามแก้ — admin/designer 15 ไฟล์ใช้อยู่
 */

type BaseProps = {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = BaseProps &
  (
    | ({ as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ as: "a" } & React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; external?: boolean })
    | ({ as: "link" } & { href: string; target?: string; rel?: string })
  );

// ทุกขนาดใช้ `ui` (Sans Bold 16) — Figma มี UI Text สไตล์เดียว
// → size ต่างกันที่ padding ไม่ใช่ที่ขนาดตัวอักษร
// (เดิม sm ใช้ body-sm ซึ่งตอนนี้เป็น Looped Light 300 = ผิดสำหรับปุ่ม)
const SIZE = {
  sm: "px-3.5 py-1.5 text-ui",
  md: "px-5 py-2.5 text-ui",
  lg: "px-6 py-3 text-ui",
};

// เหลี่ยม — ไม่มี rounded-* (DESIGN.md §4.1)
// primary = พื้น mint ตัวหนังสือดำ ตาม moodboard (button.png: Nav_Button hover = บล็อก mint)
const VARIANT = {
  primary: "bg-mint text-black border-mint hover:bg-black hover:text-white hover:border-black active:bg-mint/80",
  outline: "bg-transparent text-black border-black hover:bg-black hover:text-white",
  ghost: "bg-transparent text-black border-transparent hover:bg-grey-50",
};

// focus-visible: ของเดิมไม่มีเลยสักที่ (DESIGN.md §6.1)
// ไม่ใส่ font-medium/font-bold — น้ำหนัก 700 มากับ text-ui แล้ว (ใส่ทับจะ override ระบบ)
const BASE =
  "inline-flex items-center justify-center gap-2 font-ui border cursor-pointer no-underline " +
  "transition-colors duration-150 ease-base " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black " +
  "disabled:cursor-not-allowed disabled:bg-grey-200 disabled:text-grey-400 disabled:border-grey-200 " +
  "disabled:hover:bg-grey-200 disabled:hover:text-grey-400 disabled:hover:border-grey-200";

export default function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className = "", children } = props;
  const base = cn(BASE, SIZE[size], VARIANT[variant], className);

  if (props.as === "link") {
    return (
      <Link href={props.href} target={props.target} rel={props.rel} className={base}>
        {children}
      </Link>
    );
  }

  if (props.as === "a") {
    const { as: _a, variant: _v, size: _s, className: _c, external, ...rest } = props as never as {
      as: "a"; variant: string; size: string; className: string; external?: boolean;
      href: string; children: React.ReactNode; [k: string]: unknown;
    };
    return (
      <a {...rest} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className={base}>
        {children}
      </a>
    );
  }

  const { as: _a, variant: _v, size: _s, className: _c, ...rest } = props as never as {
    as?: "button"; variant: string; size: string; className: string;
    children: React.ReactNode; [k: string]: unknown;
  };
  return (
    <button {...rest} className={base}>
      {children}
    </button>
  );
}
