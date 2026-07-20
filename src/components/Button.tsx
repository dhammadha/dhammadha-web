import Link from "next/link";

/**
 * ⚠️ LEGACY — แช่แข็ง ห้ามแก้ ห้าม restyle
 *
 * ปุ่มของ "ดีไซน์เก่า" ใช้โดย admin / designer dashboard / auth / quote / subscribe
 * รวม 26 ไฟล์ ซึ่งยังอยู่บนดีไซน์เก่าทั้งหมดและต้องอยู่ต่อจนกว่าจะมีรอบของมันเอง
 *
 * แก้ไฟล์นี้ = ดีไซน์ dashboard เปลี่ยนตามโดยไม่ตั้งใจ
 *
 * `hover:bg-[#f5f5f2]` ข้างล่างเป็น hex ดิบทั้งที่มี token `bg` อยู่ — **ถูกแล้ว**
 * หน้าที่ใช้ปุ่มนี้ยังอยู่บนดีไซน์เก่าและควรกลมกลืนกับมัน
 *
 * ปุ่มของดีไซน์ใหม่: components/ui/Button.tsx (API เหมือนกันเป๊ะ เปลี่ยนแค่ import path)
 * การลบไฟล์นี้คือท่าปิดของการรื้อทั้งโปรเจกต์ (รวม admin) ไม่ใช่รอบนี้
 *
 * ดู docs/design/DESIGN.md §1, §8
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

const SIZE = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-5 py-2.5 text-[14px]",
  lg: "px-6 py-3 text-[15px]",
};

const VARIANT = {
  primary: "bg-mint text-white hover:bg-navy border-mint hover:border-navy",
  outline: "bg-transparent text-navy border-navy hover:bg-navy hover:text-white",
  ghost: "bg-transparent text-navy border-transparent hover:bg-[#f5f5f2]",
};

function cls(variant: keyof typeof VARIANT, size: keyof typeof SIZE, extra = "") {
  return `inline-flex items-center justify-center gap-2 font-semibold rounded-[9px] border transition-colors cursor-pointer no-underline ${SIZE[size]} ${VARIANT[variant]} ${extra}`;
}

export default function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className = "", children } = props;
  const base = cls(variant, size, className);

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
