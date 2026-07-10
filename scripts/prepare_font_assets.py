#!/usr/bin/env python3
"""
เตรียมไฟล์ฟอนต์สำหรับขึ้นเว็บ DHAMMADHA จากไฟล์ฟอนต์เต็ม

ผลิต 2 อย่าง:

1. Tester fonts (obfuscated) — ทุก weight, glyph ครบทุกตัว แต่ "สลับรหัสตัวอักษร"
   (permute cmap ภายในหมวดเดียวกัน เช่น พยัญชนะ↔พยัญชนะ สระบน↔สระบน)
   เว็บใช้ map.json แปลงข้อความที่พิมพ์ก่อน render จึงแสดงผลถูกต้อง
   แต่ไฟล์ที่ถูกดูดไปติดตั้ง จะพิมพ์ออกมาเป็นตัวอักษรมั่วทั้งหมด ใช้งานจริงไม่ได้
   → อัปโหลดเข้า FontForm ช่อง "Tester Font" + วางไฟล์ map.json

2. Demo font — เฉพาะน้ำหนัก Regular, ตัด glyph เหลือภาษาไทย + เว้นวรรค,
   เปลี่ยนชื่อ family เป็น "<ชื่อ> DEMO"
   → อัปโหลดเข้า FontForm ช่อง "Demo Font" (ให้ลูกค้าดาวน์โหลดทดลอง)

วิธีใช้:
    pip install fonttools brotli
    python3 scripts/prepare_font_assets.py \
        --slug suratana --family "Suratana" \
        --out ./font-assets \
        path/to/Suratana-Regular.otf path/to/Suratana-Bold.otf ...

ข้อกำหนดชื่อไฟล์ input: <ชื่อ>-<weight>.otf|ttf (เช่น suratana-bold.otf)
เพราะเว็บอ่านชื่อ weight จากท้ายชื่อไฟล์
"""

import argparse
import json
import random
import secrets
import sys
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
    from fontTools.subset import Subsetter, Options
except ImportError:
    sys.exit("ต้องติดตั้งก่อน: pip install fonttools brotli")

# ── หมวดอักขระที่สลับกันได้ (permute ภายในหมวดเดียวกันเท่านั้น) ──────────────
# เหตุผล: การจัดกลุ่มอักขระ (cluster) และตำแหน่ง mark ของ shaping engine
# อิงชนิดของ codepoint — สลับข้ามหมวด (เช่น สระบน↔พยัญชนะ) จะ render พัง

CHAR_GROUPS: list[str] = [
    # พยัญชนะไทย ก-ฮ
    "".join(chr(c) for c in range(0x0E01, 0x0E2F)),
    # สระหน้า เ แ โ ใ ไ
    "เแโใไ",
    # สระหลัง ะ า (ำ ไม่สลับ — เป็นอักขระประสม)
    "ะา",
    # สระบน + ไม้ไต่คู้/การันต์/นิคหิต: ั ิ ี ึ ื ็ ์ ํ
    "ัิีึื็์ํ",
    # วรรณยุกต์ ่ ้ ๊ ๋ (สลับกันเองเท่านั้น ให้ตำแหน่งลอยเหมือนกัน)
    "่้๊๋",
    # สระล่าง ุ ู ฺ
    "ฺุู",
    # ตัวเลขไทย
    "".join(chr(c) for c in range(0x0E50, 0x0E5A)),
    # ละติน
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
]

# glyph ที่คงไว้ในไฟล์ demo (ภาษาไทยทั้ง block + เว้นวรรค)
DEMO_UNICODES = "U+0E00-0E7F,U+0020"


def build_permutation(rng: random.Random) -> dict[str, str]:
    """สร้าง map { อักขระที่พิมพ์ → อักขระที่ต้องส่งให้ฟอนต์ } (perm ผกผัน)"""
    typed_to_encoded: dict[str, str] = {}
    for group in CHAR_GROUPS:
        chars = list(group)
        if len(chars) == 2:
            shuffled = chars[::-1]  # กลุ่ม 2 ตัว บังคับสลับกันเสมอ
        else:
            shuffled = chars[:]
            # derangement แบบง่าย: สลับจนไม่มีตัวไหนอยู่ที่เดิม
            for _ in range(100):
                rng.shuffle(shuffled)
                if all(a != b for a, b in zip(chars, shuffled)):
                    break
        # cmap ใหม่: codepoint shuffled[i] → glyph ของ chars[i]
        # เว็บอยากแสดง glyph ของ chars[i] จึงต้องส่ง shuffled[i]
        for original, encoded in zip(chars, shuffled):
            typed_to_encoded[original] = encoded
    return typed_to_encoded


def apply_obfuscation(font: TTFont, typed_to_encoded: dict[str, str]) -> None:
    """เขียน cmap ใหม่ตาม permutation: cmap[encoded] = glyph(original)"""
    cmap_table = font["cmap"]
    for table in cmap_table.tables:
        if not table.isUnicode():
            continue
        original_cmap = dict(table.cmap)
        new_cmap = dict(original_cmap)
        for original, encoded in typed_to_encoded.items():
            o_cp, e_cp = ord(original), ord(encoded)
            if o_cp in original_cmap:
                new_cmap[e_cp] = original_cmap[o_cp]
            elif e_cp in new_cmap:
                del new_cmap[e_cp]
        table.cmap = new_cmap


def rename_family(font: TTFont, new_family: str) -> None:
    """เปลี่ยนชื่อ family ใน name table (กันสับสน/กันค้นหาไฟล์จริงเจอ)"""
    name = font["name"]
    old_family = name.getDebugName(16) or name.getDebugName(1) or ""
    for record in name.names:
        if record.nameID not in (1, 3, 4, 6, 16, 21):
            continue
        text = record.toUnicode()
        new_text = text.replace(old_family, new_family) if old_family and old_family in text else new_family
        if record.nameID == 6:  # PostScript name — ห้ามมีช่องว่าง
            new_text = new_text.replace(" ", "")
        name.setName(new_text, record.nameID, record.platformID, record.platEncID, record.langID)


def weight_from_filename(path: Path) -> str:
    base = path.stem
    return base.split("-")[-1].lower() if "-" in base else "regular"


def make_tester(src: Path, out_dir: Path, family: str, prefix: str,
                typed_to_encoded: dict[str, str]) -> Path:
    font = TTFont(str(src))
    apply_obfuscation(font, typed_to_encoded)
    rename_family(font, f"{family} TESTER")
    font.flavor = "woff2"
    weight = weight_from_filename(src)
    out_path = out_dir / f"{prefix}-{weight}.woff2"
    font.save(str(out_path))
    font.close()
    return out_path


def make_demo(src: Path, out_dir: Path, family: str) -> Path:
    font = TTFont(str(src))
    options = Options()
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.layout_features = ["*"]  # คง OpenType features สำหรับไทย (mark, mkmk, liga)
    subsetter = Subsetter(options=options)
    unicodes = []
    for part in DEMO_UNICODES.split(","):
        part = part.replace("U+", "")
        if "-" in part:
            lo, hi = part.split("-")
            unicodes.extend(range(int(lo, 16), int(hi, 16) + 1))
        else:
            unicodes.append(int(part, 16))
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    rename_family(font, f"{family} DEMO")
    ext = src.suffix.lower().lstrip(".")
    out_path = out_dir / f"{family.lower().replace(' ', '-')}-demo-regular.{ext}"
    font.save(str(out_path))
    font.close()
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--slug", required=True, help="slug ของฟอนต์บนเว็บ เช่น suratana")
    parser.add_argument("--family", required=True, help='ชื่อ family เช่น "Suratana"')
    parser.add_argument("--out", default="./font-assets", help="โฟลเดอร์ output")
    parser.add_argument("fonts", nargs="+", type=Path, help="ไฟล์ฟอนต์เต็ม (otf/ttf) ทุก weight")
    args = parser.parse_args()

    out_root = Path(args.out) / args.slug
    tester_dir = out_root / "tester"
    demo_dir = out_root / "demo"
    tester_dir.mkdir(parents=True, exist_ok=True)
    demo_dir.mkdir(parents=True, exist_ok=True)

    # permutation คงที่ต่อฟอนต์ (ทุก weight ใช้ map เดียวกัน) + สุ่มใหม่ทุกครั้งที่รัน
    rng = random.Random(secrets.token_hex(16))
    typed_to_encoded = build_permutation(rng)
    prefix = f"tester-{secrets.token_hex(4)}"

    print(f"▸ สร้าง tester fonts (obfuscated) — {len(args.fonts)} weight")
    for src in args.fonts:
        out = make_tester(src, tester_dir, args.family, prefix, typed_to_encoded)
        print(f"  ✓ {out}")

    map_path = tester_dir / "obfuscated_map.json"
    map_path.write_text(json.dumps(typed_to_encoded, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"  ✓ {map_path}")

    regulars = [f for f in args.fonts if weight_from_filename(f) in ("regular", "normal")]
    demo_src = regulars[0] if regulars else args.fonts[0]
    print(f"▸ สร้าง demo font (ไทยอย่างเดียว, regular) จาก {demo_src.name}")
    out = make_demo(demo_src, demo_dir, args.family)
    print(f"  ✓ {out}")

    print(f"""
เสร็จแล้ว — ขั้นตอนต่อไปใน FontForm:
  1. ช่อง "Tester Font (obfuscated)" → อัปโหลดทุกไฟล์ใน {tester_dir}/ (.woff2)
     และเลือกไฟล์ map: {map_path}
  2. ช่อง "Demo Font" → อัปโหลด {out}
""")


if __name__ == "__main__":
    main()
