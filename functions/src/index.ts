import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as opentype from "opentype.js";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

// Thai Unicode block: U+0E00–U+0E7F
const THAI_START = 0x0e00;
const THAI_END = 0x0e7f;
// Private Use Area for remapped glyphs
const PUA_START = 0xe000;

function buildShuffledMap(): Record<number, number> {
  const thaiCodes: number[] = [];
  for (let i = THAI_START; i <= THAI_END; i++) thaiCodes.push(i);

  // Fisher-Yates shuffle
  const shuffled = [...thaiCodes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // map: original codepoint → PUA codepoint
  const map: Record<number, number> = {};
  for (let i = 0; i < thaiCodes.length; i++) {
    map[thaiCodes[i]] = PUA_START + shuffled[i] - THAI_START;
  }
  return map;
}

export const obfuscateFont = onCall(
  { timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const { slug } = request.data as { slug: string };
    if (!slug) throw new HttpsError("invalid-argument", "slug required");

    const db = admin.firestore();
    const storage = admin.storage().bucket();

    // Load font doc
    const snap = await db.collection("fonts").doc(slug).get();
    if (!snap.exists) throw new HttpsError("not-found", "font not found");
    const fontData = snap.data()!;

    const fullFiles: string[] = fontData.full_font_files ?? [];
    if (!fullFiles.length) throw new HttpsError("not-found", "no full_font_files");

    // Pick TTF files first, fall back to OTF
    const ttfFiles = fullFiles.filter((u) => u.split("?")[0].toLowerCase().endsWith(".ttf"));
    const otfFiles = fullFiles.filter((u) => u.split("?")[0].toLowerCase().endsWith(".otf"));
    const sourceFiles = ttfFiles.length ? ttfFiles : otfFiles;
    if (!sourceFiles.length) throw new HttpsError("not-found", "no TTF/OTF files found");

    // Build one shared map for all weights
    const cpMap = buildShuffledMap();
    // Save as string-keyed map for Firestore (char → PUA char)
    const charMap: Record<string, string> = {};
    for (const [from, to] of Object.entries(cpMap)) {
      charMap[String.fromCodePoint(Number(from))] = String.fromCodePoint(to);
    }

    const obfuscatedUrls: string[] = [];

    for (const fileUrl of sourceFiles) {
      // Extract storage path from download URL
      const urlPath = decodeURIComponent(fileUrl.split("/o/")[1].split("?")[0]);

      // Download file buffer
      const [fileBuffer] = await storage.file(urlPath).download();

      // Parse font
      const font = opentype.parse(fileBuffer.buffer as ArrayBuffer);

      // Remap codepoints in cmap
      const newGlyphs: opentype.Glyph[] = [];
      for (let i = 0; i < font.glyphs.length; i++) {
        const glyph = font.glyphs.get(i);
        const newGlyph = new opentype.Glyph({
          name: glyph.name ?? undefined,
          unicode: glyph.unicode !== undefined && cpMap[glyph.unicode] !== undefined
            ? cpMap[glyph.unicode]
            : glyph.unicode,
          unicodes: glyph.unicodes.map((u: number) => cpMap[u] ?? u),
          advanceWidth: glyph.advanceWidth,
          path: glyph.path,
        });
        newGlyphs.push(newGlyph);
      }

      const obfFont = new opentype.Font({
        familyName: font.names.fontFamily?.en ?? "Preview",
        styleName: font.names.fontSubfamily?.en ?? "Regular",
        unitsPerEm: font.unitsPerEm,
        ascender: font.ascender,
        descender: font.descender,
        glyphs: newGlyphs,
      });

      // Write to buffer
      const obfBuffer = Buffer.from(obfFont.download() as unknown as ArrayBuffer);

      // Save to storage: fonts/{slug}/obfuscated/{filename}-obf.ttf
      const origName = urlPath.split("/").pop()!.replace(/\.(ttf|otf)$/i, "");
      const obfPath = `fonts/${slug}/obfuscated/${origName}-obf.ttf`;
      const file = storage.file(obfPath);
      await file.save(obfBuffer, { contentType: "font/ttf", public: true });
      const obfUrl = `https://storage.googleapis.com/${storage.name}/${obfPath}`;
      obfuscatedUrls.push(obfUrl);
    }

    // Save urls + map to Firestore
    await db.collection("fonts").doc(slug).update({
      obfuscated_font_files: obfuscatedUrls,
      obfuscated_map: charMap,
    });

    return { success: true, count: obfuscatedUrls.length };
  }
);
