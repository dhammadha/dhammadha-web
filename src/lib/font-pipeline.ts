// In-browser font pipeline — ใช้ Pyodide (Python บน WebAssembly) รัน fonttools
// ในเบราว์เซอร์ เพื่อ generate ไฟล์จากฟอนต์เต็มโดยไม่ต้องมี server:
//   generateDemoFile — Demo .ttf/.otf เฉพาะ Regular ตัดเหลือภาษาไทย ชื่อ DEMO
// (เดิมมี generateTesterAssets สำหรับสร้าง tester แบบ obfuscated cmap ด้วย แต่ลบทิ้งแล้ว
//  เพราะ tester ไม่ได้ subset glyph จริง — เป็นฟอนต์เต็ม 100% ที่แค่สลับ cmap ซึ่งแกะกลับได้ง่าย
//  ด้วย fontTools ทำให้ดาวน์โหลดฟรีได้โดยไม่ต้องซื้อ ปัจจุบัน type tester ใช้ render-tester
//  Edge Function เรนเดอร์เป็น PNG ฝั่ง server แทนแล้ว)
// ตรรกะเดียวกับ scripts/prepare_font_assets.py (ฝั่ง CLI สำหรับงาน batch)
// โหลด Pyodide จาก CDN ครั้งแรก ~10MB แล้ว browser cache ไว้

const PYODIDE_VERSION = "0.26.4";
// mirror หลายตัว — บางเครือข่าย/adblock บล็อก cdn.jsdelivr.net จึงลองตามลำดับ
const PYODIDE_BASES = [
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  `https://fastly.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  `https://gcore.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
];

interface PyodideFS {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
  unlink(path: string): void;
}

interface Pyodide {
  FS: PyodideFS;
  loadPackage(names: string[]): Promise<void>;
  runPython(code: string): string;
  globals: { set(name: string, value: unknown): void };
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<Pyodide>;
  }
}

// ── Python source (พอร์ตจาก scripts/prepare_font_assets.py) ─────────────────

const PY_SOURCE = `
import io
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

DEMO_UNICODES = list(range(0x0E00, 0x0E80)) + [0x20]


def rename_family(font, new_family):
    name = font["name"]
    old_family = name.getDebugName(16) or name.getDebugName(1) or ""
    for record in name.names:
        if record.nameID not in (1, 3, 4, 6, 16, 21):
            continue
        text = record.toUnicode()
        new_text = text.replace(old_family, new_family) if old_family and old_family in text else new_family
        if record.nameID == 6:  # PostScript name ห้ามมีช่องว่าง
            new_text = new_text.replace(" ", "")
        name.setName(new_text, record.nameID, record.platformID, record.platEncID, record.langID)


def make_demo(in_path, family):
    """คืน bytes ของ demo: ตัด glyph เหลือไทย+เว้นวรรค เปลี่ยนชื่อเป็น DEMO"""
    font = TTFont(in_path)
    opts = Options()
    opts.name_IDs = ["*"]
    opts.name_legacy = True
    opts.layout_features = ["*"]  # คง mark/mkmk/liga สำหรับไทย
    ss = Subsetter(options=opts)
    ss.populate(unicodes=DEMO_UNICODES)
    ss.subset(font)
    rename_family(font, family + " DEMO")
    out = io.BytesIO()
    font.save(out)
    font.close()
    return out.getvalue()
`;

// ── Pyodide loader (singleton) ───────────────────────────────────────────────

let pyodidePromise: Promise<Pyodide> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error(`load failed: ${src}`)); };
    document.head.appendChild(s);
  });
}

function loadPyodideOnce(onProgress: (msg: string) => void): Promise<Pyodide> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    let base: string | null = null;
    const errors: string[] = [];
    if (window.loadPyodide) {
      base = PYODIDE_BASES[0];
    } else {
      onProgress("กำลังโหลดเครื่องมือ (ครั้งแรก ~10MB)…");
      for (const candidate of PYODIDE_BASES) {
        try {
          await injectScript(`${candidate}pyodide.js`);
          base = candidate;
          break;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (!base || !window.loadPyodide) {
        throw new Error(
          "โหลด Pyodide ไม่สำเร็จจากทุก CDN — ตรวจสอบอินเทอร์เน็ต/adblock (ดู DevTools → Network) | " +
          errors.join(" | ")
        );
      }
    }
    const pyodide = await window.loadPyodide!({ indexURL: base });
    onProgress("กำลังโหลด fonttools…");
    await pyodide.loadPackage(["fonttools", "brotli"]);
    pyodide.runPython(PY_SOURCE);
    return pyodide;
  })();
  pyodidePromise.catch(() => { pyodidePromise = null; }); // ให้ retry ได้ถ้าพลาด
  return pyodidePromise;
}

// ── Public API ───────────────────────────────────────────────────────────────

function weightFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const w = base.includes("-") ? base.split("-").pop()! : "regular";
  return w.toLowerCase() || "regular";
}

/**
 * สร้างไฟล์ demo (Regular ตัดเหลือภาษาไทย) จากไฟล์เต็ม
 * ทำงานในเบราว์เซอร์ล้วน — ไฟล์เต็มไม่ออกจากเครื่องผู้ใช้ระหว่างประมวลผล
 */
export async function generateDemoFile(
  fullFonts: File[],
  familyName: string,
  onProgress: (msg: string) => void = () => {}
): Promise<File> {
  if (!fullFonts.length) throw new Error("ไม่มีไฟล์ฟอนต์เต็มให้ประมวลผล");
  const family = familyName.trim() || "Font";

  const pyodide = await loadPyodideOnce(onProgress);

  // demo จากไฟล์ Regular (ไม่มีก็ใช้ไฟล์แรก)
  const regular =
    fullFonts.find((f) => ["regular", "normal"].includes(weightFromFilename(f.name))) ?? fullFonts[0];
  onProgress("กำลังสร้างไฟล์ demo (Regular ภาษาไทย)…");
  const demoIn = "/tmp/demo-in";
  pyodide.FS.writeFile(demoIn, new Uint8Array(await regular.arrayBuffer()));
  pyodide.globals.set("js_in_path", demoIn);
  pyodide.globals.set("js_family", family);
  pyodide.runPython(
    "demo_bytes = make_demo(js_in_path, js_family)\n" +
    "with open('/tmp/demo.out', 'wb') as f: f.write(demo_bytes)"
  );
  const demoBytes = pyodide.FS.readFile("/tmp/demo.out");
  pyodide.FS.unlink(demoIn);
  const ext = regular.name.toLowerCase().endsWith(".otf") ? "otf" : "ttf";
  const demoName = `${family.toLowerCase().replace(/\s+/g, "-")}-demo-regular.${ext}`;

  onProgress("เสร็จแล้ว");
  return new File([new Uint8Array(demoBytes)], demoName);
}
