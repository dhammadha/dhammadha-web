#!/usr/bin/env python3
"""
สร้าง SVG โลโก้ typedee ทุก variant จากชุดพารามิเตอร์ชุดเดียว

ทำไมต้อง generate ไม่วาดมือ: ข้อถกเถียงทั้งหมดของโลโก้ชุดนี้เป็นเรื่อง "ตัวเลข"
(counter สูงเท่าไรเทียบกับ stroke ที่ขนาบ, ascender โผล่กี่ %) ถ้าวาดมือแล้วเถียงกัน
ด้วยสายตา จะพิสูจน์ไม่ได้ว่าที่แก้ไปนั้นแก้ตรงจุดจริง — พอทุกตัวมาจากพารามิเตอร์เดียวกัน
เราเปลี่ยนทีละค่าแล้วดูผลได้ และตอนได้ไฟล์ต้นแบบจริงมา ก็แก้แค่ตัวเลขใน BASE/REF

    python3 docs/design/logo/build.py

⚠️ ค่าใน REF เป็นค่า "ประมาณจากภาพในแชท" ยังไม่ได้วัดจากไฟล์เวกเตอร์ต้นฉบับ
   ดู README.md หัวข้อ "สถานะการวัด"

ระบบพิกัด: y ชี้ลง (แบบ SVG), origin = มุมซ้ายบนของ bounding box ตัวอักษร
หน่วย: bowl height = 1000 เสมอ ทุกค่าที่เหลือเทียบกับนี้ → เทียบข้าม variant ได้ตรง ๆ
"""

import json
import os

K = 0.5522847498  # circle constant สำหรับประมาณส่วนโค้ง 90° ด้วย cubic bezier

HERE = os.path.dirname(os.path.abspath(__file__))

# ── สีจากต้นแบบ (ประมาณจากภาพ — ไม่ใช่ #000/#fff) ────────────────────────────
INK = "#0A0A0A"
PAPER = "#EFEFEF"


def f(n):
    """ตัดทศนิยมให้สั้น ไม่งั้น path string ยาวโดยไม่ได้ความแม่นเพิ่ม"""
    return f"{n:.1f}".rstrip("0").rstrip(".")


def p(*xy):
    return " ".join(f(v) for v in xy)


# ═══════════════════════════════════════════════════════════════════════════
# ตัว d ละติน
# ═══════════════════════════════════════════════════════════════════════════
def latin_d(v):
    """
    d = โครงนอก (bowl + stem ที่ยื่นขึ้นเป็น ascender) ลบ counter ออก
    ใช้ fill-rule="evenodd" → เขียนสองรูปปิดแยกกันได้เลย ไม่ต้องคำนวณ boolean เอง

    B    ความสูง bowl (= 1000 เสมอ)
    A    ระยะที่ stem โผล่เหนือ bowl (ascender clearance) ← ปัญหาข้อ 2 ของต้นแบบ
    BW   ขอบซ้ายสุด → ขอบซ้ายของ stem
    ST   ความหนา stem
    SV   ความหนาเส้นตั้งด้านซ้ายของ bowl
    SHT  ความหนาเส้นนอนบน / SHB ล่าง ← ปัญหาข้อ 1 (หนาไปจน counter ไม่เหลือที่)
    R    รัศมีมุมซ้ายของ bowl (R = B/2 คือโค้งเต็มแบบ stadium)
    CLR  รัศมีด้านซ้ายของ counter ← ปัญหาข้อ 3 (ต้นแบบเป็นสี่เหลี่ยมมุมมน ไม่ล้อรูปนอก)
    CRR  รัศมีด้านขวาของ counter (มุมในที่ชนกับ stem — เผื่อไว้กันหมึกบวม)
    """
    B, A, BW, ST = v["B"], v["A"], v["BW"], v["ST"]
    SV, SHT, SHB, R = v["SV"], v["SHT"], v["SHB"], v["R"]
    W, H = BW + ST, A + B

    cy0, cy1 = A + SHT, H - SHB
    ch = cy1 - cy0
    clr = min(v["CLR"], ch / 2)
    crr = min(v["CRR"], ch / 2)

    # โครงนอก ตามเข็มนาฬิกา เริ่มที่มุมซ้ายบนของ stem
    o = [
        f"M{p(W - ST, 0)}",
        f"L{p(W, 0)}",
        f"L{p(W, H)}",
        f"L{p(R, H)}",
        # มุมซ้ายล่าง
        f"C{p(R - K * R, H, 0, H - R + K * R, 0, H - R)}",
        f"L{p(0, A + R)}",
        # มุมซ้ายบน
        f"C{p(0, A + R - K * R, R - K * R, A, R, A)}",
        f"L{p(W - ST, A)}",
        "Z",
    ]

    # counter
    c = [
        f"M{p(SV + clr, cy0)}",
        f"L{p(BW - crr, cy0)}",
        f"C{p(BW - crr + K * crr, cy0, BW, cy0 + crr - K * crr, BW, cy0 + crr)}",
        f"L{p(BW, cy1 - crr)}",
        f"C{p(BW, cy1 - crr + K * crr, BW - crr + K * crr, cy1, BW - crr, cy1)}",
        f"L{p(SV + clr, cy1)}",
        f"C{p(SV + clr - K * clr, cy1, SV, cy1 - clr + K * clr, SV, cy1 - clr)}",
        f"L{p(SV, cy0 + clr)}",
        f"C{p(SV, cy0 + clr - K * clr, SV + clr - K * clr, cy0, SV + clr, cy0)}",
        "Z",
    ]

    return " ".join(o + c), W, H


# ═══════════════════════════════════════════════════════════════════════════
# ตัว ด ไทย
# ═══════════════════════════════════════════════════════════════════════════
def thai_dee(v):
    """
    โครงสร้างมาจากการถอด outline ตัว ด ของ Noto Sans Thai ออกมาดูจริง (ดู README)
    ข้อสรุปคือ ด กับ d เป็นญาติกัน: ทั้งคู่ = bowl ซ้าย + เส้นตั้งขวา ต่างกันที่
      d  → counter ปิด, stem ยื่นขึ้นเป็น ascender
      ด  → counter เปิดด้านล่าง, stem หยุดที่ baseline, ขาซ้ายสะบัดขวาแล้วจบที่ baseline

    จึงเป็นรูปปิดรูปเดียวไม่มีรู — ต้องลากเส้นรอบเดียวยาว ๆ ไม่ใช้ evenodd
    """
    B, BW, ST = v["B"], v["BW"], v["ST"]
    SV, SHT, R = v["SV"], v["SHT"], v["R"]
    W = BW + ST

    crr = v["CRR"]
    clr = v["CLR"]
    lx = v["LEG_X"] * W       # ตำแหน่งกึ่งกลางปลายขาที่ baseline
    lw = v["LEG_W"] * SV      # ความหนาปลายขา (คอดกว่าโคน — ตามของจริง)
    mx = v["LEFT_Y"] * B      # ความสูงของจุดที่ด้านซ้ายอ้วนออกสุด

    t_in = lx + lw / 2        # ปลายขาด้านใน
    t_out = lx - lw / 2       # ปลายขาด้านนอก

    return " ".join([
        f"M{p(R, 0)}",
        f"L{p(W, 0)}",
        f"L{p(W, B)}",
        f"L{p(W - ST, B)}",                                    # ใต้ stem
        f"L{p(W - ST, SHT + crr)}",                            # ขึ้นด้านในของ stem
        f"C{p(W - ST, SHT + crr - K * crr, W - ST - crr + K * crr, SHT, W - ST - crr, SHT)}",
        f"L{p(SV + clr, SHT)}",                                # ใต้เส้นนอนบน
        f"C{p(SV + clr - K * clr, SHT, SV, SHT + clr - K * clr, SV, SHT + clr)}",
        # ด้านในของขา — ลงตรงแล้วสะบัดขวา จบที่ baseline แบบเกือบตั้งฉาก
        f"C{p(SV, B * 0.78, t_in - lw * 0.15, B * 0.93, t_in, B)}",
        f"L{p(t_out, B)}",                                     # ปลายขาตัดตรง
        # ด้านนอกของขา — ย้อนขึ้นซ้าย ไปหาจุดอ้วนสุดด้านซ้าย
        f"C{p(t_out * 0.5, B, 0, mx + (B - mx) * 0.5, 0, mx)}",
        f"C{p(0, mx - K * mx, R - K * R, 0, R, 0)}",            # ขึ้นไปหามุมซ้ายบน
        "Z",
    ]), W, B


# ═══════════════════════════════════════════════════════════════════════════
# พารามิเตอร์
# ═══════════════════════════════════════════════════════════════════════════
# DNA ที่เก็บไว้จากต้นแบบ: พิมพ์เล็ก, หนัก, เรขาคณิต, ด้านซ้ายโค้งเต็ม
BASE = dict(B=1000, BW=792, ST=416, SV=376, SHT=295, SHB=295, R=500, CLR=205, CRR=40)


def var(**kw):
    d = dict(BASE)
    d.update(kw)
    return d


# ต้นแบบรอบ 2 — สร้างขึ้นใหม่จากค่าที่กะจากภาพ ใช้เป็นตัวเทียบเท่านั้น
REF = var(A=198, SHT=367, SHB=346, CLR=72, CRR=72)

LATIN = [
    ("d1-counter",  "แก้เฉพาะ counter",        var(A=198)),
    ("d2-ascender", "แก้เฉพาะ ascender",       var(A=330, SHT=367, SHB=346, CLR=72, CRR=72)),
    ("d3-both",     "แก้ทั้งสองอย่าง",          var(A=330)),
    ("d4-lighter",  "แก้ทั้งสอง + ลดน้ำหนัก 15%", var(A=330, SV=320, ST=354, SHT=251, SHB=251, CLR=236)),
    ("d5-micro",    "เวอร์ชันสำหรับ 16px",      var(A=330, SV=330, ST=360, SHT=230, SHB=230, CLR=270)),
]

# ด ต้องการ "ช่องเปิดด้านล่าง" ที่กว้างพอถึงจะอ่านออก — วัดจาก Noto: ช่องกว้าง ≈ 0.72
# ของความหนาเส้น ถ้าแคบกว่านี้ตาจะปิดช่องเองแล้วอ่านเป็น a/ต
THAI_BASE = dict(BASE, LEG_X=0.30, LEG_W=0.45, LEFT_Y=0.52)
THAI = [
    ("t1-dee",       "ด — น้ำหนักเดียวกับ d3", dict(THAI_BASE)),
    ("t2-dee-light", "ด — น้ำหนักเดียวกับ d4",
     dict(THAI_BASE, SV=320, ST=354, SHT=251, SHB=251, CLR=236)),
]


# ═══════════════════════════════════════════════════════════════════════════
def svg(path_d, w, h, fill, evenodd, bg=None, pad=0.0):
    """pad = สัดส่วนของด้านที่ยาวกว่า ใช้ตอนใส่กรอบจัตุรัส"""
    rule = ' fill-rule="evenodd"' if evenodd else ""
    if bg is None:
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}">'
            f'<path d="{path_d}" fill="{fill}"{rule}/></svg>'
        )
    # กรอบจัตุรัส: วางมาร์คให้ด้านที่ยาวกว่ากิน (1 - 2*pad) ของกรอบ
    side = max(w, h) / (1 - 2 * pad)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(side)} {f(side)}">'
        f'<rect width="{f(side)}" height="{f(side)}" fill="{bg}"/>'
        f'<path d="{path_d}" fill="{fill}"{rule} '
        f'transform="translate({f((side - w) / 2)} {f((side - h) / 2)})"/></svg>'
    )


def metrics(name, label, v, kind):
    """ตัวเลขที่ใช้ตัดสิน — เขียนลง JSON ให้เถียงกันด้วยตัวเลขได้"""
    B = v["B"]
    ch = B - v["SHT"] - v.get("SHB", v["SHT"])
    return dict(
        name=name, label=label, kind=kind,
        ascender_pct=round(v.get("A", 0) / (v.get("A", 0) + B) * 100, 1) if kind == "latin" else None,
        stem_pct=round(v["ST"] / B * 100, 1),
        counter_h=round(ch),
        stroke_h=v["SHT"],
        counter_vs_stroke=round(ch / v["SHT"], 2),
    )


SIZES = [256, 48, 16]

SHEET_CSS = """
*{box-sizing:border-box}
body{margin:0;padding:40px 32px 80px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
     background:#f6f6f6;color:#0a0a0a}
h1{font-size:20px;font-weight:600;margin:0 0 4px}
h2{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
   margin:48px 0 12px;color:#666}
.note{color:#666;max-width:62em;margin:0 0 8px}
.warn{background:#fff5d6;border-left:3px solid #e0b500;padding:10px 14px;margin:16px 0;max-width:62em}
table{border-collapse:collapse;width:100%;margin-top:8px;background:#fff;
      box-shadow:0 1px 3px rgba(0,0,0,.08)}
th,td{border:1px solid #e4e4e4;padding:14px 12px;text-align:center;vertical-align:middle}
th{background:#fafafa;font-weight:600;font-size:12px;color:#555}
td.meta{text-align:left;width:210px}
td.meta b{display:block;font-size:14px}
td.meta span{color:#777;font-size:12px}
td.num{font-variant-numeric:tabular-nums;font-size:12px;color:#555;width:92px}
.bad{color:#c00;font-weight:600}
.good{color:#0a7a3d;font-weight:600}
.tile{display:inline-block;background:#0A0A0A;border-radius:2px}
.tile svg{display:block}
.plain svg{display:block;margin:0 auto}
.row-ref{background:#fbfbfb}
.wm{font-size:13px;letter-spacing:-.01em;color:#0a0a0a}
.px16{image-rendering:auto}
.legend{color:#777;font-size:12px;margin-top:6px}
"""


RASTER_JS = """
const PX = [16, 20, 24], ZOOM = 9;

function raster(svgStr, px, aspect) {
  const w = Math.round(px * aspect), h = px;
  const c = document.createElement('canvas');
  c.width = w * ZOOM; c.height = h * ZOOM;
  c.style.width = (w * ZOOM) + 'px';
  c.style.imageRendering = 'pixelated';
  const img = new Image();
  img.onload = () => {
    const s = document.createElement('canvas');
    s.width = w; s.height = h;
    s.getContext('2d').drawImage(img, 0, 0, w, h);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(s, 0, 0, w * ZOOM, h * ZOOM);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  return c;
}

const host = document.getElementById('raster');
const tbl = document.createElement('table');
tbl.innerHTML = '<tr><th>variant</th>' +
  PX.map(p => `<th>${p}px กรอบดำ</th>`).join('') +
  PX.map(p => `<th>${p}px มาร์คลอย</th>`).join('') + '</tr>';
RASTER.forEach(v => {
  const tr = document.createElement('tr');
  const td0 = document.createElement('td');
  td0.className = 'meta';
  td0.innerHTML = `<b>${v.name}</b>`;
  tr.appendChild(td0);
  PX.forEach(p => { const td = document.createElement('td'); td.appendChild(raster(v.tile, p, 1)); tr.appendChild(td); });
  PX.forEach(p => { const td = document.createElement('td'); td.appendChild(raster(v.plain, p, v.w / v.h)); tr.appendChild(td); });
  tbl.appendChild(tr);
});
host.appendChild(tbl);
"""


def tile_html(m, px, pad=0.24):
    side = max(m["w"], m["h"]) / (1 - 2 * pad)
    dx, dy = (side - m["w"]) / 2, (side - m["h"]) / 2
    rule = ' fill-rule="evenodd"' if m["evenodd"] else ""
    return (
        f'<span class="tile" style="width:{px}px;height:{px}px">'
        f'<svg width="{px}" height="{px}" viewBox="0 0 {f(side)} {f(side)}">'
        f'<path d="{m["path"]}" fill="{PAPER}"{rule} transform="translate({f(dx)} {f(dy)})"/>'
        f"</svg></span>"
    )


def plain_html(m, px):
    scale = px / max(m["w"], m["h"])
    w, h = m["w"] * scale, m["h"] * scale
    rule = ' fill-rule="evenodd"' if m["evenodd"] else ""
    return (
        f'<span class="plain">'
        f'<svg width="{f(w)}" height="{f(h)}" viewBox="0 0 {f(m["w"])} {f(m["h"])}">'
        f'<path d="{m["path"]}" fill="{INK}"{rule}/></svg></span>'
    )


def rows(items, ref=None):
    html = []
    for m in items:
        cls = ' class="row-ref"' if m is ref else ""
        cv = m["counter_vs_stroke"]
        cv_cls = "bad" if cv < 1.0 else "good"
        asc = m["ascender_pct"]
        if asc is None:
            asc_cell = "—"
        else:
            asc_cls = "bad" if asc < 20 else "good"
            asc_cell = f'<span class="{asc_cls}">{asc}%</span>'
        html.append(
            f"<tr{cls}><td class='meta'><b>{m['name']}</b><span>{m['label']}</span></td>"
            f"<td class='num'>{asc_cell}</td>"
            f"<td class='num'><span class='{cv_cls}'>{cv}</span></td>"
            + "".join(f"<td>{tile_html(m, s)}</td>" for s in SIZES)
            + "".join(f"<td>{plain_html(m, s)}</td>" for s in SIZES)
            + "</tr>"
        )
    return "".join(html)


def write_sheet(out):
    head = (
        "<tr><th>variant</th><th>ascender</th><th>counter/<br>stroke</th>"
        + "".join(f"<th>{s}px<br><span style='font-weight:400;color:#999'>กรอบดำ</span></th>" for s in SIZES)
        + "".join(f"<th>{s}px<br><span style='font-weight:400;color:#999'>มาร์คลอย</span></th>" for s in SIZES)
        + "</tr>"
    )
    body = f"""<h1>typedee — logo study</h1>
<p class="note">เกณฑ์ตัดสินอยู่ในสองคอลัมน์ตัวเลขซ้ายมือ และในคอลัมน์ <b>16px</b> ขวาสุด<br>
<b>ascender</b> = stem โผล่เหนือ bowl กี่ % ของความสูงตัว (ต่ำกว่า 20% เริ่มอ่านเป็น a/cl) ·
<b>counter/stroke</b> = ช่องในสูงกี่เท่าของเส้นนอนที่ขนาบมัน (ต่ำกว่า 1.0 = ช่องแพ้เส้น → ตันตอนย่อ)</p>
<div class="warn"><b>สถานะการวัด:</b> แถว <code>ref-round2</code> คือต้นแบบที่เจ้าของส่งมา
<b>สร้างขึ้นใหม่จากค่าที่กะจากภาพในแชท</b> ยังไม่ได้วัดจากไฟล์เวกเตอร์จริง
ใช้ดูทิศทางได้ แต่ห้ามใช้อ้างอิงตัวเลขเป๊ะ ๆ — วางไฟล์ต้นฉบับใน
<code>docs/design/logo/reference/</code> แล้วแก้ค่า <code>REF</code> ใน <code>build.py</code></div>

<h2>ต้นแบบ vs ที่แก้แล้ว — ตัว d ละติน</h2>
<table>{head}{rows([out['ref']] + out['latin'], ref=out['ref'])}</table>
<p class="legend">d1 = แก้ counter อย่างเดียว · d2 = แก้ ascender อย่างเดียว · d3 = แก้ทั้งคู่ ·
d4 = d3 ที่เบาลง · d5 = ปรับให้ทนที่ 16px โดยเฉพาะ (optical size แบบที่ฟอนต์ทำ)</p>

<h2>ด ไทย — มาร์คคู่พี่น้อง</h2>
<p class="note">โครงเดียวกับ d3 ทุกค่า (stem, เส้นนอน, รัศมี) ต่างกันแค่ที่ d เอา "ส่วนเกิน"
ขึ้นบนเป็น ascender ส่วน ด เอาลงล่างเป็นขาที่สะบัดขวา และเปิด counter ด้านล่าง</p>
<table>{head}{rows(out['thai'])}</table>

<h2>ด่านตัดสิน — 16px แรสเตอร์จริง</h2>
<p class="note">SVG ที่ย่อในเบราว์เซอร์ยังถูกลบรอยหยักให้ดูดีกว่าความจริง
ตารางนี้จึงเรนเดอร์ลง canvas ขนาด 16×16 / 20×20 / 24×24 จริง ๆ แล้วขยายกลับมาแบบไม่เกลี่ยสี
= สิ่งที่ favicon เห็นจริงบนแท็บเบราว์เซอร์<br>
<b>ดูว่า counter ยังเป็นรูสีเข้มที่มองเห็นอยู่ไหม</b> ถ้ากลายเป็นก้อนทึบ = ตก</p>
<div id="raster"></div>

<h2>วางคู่ wordmark</h2>
<table><tr><th>มาร์ค</th><th>lockup</th></tr>
{"".join(f"<tr><td>{tile_html(m, 64)}</td><td style='text-align:left'>"
         f"<span style='display:inline-flex;align-items:center;gap:14px'>{tile_html(m, 40)}"
         f"<span class='wm' style='font-size:30px'>typedee</span></span></td></tr>"
         for m in [out['ref']] + out['latin'])}
</table>
<p class="legend">wordmark ยังเป็นตัวเรียงชั่วคราว ไม่ใช่ custom lettering — ใช้ดูสัดส่วนเท่านั้น</p>
"""
    # ข้อมูลสำหรับ raster test — ส่ง SVG ทั้งก้อนไปให้ canvas เรนเดอร์
    raster_data = json.dumps([
        {
            "name": m["name"],
            "tile": svg(m["path"], m["w"], m["h"], PAPER, m["evenodd"], bg=INK, pad=0.24),
            "plain": svg(m["path"], m["w"], m["h"], INK, m["evenodd"]),
            "w": m["w"], "h": m["h"],
        }
        for m in [out["ref"]] + out["latin"] + out["thai"]
    ], ensure_ascii=False)

    html = (
        "<!doctype html><html lang='th'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<title>typedee logo study</title><style>{SHEET_CSS}</style></head>"
        f"<body>{body}<script>const RASTER={raster_data};{RASTER_JS}</script></body></html>"
    )
    with open(os.path.join(HERE, "contact-sheet.html"), "w") as fp:
        fp.write(html)


def main():
    out = {"latin": [], "thai": [], "ref": None}

    def emit(folder, name, label, v, kind):
        if kind == "latin":
            d, w, h = latin_d(v)
            eo = True
        else:
            d, w, h = thai_dee(v)
            eo = False
        base = os.path.join(HERE, folder)
        os.makedirs(base, exist_ok=True)
        with open(os.path.join(base, f"{name}.svg"), "w") as fp:
            fp.write(svg(d, w, h, INK, eo))
        with open(os.path.join(base, f"{name}-tile.svg"), "w") as fp:
            fp.write(svg(d, w, h, PAPER, eo, bg=INK, pad=0.24))
        m = metrics(name, label, v, kind)
        m["path"] = d
        m["w"], m["h"] = round(w, 1), round(h, 1)
        m["evenodd"] = eo
        return m

    out["ref"] = emit("reference", "ref-round2", "ต้นแบบรอบ 2 (สร้างใหม่จากค่าประมาณ)", REF, "latin")
    for name, label, v in LATIN:
        out["latin"].append(emit("d-latin", name, label, v, "latin"))
    for name, label, v in THAI:
        out["thai"].append(emit("d-thai", name, label, v, "thai"))

    with open(os.path.join(HERE, "metrics.json"), "w") as fp:
        json.dump(
            {"ink": INK, "paper": PAPER,
             "note": "ค่า ref มาจากการกะจากภาพในแชท ยังไม่ได้วัดจากไฟล์เวกเตอร์",
             "variants": [out["ref"]] + out["latin"] + out["thai"]},
            fp, ensure_ascii=False, indent=2)

    write_sheet(out)
    return out


if __name__ == "__main__":
    r = main()
    print(f"ref  {r['ref']['name']}")
    for m in r["latin"] + r["thai"]:
        cv = m["counter_vs_stroke"]
        asc = f"asc {m['ascender_pct']}%" if m["ascender_pct"] else "—"
        print(f"  {m['name']:14} {asc:10} counter/stroke {cv}")
