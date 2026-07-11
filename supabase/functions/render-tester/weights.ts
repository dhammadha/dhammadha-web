// การตีความ weight จากชื่อไฟล์ — convention เดียวกับฝั่งเว็บ (FontDetail):
// segment สุดท้ายหลัง "-" ของชื่อไฟล์ (ตัดนามสกุลออก) คือ weight, ไม่มีถือเป็น regular

export const WEIGHT_CSS: Record<string, number> = {
  thin: 100, extralight: 200, ultralight: 200, light: 300,
  regular: 400, normal: 400, medium: 500, semibold: 600,
  demibold: 600, bold: 700, extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900,
};

const WEIGHT_LABEL: Record<string, string> = {
  thin: "Thin", extralight: "ExtraLight", ultralight: "UltraLight", light: "Light",
  regular: "Regular", normal: "Regular", medium: "Medium", semibold: "SemiBold",
  demibold: "DemiBold", bold: "Bold", extrabold: "ExtraBold", ultrabold: "UltraBold",
  black: "Black", heavy: "Heavy", italic: "Italic",
};

export function parseWeightId(pathOrUrl: string): string {
  const decoded = decodeURIComponent(pathOrUrl.split("?")[0]);
  const filename = decoded.split("/").pop() || "";
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split("-");
  return (parts.length > 1 ? parts[parts.length - 1] : "regular").toLowerCase();
}

export function weightLabel(id: string): string {
  return WEIGHT_LABEL[id] ?? (id.charAt(0).toUpperCase() + id.slice(1));
}

export function weightCss(id: string): number {
  return WEIGHT_CSS[id] ?? 400;
}
