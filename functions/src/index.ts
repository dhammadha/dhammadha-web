import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as opentype from "opentype.js";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

// Thai Unicode block: U+0E00–U+0E7F
const THAI_START = 0x0e00;
const THAI_END = 0x0e7f;
const PUA_START = 0xe000;

function buildShuffledMap(): Record<number, number> {
  const thaiCodes: number[] = [];
  for (let i = THAI_START; i <= THAI_END; i++) thaiCodes.push(i);

  const shuffled = [...thaiCodes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

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

    const q = await db.collection("fonts").where("slug", "==", slug).limit(1).get();
    if (q.empty) throw new HttpsError("not-found", "font not found");
    const snap = q.docs[0];
    const fontData = snap.data();

    const fullFiles: string[] = fontData.full_font_files ?? [];
    if (!fullFiles.length) throw new HttpsError("not-found", "no full_font_files");

    // Prefer TTF, fall back to OTF
    const ttfFiles = fullFiles.filter((u) => u.split("?")[0].toLowerCase().endsWith(".ttf"));
    const otfFiles = fullFiles.filter((u) => u.split("?")[0].toLowerCase().endsWith(".otf"));
    const sourceFiles = ttfFiles.length ? ttfFiles : otfFiles;
    if (!sourceFiles.length) throw new HttpsError("not-found", "no TTF/OTF files found");

    const cpMap = buildShuffledMap();

    // charMap for Firestore: char → PUA char
    const charMap: Record<string, string> = {};
    for (const [from, to] of Object.entries(cpMap)) {
      charMap[String.fromCodePoint(Number(from))] = String.fromCodePoint(to);
    }

    const obfuscatedUrls: string[] = [];

    for (const fileUrl of sourceFiles) {
      const urlPath = decodeURIComponent(fileUrl.split("/o/")[1].split("?")[0]);
      const [fileBuffer] = await storage.file(urlPath).download();

      // Parse font and remap unicodes directly on existing glyphs
      const font = opentype.parse(fileBuffer.buffer as ArrayBuffer);

      for (let i = 0; i < font.glyphs.length; i++) {
        const glyph = font.glyphs.get(i);
        if (glyph.unicodes && glyph.unicodes.length > 0) {
          glyph.unicodes = glyph.unicodes.map((u: number) => cpMap[u] ?? u);
          glyph.unicode = glyph.unicodes[0];
        }
      }

      // Serialize using arrayBuffer() (Node.js compatible, unlike download())
      const obfArrayBuffer: ArrayBuffer = font.toArrayBuffer();
      const obfBuffer = Buffer.from(obfArrayBuffer);

      const origName = urlPath.split("/").pop()!.replace(/\.(ttf|otf)$/i, "");
      const obfPath = `fonts/${slug}/obfuscated/${origName}-obf.ttf`;
      await storage.file(obfPath).save(obfBuffer, { contentType: "font/ttf", public: true });
      const obfUrl = `https://storage.googleapis.com/${storage.name}/${obfPath}`;
      obfuscatedUrls.push(obfUrl);
    }

    await snap.ref.update({
      obfuscated_font_files: obfuscatedUrls,
      obfuscated_map: charMap,
    });

    return { success: true, count: obfuscatedUrls.length };
  }
);
