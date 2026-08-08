#!/usr/bin/env python3
"""สร้าง webfont ของ typedee จากไฟล์ต้นฉบับ .otf

    python3 scripts/build-typedee-webfont.py

ต้นทาง : docs/design/typedee.com/font/typedee/typedee-{Bold,Black}.otf   (ห้ามแก้)
ปลายทาง: src/fonts/typedee-{Bold,Black}.woff2  + สำเนาไปที่ desktop/src/fonts/

ต้องมี fontTools + brotli ใน python3 (เครื่องเจ้าของมีอยู่แล้ว ไม่ต้อง pip install)

สามอย่างที่สคริปต์นี้ทำ นอกจากแปลงฟอร์แมต
──────────────────────────────────────────
1. **ไม่แตะ Regular** — ส่งขึ้นเว็บแค่ Bold/Black เป็นมาตรการกันฟอนต์หลุด
   (Regular คือน้ำหนักที่ขโมยไปใช้คุ้มที่สุด) · ตอนนี้ layout.tsx ประกาศแค่ Black
   เพราะ typedee ถอยมาเหลือแค่หัวข้อใหญ่ซึ่งเป็น 900 ทั้งหมด — Bold ยังสร้างไว้ให้
   เผื่อเติมกลับ และ desktop ใช้ผ่าน @font-face ของตัวเอง

2. **fsType + license string** — fsType = 4 (Preview & Print) และเขียน nameID 13/14
   ทับของเดิมซึ่งชี้ `dhammadha.com/agreement` (URL นั้นจะตายหลัง DNS cutover)

3. **🔑 vertical metrics** — ของเดิม typo asc/desc/gap = 750 / -250 / 200 ซึ่งเบราว์เซอร์
   ยุบเป็น ascent 850 · descent 350 → จุดกึ่งกลางกล่องอยู่ 250 หน่วยเหนือเส้นฐาน
   แต่กึ่งกลางสายตาของตัวอักษรอยู่สูงกว่านั้น (ก = 590/2 = 295 · A = 686/2 = 343)
   **ตัวอักษรจึงลอยสูง เหลือที่ว่างด้านล่างกล่องเยอะกว่าด้านบน** (เจ้าของสังเกตจากป้าย/ปุ่ม)
   แก้โดยขยับกล่องขึ้นให้กึ่งกลางไปอยู่ที่ VCENTER โดย **คงผลรวม asc+desc เท่าเดิม**
   → ความสูงบรรทัดไม่เปลี่ยน เปลี่ยนแค่ตำแหน่งเส้นฐานในกล่อง

   ⚠️ ต้องตั้ง hhea ให้ตรงกับ OS/2 ด้วย — เบราว์เซอร์บางตัวอ่าน hhea ไม่ใช่ typo
   ⚠️ usWinAscent/Descent เป็นกรอบกันตัดของ Windows ต้องคลุม head.yMin/yMax
      ไม่งั้นสระบน/ล่างโดนตัด (ของเดิม winAscent 950 < yMax 1057 = เสี่ยงอยู่แล้ว)
"""
import os
import shutil
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs/design/typedee.com/font/typedee")
DST = os.path.join(ROOT, "src/fonts")
DESKTOP_DST = os.path.join(ROOT, "desktop/src/fonts")

LICENSE_DESC = (
    "Copyright © 2026 Montonn Thanaroj. All Rights Reserved. "
    "This webfont is licensed for use on typedee.com only. "
    "Downloading, extracting, redistributing, embedding in other products, "
    "or converting this file for use elsewhere is not permitted."
)
LICENSE_URL = "https://typedee.com"

FS_TYPE_PREVIEW_PRINT = 0x0004

# จุดกึ่งกลางกล่องที่ต้องการ วัดเป็นหน่วยฟอนต์เหนือเส้นฐาน (upm 1000)
# 320 = ตรงกลางระหว่างกึ่งกลางตัวไทย (ก 295) กับกึ่งกลางตัวละตินพิมพ์ใหญ่ (A 343)
# ทั้งสองอย่างอยู่ปนกันในหัวข้อบนเว็บนี้ จึงเลือกค่ากลาง
VCENTER = 320


def build(weight: str) -> None:
    src = os.path.join(SRC, f"typedee-{weight}.otf")
    dst = os.path.join(DST, f"typedee-{weight}.woff2")
    before = os.path.getsize(src)

    f = TTFont(src)
    os2, hhea, head = f["OS/2"], f["hhea"], f["head"]

    old = (os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap)
    # ผลรวมเดิม (รวม lineGap ที่เบราว์เซอร์แบ่งครึ่งบน/ล่าง) = ความสูงกล่องที่ต้องคงไว้
    total = old[0] - old[1] + old[2]
    ascender = (total + 2 * VCENTER) // 2
    descender = total - ascender  # เก็บเป็นค่าบวก ใส่ลงฟอนต์เป็นลบ

    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ascender, -descender, 0
    hhea.ascent, hhea.descent, hhea.lineGap = ascender, -descender, 0
    os2.fsSelection |= 128  # USE_TYPO_METRICS — บังคับให้ทุกเครื่องอ่านค่าชุดเดียวกัน
    os2.usWinAscent = max(os2.usWinAscent, head.yMax)
    os2.usWinDescent = max(os2.usWinDescent, -head.yMin)

    os2.fsType = FS_TYPE_PREVIEW_PRINT
    for nid, val in ((13, LICENSE_DESC), (14, LICENSE_URL)):
        f["name"].setName(val, nid, 1, 0, 0)
        f["name"].setName(val, nid, 3, 1, 0x409)

    f.flavor = "woff2"
    f.save(dst)
    f.close()

    shutil.copy2(dst, os.path.join(DESKTOP_DST, f"typedee-{weight}.woff2"))
    print(
        f"{weight:6} typo {old[0]}/{old[1]}/gap{old[2]} → {ascender}/{-descender}/gap0 "
        f"(กึ่งกลางกล่อง {(old[0] + old[1]) // 2} → {VCENTER}) | "
        f"{before:,} B otf → {os.path.getsize(dst):,} B woff2"
    )


if __name__ == "__main__":
    os.makedirs(DST, exist_ok=True)
    os.makedirs(DESKTOP_DST, exist_ok=True)
    for w in ("Bold", "Black"):
        build(w)
