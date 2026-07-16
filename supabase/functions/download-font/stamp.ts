// SFNT name-table stamper — ประทับข้อมูลผู้ซื้อลง name table ของ TTF/OTF
// โดยไม่แตะตารางอื่นเลย (byte-preserving): ไม่แปลง outline, ไม่ re-compile glyph
// ต่างจาก fonteditor-core ที่ parse ทั้งไฟล์และแปลง CFF→glyf ตอนอ่าน OTF
//
// สิ่งที่ทำ:
//   nameID 3  (Unique ID)      → เลข order (ฝังซ้ำอีกชั้น)
//   nameID 13 (License Desc.)  → "Licensed to <ชื่อ> — Order <เลข> — <วันที่> — via dhammadha.com"
//   nameID 14 (License URL)    → ลิงก์ตรวจสอบ /verify?token=<verify_token>
//   ตาราง DSIG (ลายเซ็นดิจิทัล) ถูกถอดทิ้ง — ไฟล์ที่แก้แล้วลายเซ็นเดิมใช้ไม่ได้อยู่แล้ว

export interface Stamp {
  uniqueId: string;
  license: string;
  licenseUrl: string;
}

const STAMPED_NAME_IDS = new Set([3, 13, 14]);

interface TableEntry {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
}

interface NameRecord {
  platformID: number;
  encodingID: number;
  languageID: number;
  nameID: number;
  bytes: Uint8Array;
}

function utf16be(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i * 2] = c >> 8;
    out[i * 2 + 1] = c & 0xff;
  }
  return out;
}

function pad4(n: number): number {
  return (n + 3) & ~3;
}

function tableChecksum(data: Uint8Array): number {
  let sum = 0;
  const padded = pad4(data.length);
  for (let i = 0; i < padded; i += 4) {
    const b0 = data[i] ?? 0, b1 = data[i + 1] ?? 0, b2 = data[i + 2] ?? 0, b3 = data[i + 3] ?? 0;
    sum = (sum + ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3)) >>> 0;
  }
  return sum;
}

/** ประทับ name table — รับ/คืน binary ทั้งไฟล์ รองรับ TTF และ OTF (CFF) */
export function stampFont(data: Uint8Array, stamp: Stamp): Uint8Array {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sfntVersion = dv.getUint32(0);
  // 0x00010000 = TrueType, 'OTTO' = CFF, 'true' = Apple TrueType
  if (sfntVersion !== 0x00010000 && sfntVersion !== 0x4f54544f && sfntVersion !== 0x74727565) {
    throw new Error("not_sfnt");
  }

  const numTables = dv.getUint16(4);
  const tables: TableEntry[] = [];
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    tables.push({
      tag: String.fromCharCode(data[base], data[base + 1], data[base + 2], data[base + 3]),
      checksum: dv.getUint32(base + 4),
      offset: dv.getUint32(base + 8),
      length: dv.getUint32(base + 12),
    });
  }

  const nameEntry = tables.find((t) => t.tag === "name");
  if (!nameEntry) throw new Error("no_name_table");

  // ── parse name table เดิม ──
  const nOff = nameEntry.offset;
  const count = dv.getUint16(nOff + 2);
  const stringOffset = nOff + dv.getUint16(nOff + 4);
  const records: NameRecord[] = [];
  for (let i = 0; i < count; i++) {
    const r = nOff + 6 + i * 12;
    const rec: NameRecord = {
      platformID: dv.getUint16(r),
      encodingID: dv.getUint16(r + 2),
      languageID: dv.getUint16(r + 4),
      nameID: dv.getUint16(r + 6),
      bytes: data.slice(stringOffset + dv.getUint16(r + 10), stringOffset + dv.getUint16(r + 10) + dv.getUint16(r + 8)),
    };
    records.push(rec);
  }

  // ── แทนที่ record ของ nameID 3/13/14 ด้วยของเรา (Windows platform, en-US) ──
  const kept = records.filter((r) => !STAMPED_NAME_IDS.has(r.nameID));
  kept.push(
    { platformID: 3, encodingID: 1, languageID: 0x409, nameID: 3, bytes: utf16be(stamp.uniqueId) },
    { platformID: 3, encodingID: 1, languageID: 0x409, nameID: 13, bytes: utf16be(stamp.license) },
    { platformID: 3, encodingID: 1, languageID: 0x409, nameID: 14, bytes: utf16be(stamp.licenseUrl) },
  );
  kept.sort(
    (a, b) =>
      a.platformID - b.platformID ||
      a.encodingID - b.encodingID ||
      a.languageID - b.languageID ||
      a.nameID - b.nameID,
  );

  // ── serialize name table ใหม่ (format 0) ──
  let strLen = 0;
  for (const r of kept) strLen += r.bytes.length;
  const newName = new Uint8Array(6 + kept.length * 12 + strLen);
  const ndv = new DataView(newName.buffer);
  ndv.setUint16(0, 0);
  ndv.setUint16(2, kept.length);
  ndv.setUint16(4, 6 + kept.length * 12);
  let strPos = 0;
  kept.forEach((r, i) => {
    const base = 6 + i * 12;
    ndv.setUint16(base, r.platformID);
    ndv.setUint16(base + 2, r.encodingID);
    ndv.setUint16(base + 4, r.languageID);
    ndv.setUint16(base + 6, r.nameID);
    ndv.setUint16(base + 8, r.bytes.length);
    ndv.setUint16(base + 10, strPos);
    newName.set(r.bytes, 6 + kept.length * 12 + strPos);
    strPos += r.bytes.length;
  });

  // ── ประกอบไฟล์ใหม่: ตารางเดิม byte-identical, name ใหม่, ถอด DSIG ──
  const outTables = tables.filter((t) => t.tag !== "DSIG");
  const headerSize = 12 + outTables.length * 16;

  // เรียง data ตาม offset เดิม; directory เรียงตาม tag (ตามสเปก)
  const dataOrder = [...outTables].sort((a, b) => a.offset - b.offset);
  let pos = pad4(headerSize);
  const newOffsets = new Map<string, number>();
  const newLengths = new Map<string, number>();
  const newChecksums = new Map<string, number>();
  for (const t of dataOrder) {
    const bytes = t.tag === "name" ? newName : data.subarray(t.offset, t.offset + t.length);
    newOffsets.set(t.tag, pos);
    newLengths.set(t.tag, bytes.length);
    newChecksums.set(t.tag, t.tag === "name" ? tableChecksum(newName) : t.checksum);
    pos += pad4(bytes.length);
  }

  const out = new Uint8Array(pos);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, sfntVersion);
  odv.setUint16(4, outTables.length);
  const log2 = Math.floor(Math.log2(outTables.length));
  odv.setUint16(6, 16 * 2 ** log2);
  odv.setUint16(8, log2);
  odv.setUint16(10, outTables.length * 16 - 16 * 2 ** log2);

  const dirOrder = [...outTables].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  dirOrder.forEach((t, i) => {
    const base = 12 + i * 16;
    for (let c = 0; c < 4; c++) out[base + c] = t.tag.charCodeAt(c);
    odv.setUint32(base + 4, newChecksums.get(t.tag)!);
    odv.setUint32(base + 8, newOffsets.get(t.tag)!);
    odv.setUint32(base + 12, newLengths.get(t.tag)!);
  });

  for (const t of dataOrder) {
    const bytes = t.tag === "name" ? newName : data.subarray(t.offset, t.offset + t.length);
    out.set(bytes, newOffsets.get(t.tag)!);
  }

  // ── head.checkSumAdjustment = 0xB1B0AFBA - checksum(ทั้งไฟล์ โดย field นี้เป็น 0) ──
  const headOffset = newOffsets.get("head");
  if (headOffset !== undefined) {
    odv.setUint32(headOffset + 8, 0);
    const whole = tableChecksum(out);
    odv.setUint32(headOffset + 8, (0xb1b0afba - whole) >>> 0);
  }

  return out;
}
