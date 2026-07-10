// In-browser font pipeline — ใช้ Pyodide (Python บน WebAssembly) รัน fonttools
// ในเบราว์เซอร์ เพื่อ generate ไฟล์จากฟอนต์เต็มโดยไม่ต้องมี server:
//   1. Tester (obfuscated) .woff2 ทุก weight + map — type tester แสดงฟอนต์จริง
//      แต่ไฟล์ที่ถูกดูดไปพิมพ์ออกมาเป็นตัวมั่ว
//   2. Demo .ttf/.otf — เฉพาะ Regular ตัดเหลือภาษาไทย เปลี่ยนชื่อเป็น DEMO
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
import io, json, random
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

# หมวดอักขระที่สลับกันได้ — permute ภายในหมวดเดียวกันเท่านั้น ไม่งั้น
# การจัด cluster/ตำแหน่ง mark ของ shaping engine ภาษาไทยพัง
CHAR_GROUPS = [
    "".join(chr(c) for c in range(0x0E01, 0x0E2F)),  # พยัญชนะ ก-ฮ
    "\\u0e40\\u0e41\\u0e42\\u0e43\\u0e44",            # สระหน้า เ แ โ ใ ไ
    "\\u0e30\\u0e32",                                  # สระหลัง ะ า
    "\\u0e31\\u0e34\\u0e35\\u0e36\\u0e37\\u0e47\\u0e4c\\u0e4d",  # สระบน/ไม้ไต่คู้/การันต์/นิคหิต
    "\\u0e48\\u0e49\\u0e4a\\u0e4b",                    # วรรณยุกต์
    "\\u0e3a\\u0e38\\u0e39",                           # สระล่าง/พินทุ
    "".join(chr(c) for c in range(0x0E50, 0x0E5A)),  # เลขไทย
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
]

DEMO_UNICODES = list(range(0x0E00, 0x0E80)) + [0x20]


def build_mapping(seed):
    """map { อักขระที่พิมพ์ -> อักขระที่ส่งให้ฟอนต์ } ใช้ร่วมกันทุก weight"""
    rng = random.Random(seed)
    mapping = {}
    for group in CHAR_GROUPS:
        chars = list(group)
        if len(chars) == 2:
            shuffled = chars[::-1]
        else:
            shuffled = chars[:]
            for _ in range(100):
                rng.shuffle(shuffled)
                if all(a != b for a, b in zip(chars, shuffled)):
                    break
        for orig, enc in zip(chars, shuffled):
            mapping[orig] = enc
    return mapping


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


def make_tester(in_path, family, mapping):
    """คืน bytes ของ .woff2 ที่ cmap ถูกสลับตาม mapping"""
    font = TTFont(in_path)
    for table in font["cmap"].tables:
        if not table.isUnicode():
            continue
        oc = dict(table.cmap)
        nc = dict(oc)
        for orig, enc in mapping.items():
            o, e = ord(orig), ord(enc)
            if o in oc:
                nc[e] = oc[o]
            elif e in nc:
                del nc[e]
        table.cmap = nc
    rename_family(font, family + " TESTER")
    font.flavor = "woff2"
    out = io.BytesIO()
    font.save(out)
    font.close()
    return out.getvalue()


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

export interface GeneratedFontAssets {
  /** ไฟล์ tester (obfuscated) หนึ่งไฟล์ต่อ weight */
  testerFiles: File[];
  /** map { อักขระที่พิมพ์ → อักขระที่ส่งให้ฟอนต์ } เก็บลง fonts.obfuscated_map */
  map: Record<string, string>;
  /** demo Regular ภาษาไทย (null ถ้าไม่มีไฟล์ต้นทาง) */
  demoFile: File | null;
}

function weightFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const w = base.includes("-") ? base.split("-").pop()! : "regular";
  return w.toLowerCase() || "regular";
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * สร้างไฟล์ tester (obfuscated ทุก weight) + demo (Regular ไทย) จากไฟล์เต็ม
 * ทำงานในเบราว์เซอร์ล้วน — ไฟล์เต็มไม่ออกจากเครื่องผู้ใช้ระหว่างประมวลผล
 */
export async function generateFontAssets(
  fullFonts: File[],
  familyName: string,
  onProgress: (msg: string) => void = () => {}
): Promise<GeneratedFontAssets> {
  if (!fullFonts.length) throw new Error("ไม่มีไฟล์ฟอนต์เต็มให้ประมวลผล");
  const family = familyName.trim() || "Font";

  const pyodide = await loadPyodideOnce(onProgress);

  // permutation ใหม่ทุกครั้งที่ generate (ทุก weight ของฟอนต์เดียวกันใช้ map เดียวกัน)
  const seed = randomHex(16);
  pyodide.globals.set("js_seed", seed);
  const mapJson = pyodide.runPython(
    "mapping = build_mapping(js_seed); json.dumps(mapping, ensure_ascii=False)"
  );
  const map = JSON.parse(mapJson) as Record<string, string>;

  const prefix = `tester-${randomHex(4)}`;
  const testerFiles: File[] = [];
  for (let i = 0; i < fullFonts.length; i++) {
    const f = fullFonts[i];
    const weight = weightFromFilename(f.name);
    onProgress(`กำลังสร้าง tester ${i + 1}/${fullFonts.length} (${weight})…`);
    const inPath = `/tmp/in-${i}`;
    pyodide.FS.writeFile(inPath, new Uint8Array(await f.arrayBuffer()));
    pyodide.globals.set("js_in_path", inPath);
    pyodide.globals.set("js_family", family);
    pyodide.runPython(
      "tester_bytes = make_tester(js_in_path, js_family, mapping)\n" +
      "with open('/tmp/tester.out', 'wb') as f: f.write(tester_bytes)"
    );
    const bytes = pyodide.FS.readFile("/tmp/tester.out");
    testerFiles.push(new File([new Uint8Array(bytes)], `${prefix}-${weight}.woff2`, { type: "font/woff2" }));
    pyodide.FS.unlink(inPath);
  }

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
  const demoFile = new File([new Uint8Array(demoBytes)], demoName);

  onProgress("เสร็จแล้ว");
  return { testerFiles, map, demoFile };
}
