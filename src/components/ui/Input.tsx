import { cn } from "@/lib/cn";

/**
 * Input — ช่องกรอกเหลี่ยม (docs/design/DESIGN.md §6.2, §4.1)
 *
 * ใช้กับช่องค้นหาใน Nav (moodboard nav bar.png: กล่องขาวเหลี่ยม + ไอคอนแว่นขยาย)
 *
 * `icon` วางไอคอนไว้ซ้ายในกล่อง — Nav เดิมทำเองด้วย absolute positioning
 * ที่นี่รวบไว้ที่เดียวเพื่อไม่ให้ search เดสก์ท็อปกับมือถือ (ซึ่งเขียนแยกกัน
 * และต้องแยกกันต่อไป — §8) หลุดจากกันทางสายตา
 */
export default function Input({
  icon,
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) {
  const field = (
    <input
      {...rest}
      className={cn(
        "w-full bg-white text-black font-body text-body-sm",
        "border border-grey-200 py-2",
        icon ? "pl-9 pr-3" : "px-3",
        "placeholder:text-grey-400",
        "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-black",
        className
      )}
    />
  );

  if (!icon) return field;

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400 pointer-events-none flex items-center">
        {icon}
      </span>
      {field}
    </div>
  );
}
