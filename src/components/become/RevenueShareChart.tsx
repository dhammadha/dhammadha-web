"use client";

import { useState } from "react";
import { SPLIT } from "@/lib/subscription-revenue";
import { cn } from "@/lib/cn";

/**
 * RevenueShareChart — โดนัทส่วนแบ่งรายได้ หน้า /become-a-designer
 *
 * โชว์ทีละโมเดล (กดสลับ) แทนการวางชาร์ตคู่กัน — เจ้าของเคาะแล้วว่าวางคู่กันจะรก
 * hover/แตะ slice ไหน → แผงขวาขึ้นวิธีคำนวณของส่วนนั้น
 *
 * ตัวเลข subscription ผูกกับ SPLIT ใน lib/subscription-revenue.ts (แหล่งความจริงเดียว)
 * ส่วน retail 75/25 ตรงกับ PLATFORM_RATE_FALLBACK ใน lib/revenue.ts:55 + สัญญานักออกแบบ
 *
 * ⚠️ ห้ามใช้คำว่า B2B/B2C ในข้อความที่ผู้ใช้เห็น (เจ้าของสั่ง) — งานใบเสนอราคา
 * พูดเป็น "ระบบใบเสนอราคาฟรี" ในส่วน benefit ของหน้า ไม่ใช่ในชาร์ตนี้
 */

type Tone = "mint" | "mint-soft" | "grey";

type Slice = {
  key: string;
  label: string;
  pct: number;
  tone: Tone;
  detail: string;
};

type Model = {
  id: string;
  tab: string;
  blurb: string;
  centerValue: string;
  centerLabel: string;
  slices: Slice[];
};

const pct = (n: number) => Math.round(n * 100); // 0.38*100 = 38.000000000000006 ใน JS

const MODELS: Model[] = [
  {
    id: "retail",
    tab: "Retail Font",
    blurb: "ลูกค้าซื้อฟอนต์รายชุดผ่านหน้าเว็บ",
    centerValue: "75%",
    centerLabel: "ส่วนของคุณ",
    slices: [
      {
        key: "designer",
        label: "นักออกแบบ",
        pct: 75,
        tone: "mint",
        detail:
          "ทุกยอดขายผ่านหน้าเว็บ คุณได้รับ 75% — สูงกว่ามาร์เก็ตเพลสทั่วไปที่หัก 30–50% (ตัวอย่าง : ฟอนต์ราคา 1,000 บาท คุณได้ 750 บาท)",
      },
      {
        key: "platform",
        label: "แพลตฟอร์ม",
        pct: 25,
        tone: "grey",
        detail:
          "ค่าดำเนินการระบบ 25% ครอบคลุมค่าเว็บไซต์ ระบบป้องกันไฟล์ฟอนต์ เอกสาร และการตลาด รวมถึงค่าธรรมเนียมการชำระเงิน",
      },
    ],
  },
  {
    id: "subscription",
    tab: "Subscription",
    blurb: "รายได้ค่าสมาชิกรายเดือน แบ่งให้ทุกฟอนต์ที่เข้าร่วม",
    centerValue: "50%",
    centerLabel: "แบ่งให้นักออกแบบ",
    slices: [
      {
        key: "stream",
        label: "ตามการใช้งานจริง",
        pct: pct(SPLIT.stream),
        tone: "mint",
        detail:
          "แบ่งตามการใช้งานจริง — 38% ของรายได้เดือนนั้น × สัดส่วนการใช้ฟอนต์ของคุณ ยิ่งมีสมาชิกใช้ฟอนต์คุณมาก ส่วนแบ่งของคุณก็จะมากขึ้น",
      },
      {
        key: "equal",
        label: "แบ่งเท่ากันทุกฟอนต์",
        pct: pct(SPLIT.equal),
        tone: "mint-soft",
        detail:
          "แบ่งเท่ากันทุกฟอนต์ — 12% ของรายได้เดือนนั้น ÷ จำนวนฟอนต์ทั้งหมดที่เข้าร่วมระบบสมาชิก ทุกฟอนต์ได้เท่ากัน ไม่ว่าเดือนนั้นจะมีคนใช้มากหรือน้อย",
      },
      {
        key: "platform",
        label: "แพลตฟอร์ม",
        pct: pct(SPLIT.web),
        tone: "grey",
        detail:
          "ค่าดำเนินการระบบสมาชิก 50% ครอบคลุมค่าเว็บไซต์ ระบบสตรีมฟอนต์ การตลาด และค่าธรรมเนียมการชำระเงิน",
      },
    ],
  },
];

// ── โดนัท ────────────────────────────────────────────────────────────────────
// วาดด้วย stroke-dasharray บน <circle> ไม่ใช่ path arc — คณิตสั้นกว่าและ
// hover-highlight ทำได้ด้วยการขยาย stroke-width เฉย ๆ
//
// R เล็กพอให้ stroke ตัวหนา (active) ไม่ล้น viewBox:
//   ขอบนอกสุด = 50 + R + ACTIVE_W/2 = 50+36+11 = 97 < 100 ✓
const R = 36;
const C = 2 * Math.PI * R;
const BASE_W = 16;
const ACTIVE_W = 22;
const GAP = 2; // ช่องว่างระหว่าง slice — แยกด้วยที่ว่างแทนเส้นคั่น (DESIGN.md §4.0)

const TONE_STROKE: Record<Tone, string> = {
  mint: "stroke-mint",
  "mint-soft": "stroke-mint",
  grey: "stroke-grey-400",
};

// mint-soft = mint จาง — พาเลตใหม่ไม่มี mint อ่อน (mint-light/mint-mid เป็น token เก่า)
const TONE_OPACITY: Record<Tone, number> = { mint: 1, "mint-soft": 0.45, grey: 1 };

const TONE_SWATCH: Record<Tone, string> = {
  mint: "bg-mint",
  "mint-soft": "bg-mint/45",
  grey: "bg-grey-400",
};

export default function RevenueShareChart() {
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [activeKey, setActiveKey] = useState(MODELS[0].slices[0].key);

  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0];
  const active = model.slices.find((s) => s.key === activeKey) ?? model.slices[0];

  // สลับโมเดลแล้วรีเซ็ต slice ที่เลือกไปตัวแรกของโมเดลใหม่ (key คนละชุดกัน)
  // ทำตรงนี้แทน useEffect — repo นี้ lint กันการ setState ใน effect อยู่
  function selectModel(m: Model) {
    setModelId(m.id);
    setActiveKey(m.slices[0].key);
  }

  // จุดเริ่มของแต่ละ slice = ผลรวม % ของ slice ก่อนหน้า (หน่วยเดียวกับเส้นรอบวง)
  const starts: number[] = [];
  model.slices.reduce((acc, s) => {
    starts.push(acc);
    return acc + (s.pct / 100) * C;
  }, 0);

  return (
    <div>
      {/* สลับโมเดล — active แยกด้วยพื้นสี ไม่ใช่เส้นขอบ */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {MODELS.map((m) => {
          const on = m.id === model.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => selectModel(m)}
              aria-pressed={on}
              className={cn(
                "font-ui text-ui px-5 py-2.5 cursor-pointer transition-colors duration-150 ease-base",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                on ? "bg-mint text-black" : "bg-surface text-grey-600 hover:bg-grey-200 hover:text-black"
              )}
            >
              {m.tab}
            </button>
          );
        })}
      </div>

      <p className="font-body text-body-sm text-grey-600 mb-6">{model.blurb}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center">
        {/* โดนัท */}
        <div className="relative w-full max-w-[300px] mx-auto md:mx-0">
          {/* w-full + h-auto ให้ความสูงมาจาก viewBox เอง — เคยใช้ aspect-square + h-full
              แล้ว Safari ไม่วาดวงเลย (กล่องมีขนาดแต่ svg ไม่ได้ความสูง) */}
          <svg
            viewBox="0 0 100 100"
            width="100%"
            height="100%"
            className="block w-full h-auto -rotate-90"
            role="img"
            aria-label={`สัดส่วนรายได้ ${model.tab}`}
          >
            {model.slices.map((s, i) => {
              const len = (s.pct / 100) * C;
              return (
                <circle
                  key={s.key}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  // transition เฉพาะ stroke-width (ตัวเดียวที่เปลี่ยนตอน hover) — เคยใช้
                  // transition-all แล้ว Safari ไล่ค่า stroke-dasharray ตอน mount ทำให้เส้นหาย
                  className={cn(TONE_STROKE[s.tone], "cursor-pointer transition-[stroke-width] duration-200 ease-base")}
                  strokeOpacity={TONE_OPACITY[s.tone]}
                  strokeWidth={s.key === active.key ? ACTIVE_W : BASE_W}
                  strokeDasharray={`${Math.max(len - GAP, 0.1)} ${C}`}
                  strokeDashoffset={-starts[i]}
                  onMouseEnter={() => setActiveKey(s.key)}
                  onClick={() => setActiveKey(s.key)}
                />
              );
            })}
          </svg>

          {/* ตัวเลขกลางโดนัท — ซ้อนเป็น HTML เพื่อใช้ type scale ของระบบได้ตรง ๆ */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-heading text-h1 text-black leading-none">{model.centerValue}</span>
            <span className="font-body text-body-sm text-grey-600 mt-1.5">{model.centerLabel}</span>
          </div>
        </div>

        {/* แผงรายละเอียด */}
        <div>
          <div className="flex flex-col">
            {model.slices.map((s) => {
              const on = s.key === active.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onMouseEnter={() => setActiveKey(s.key)}
                  onClick={() => setActiveKey(s.key)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-3 w-full text-left px-3 py-3 cursor-pointer",
                    "transition-colors duration-150 ease-base",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                    on ? "bg-surface" : "hover:bg-surface"
                  )}
                >
                  <span className={cn("w-3 h-3 shrink-0", TONE_SWATCH[s.tone])} />
                  <span className={cn("font-body text-body flex-1", on ? "text-black" : "text-grey-600")}>
                    {s.label}
                  </span>
                  <span className={cn("font-heading text-h2", on ? "text-black" : "text-grey-600")}>{s.pct}%</span>
                </button>
              );
            })}
          </div>

          <div className="bg-surface p-5 mt-4">
            <p className="font-body text-body text-grey-800 leading-[1.8]">{active.detail}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
