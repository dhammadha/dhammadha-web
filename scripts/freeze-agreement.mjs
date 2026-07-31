#!/usr/bin/env node
/**
 * แช่แข็งสัญญาอนุญาตฉบับปัจจุบันเป็นหน้าแยก ก่อนจะแก้เนื้อหาฉบับใหม่
 *
 *   npm run legal:freeze
 *
 * ทำไมต้องมี: `/agreement` ข้อ 14 สัญญาว่าสิทธิ์ที่ซื้อไปแล้วยังอยู่ใต้สัญญาฉบับที่มีผล
 * ในวันสั่งซื้อ และเอกสารทุกใบตรึงบรรทัด "ตามสัญญาอนุญาตฉบับ <วันที่>" ไว้ (license.ts)
 * ถ้าแก้ทับฉบับเดิมโดยไม่เก็บไว้ บรรทัดนั้นจะชี้ไปหน้าที่ไม่มีอยู่แล้ว
 *
 * ลำดับที่ถูกต้อง: แช่แข็งก่อน → แล้วค่อยแก้ EFFECTIVE_DATE และเนื้อหา
 * (สคริปต์จะหยุดถ้าตรวจพบว่าแก้ page.tsx ค้างไว้ก่อนแช่แข็ง)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEGAL_TS = join(ROOT, "src/lib/legal.ts");
const AGREEMENT = join(ROOT, "src/app/agreement/page.tsx");

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

/** "1 สิงหาคม 2569" → "2569-08" (ชื่อโฟลเดอร์ เรียงตามเวลาได้) */
function slugOf(effectiveDate) {
  const m = effectiveDate.trim().match(/^\d+\s+(\S+)\s+(\d{4})$/);
  if (!m) die(`อ่านวันที่ "${effectiveDate}" ไม่ออก — ต้องเป็นรูปแบบ "1 สิงหาคม 2569"`);
  const month = THAI_MONTHS.indexOf(m[1]);
  if (month < 0) die(`ไม่รู้จักเดือน "${m[1]}"`);
  return `${m[2]}-${String(month + 1).padStart(2, "0")}`;
}

// ── 1. อ่านวันที่มีผลปัจจุบัน ──────────────────────────────────────────────
const legalSrc = readFileSync(LEGAL_TS, "utf8");
const dateMatch = legalSrc.match(/export const EFFECTIVE_DATE = "([^"]+)"/);
if (!dateMatch) die(`หา EFFECTIVE_DATE ใน ${LEGAL_TS} ไม่เจอ — รูปแบบไฟล์เปลี่ยนไปหรือเปล่า`);

const effectiveDate = dateMatch[1];
const slug = slugOf(effectiveDate);
const outDir = join(ROOT, "src/app/agreement", slug);
const outFile = join(outDir, "page.tsx");

// ── 2. กันการแช่แข็งผิดลำดับ ───────────────────────────────────────────────
// ถ้า page.tsx ถูกแก้ค้างไว้ แปลว่าน่าจะแก้เนื้อหาใหม่ไปแล้ว การแช่แข็งตอนนี้
// จะได้ "ฉบับใหม่" มาเก็บในชื่อของฉบับเก่า ซึ่งผิดและตรวจจับยากมากภายหลัง
try {
  const dirty = execFileSync(
    "git",
    ["status", "--porcelain", "--", "src/app/agreement/page.tsx"],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  ).trim();
  if (dirty) {
    die(
      `src/app/agreement/page.tsx มีการแก้ไขที่ยังไม่ commit\n\n` +
        `  ต้องแช่แข็ง "ก่อน" แก้เนื้อหาเสมอ ไม่งั้นจะได้ฉบับที่แก้แล้วมาเก็บ\n` +
        `  ถ้าการแก้นั้นตั้งใจให้เป็นส่วนหนึ่งของฉบับเก่า ให้ commit ก่อนแล้วรันใหม่\n` +
        `  ถ้าไม่ใช่ ให้ย้อนกลับด้วย: git restore src/app/agreement/page.tsx`
    );
  }
} catch (err) {
  if (err?.status === undefined) throw err; // ไม่ใช่ exit code ของ git = ปัญหาอื่น
  console.warn("⚠ ตรวจสถานะ git ไม่ได้ — ข้ามการตรวจลำดับ");
}

if (existsSync(outFile)) {
  die(`มีฉบับ ${slug} อยู่แล้วที่ ${outFile}\n  ถ้าจะเขียนทับ ให้ลบไฟล์นั้นก่อน`);
}

// ── 3. คัดลอกและแปลงเป็นหน้า "ฉบับเก่า" ────────────────────────────────────
let src = readFileSync(AGREEMENT, "utf8");

// วันที่ต้องถูกฝังเป็นค่าตายตัว ไม่ใช่ค่าคงที่ร่วม — ไม่งั้นฉบับเก่าจะเปลี่ยนตามฉบับใหม่
src = src
  .replace(
    /import LegalPage, \{([^}]*)\} from "@\/components\/LegalPage";/,
    (_, named) =>
      `import LegalPage, { ${named
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s !== "EFFECTIVE_DATE")
        .join(", ")} } from "@/components/LegalPage";`
  )
  .replace(/effectiveDate=\{EFFECTIVE_DATE\}/, `effectiveDate="${effectiveDate}"`);

// metadata: กัน search engine จัดทำดัชนีฉบับเก่า
src = src.replace(
  /(export const metadata: Metadata = \{)/,
  `$1\n  robots: { index: false, follow: false },`
);

// แถบแจ้งว่าเป็นฉบับเก่า — วางเป็นลูกตัวแรกของ <LegalPage>
src = src.replace(
  /(<LegalPage[\s\S]*?>\n)/,
  `$1      <div className="border border-border bg-bg px-5 py-4 rounded">
        <p className="font-body text-body-sm text-grey-800">
          <strong>ฉบับเก่า</strong> — สัญญาอนุญาตฉบับนี้มีผลกับการสั่งซื้อที่เกิดขึ้น
          ก่อนวันที่ฉบับถัดไปมีผล เก็บไว้เพื่อให้ผู้ที่ซื้อสิทธิ์ในช่วงเวลานั้น
          อ้างอิงเงื่อนไขที่ตกลงไว้ได้
          {" "}
          <Link href="/agreement/" className="text-mint-text">อ่านฉบับปัจจุบัน</Link>
        </p>
      </div>\n`
);

// เปลี่ยนชื่อ component + title กันสับสนตอนอ่านโค้ด
src = src
  .replace(/export default function AgreementPage\(\)/, `export default function AgreementPage${slug.replace("-", "")}()`)
  .replace(/pageTitle\("สัญญาอนุญาต"\)/, `pageTitle("สัญญาอนุญาต (ฉบับ ${effectiveDate})")`);

src =
  `// ⚠️ ไฟล์นี้สร้างโดย \`npm run legal:freeze\` — เป็นสำเนาแช่แข็งของสัญญาอนุญาต\n` +
  `// ฉบับที่มีผล ${effectiveDate} ห้ามแก้เนื้อหา เอกสารที่ออกในช่วงนั้นอ้างอิงหน้านี้อยู่\n` +
  src;

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, src, "utf8");

console.log(`
✓ แช่แข็งสัญญาอนุญาตฉบับ ${effectiveDate} แล้ว
  → src/app/agreement/${slug}/page.tsx

ขั้นตอนถัดไป
  1. แก้ EFFECTIVE_DATE ใน src/lib/legal.ts เป็นวันที่ของฉบับใหม่
  2. แก้เนื้อหา src/app/agreement/page.tsx ได้เลย
  3. เพิ่มลิงก์ฉบับก่อนหน้าในข้อ 14 "การแก้ไขสัญญา":
     <Link href="/agreement/${slug}/">ฉบับ ${effectiveDate}</Link>
  4. ถ้าเรียงเลขข้อใหม่ ต้องแก้ DOC_EXTENDED_CLAUSE ใน src/lib/license.ts ให้ตรง
`);
