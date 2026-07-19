"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Font } from "@/components/FontCard";
import FontGrid from "@/components/FontGrid";
import CoverCarousel, { type Slide } from "@/components/CoverCarousel";
import AdBanner from "@/components/AdBanner";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Container from "@/components/ui/Container";
import Modal from "@/components/ui/Modal";
import TypeTester from "./TypeTester";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";
import { trackFontView, trackFreeDownload } from "@/lib/track";
import { parseLicenseSettings, parseDesignerTiers, type LicenseTier } from "@/lib/license";

function parseWeight(url: string): string {
  const decoded = decodeURIComponent(url.split("?")[0]);
  const filename = decoded.split("/").pop() || "";
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : "Regular";
}

const WEIGHT_MAP: Record<string, number> = {
  thin: 100, extralight: 200, ultralight: 200, light: 300,
  regular: 400, normal: 400, medium: 500, semibold: 600,
  demibold: 600, bold: 700, extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900,
};

function weightToCss(name: string): number {
  return WEIGHT_MAP[name.toLowerCase()] ?? 400;
}

function getUniqueWeights(urls: string[]): string[] {
  const unique = [...new Set(urls.map(parseWeight))];
  return unique.sort((a, b) => weightToCss(a) - weightToCss(b));
}

function getFormats(urls: string[]): string {
  const exts = new Set(
    urls
      .map((u) => {
        const decoded = decodeURIComponent(u.split("?")[0]);
        return decoded.split("/").pop()?.split(".").pop()?.toUpperCase();
      })
      .filter((e): e is string => !!e && e !== "ZIP")
  );
  return [...exts].join(", ") || "—";
}

// แถบเมนู 3 หัวข้อ (moodboard: font detail.png) — สลับเนื้อหาในที่เดิม ไม่เปลี่ยน route
type Tab = "detail" | "tester" | "buy";
const TABS: { id: Tab; label: string }[] = [
  { id: "detail", label: "รายละเอียด" },
  { id: "tester", label: "พิมพ์ทดสอบ" },
  { id: "buy", label: "สั่งซื้อฟอนต์ / ขอใบเสนอราคา" },
];

export default function FontDetail({ initialFont }: { initialFont?: Font | null }) {
  const { user } = useAuth();
  const router = useRouter();
  const { isFavourite, toggle } = useFavourites();
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [font, setFont] = useState<Font | null>(initialFont ?? null);
  const [related, setRelated] = useState<Font[]>([]);
  const [loading, setLoading] = useState(!initialFont);
  const [defaultTiers, setDefaultTiers] = useState<LicenseTier[]>(() => parseLicenseSettings(null));
  const [customLicenseTiers, setCustomLicenseTiers] = useState<LicenseTier[] | null>(null);
  const [promotion, setPromotion] = useState<{ discount_percent: number; sale_end: string; active: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("detail");
  const [specimenOpen, setSpecimenOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");

  useEffect(() => {
    if (!slug) return;
    async function load() {
      // Flatten nested users join into font object
      // embed ผ่าน view designer_profiles ไม่ใช่ users — ตั้งแต่ 0054 anon อ่าน users ไม่ได้แล้ว
      // (bank/tax_id อยู่ในนั้น) ถ้า embed users ทั้ง query จะ 401 ทำให้ related fonts หายและ
      // client-side nav หาฟอนต์ไม่เจอ
      type RawFont = { designer_profiles?: { designer_slug?: string; business_name?: string } | null } & Record<string, unknown>;
      const flattenFont = (r: RawFont): Font => ({ ...(r as unknown as Font), designer_slug: r.designer_profiles?.designer_slug ?? undefined, designer_business_name: r.designer_profiles?.business_name ?? undefined });

      try {
        // If initialFont was not provided (client-side nav), fetch the font too
        const fontPromise = initialFont
          ? Promise.resolve({ data: null })
          : supabase.from("fonts").select("*, designer_profiles!owner_id(designer_slug, business_name)").eq("slug", slug).eq("is_active", true).not("published_at", "is", null).limit(1);

        const [fontResult, { data: allRows }, { data: settings }] = await Promise.all([
          fontPromise,
          supabase.from("fonts").select("*, designer_profiles!owner_id(designer_slug, business_name)").eq("is_active", true).not("published_at", "is", null),
          supabase.from("settings").select("key, value").in("key", ["licensing", "promotion"]),
        ]);

        let currentFont = initialFont ?? null;
        if (!initialFont) {
          const fontRows = (fontResult as { data: unknown[] | null }).data;
          if (!fontRows?.length) { setLoading(false); return; }
          currentFont = flattenFont(fontRows[0] as unknown as RawFont);
          setFont(currentFont);
        }

        const others = ((allRows ?? []) as unknown as RawFont[]).map(flattenFont).filter((f) => f.slug !== slug);
        setRelated([...others].sort(() => Math.random() - 0.5).slice(0, 4));

        for (const row of (settings ?? []) as { key: string; value: Record<string, unknown> }[]) {
          const v = row.value;
          if (row.key === "licensing") {
            setDefaultTiers(parseLicenseSettings(v));
          } else if (row.key === "promotion") {
            setPromotion({ discount_percent: (v.discount_percent as number) ?? 0, sale_end: (v.sale_end as string) ?? "", active: !!(v.active) });
          }
        }

        const ownerId = (currentFont as unknown as { owner_id?: string })?.owner_id;
        if (ownerId) {
          const { data: licConfig } = await supabase
            .from("designer_license_config")
            .select("use_default, tiers")
            .eq("designer_id", ownerId)
            .single();
          if (licConfig && !licConfig.use_default) {
            const parsed = parseDesignerTiers(licConfig.tiers);
            if (parsed.length > 0) setCustomLicenseTiers(parsed);
          }
        }
      } catch {
        // โหลดข้อมูลเสริมไม่สำเร็จ — หน้าเพจยังแสดงจาก initialFont ได้
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!font?.id) return;
    trackFontView(font.id);
  }, [font?.id]);

  // Global promotion — applies when font has no individual sale
  const activePromo = (() => {
    if (!promotion?.active || !promotion.discount_percent) return null;
    if (promotion.sale_end) {
      const [d, m, y] = promotion.sale_end.split("/").map(Number);
      const end = new Date(y, m - 1, d, 23, 59, 59);
      if (Date.now() > end.getTime()) return null;
    }
    return promotion;
  })();

  // ซื้อฟอนต์ (สิทธิ์บุคคลทั่วไป) — สร้าง Stripe Checkout Session ฝั่ง server
  // แล้วพาไปหน้าจ่ายเงิน ราคาคำนวณจาก DB ที่ server ไม่ได้ส่งจาก client
  async function handleBuy() {
    if (!font || buying) return;
    setBuying(true);
    setBuyError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          font_id: font.id,
          cancel_path: `/fonts/${font.designer_slug ?? ""}/${font.slug}/`,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
        return; // คง loading ไว้ระหว่าง browser พาไป Stripe
      }
      setBuyError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } catch {
      setBuyError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    setBuying(false);
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="font-body text-body text-grey-600">กำลังโหลด...</div>
        </div>
        <Footer />
      </>
    );
  }

  if (!font) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
          <div className="font-heading text-h2 text-black">ไม่พบฟอนต์นี้</div>
          <Link href="/" className="font-body text-body text-mint-text no-underline hover:underline">
            ← กลับหน้าแรก
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  // น้ำหนัก / สไตล์ / Font Format มาจากคอลัมน์ที่ FontForm คำนวณจากไฟล์ Full Family
  // ตอนบันทึก (ดู src/lib/font-meta.ts + migration 0060) — หน้านี้เป็นหน้าสาธารณะ
  // จึงอ่าน font_files_private เองไม่ได้ และไฟล์ demo ก็ไม่ได้สะท้อนของที่ลูกค้าซื้อ
  // (demo ที่ระบบ gen ให้มีไฟล์เดียว → เคยทำให้ Font Format โชว์แค่ OTF ทั้งที่ขาย OTF+TTF)
  //
  // fallback ไปคำนวณจากไฟล์ demo/free เฉพาะฟอนต์เก่าที่ยังไม่มีคอลัมน์ใหม่
  const infoFiles = font.is_free ? font.free_font_files || [] : font.demo_font_files || [];
  const formats = font.formats?.length ? font.formats.join(", ") : getFormats(infoFiles);
  const weightTotal = font.weight_count || getUniqueWeights(infoFiles).length;
  const styleCount = font.style_count || weightTotal;

  const mainTitle = font.name_th || font.name || "—";
  const subTitle = font.name_th ? font.name : undefined;
  const designerName = font.designer_business_name || font.designer_name || "ธรรมดาสตูดิโอ";

  // สไลด์ full-bleed — cover + preview ของฟอนต์ตัวนี้ ไม่ลิงก์ไปไหน (อยู่หน้าฟอนต์นี้อยู่แล้ว)
  const slides: Slide[] = [font.cover_image_url, ...(font.preview_images || [])]
    .filter((u): u is string => !!u)
    .map((src, i) => ({ key: `${font.id}-${i}`, src, alt: `${font.name ?? ""} ${i + 1}` }));

  const designerLine = (
    <p className="font-body text-body-sm text-grey-600">
      ออกแบบโดย{" "}
      {font.designer_slug ? (
        <Link href={`/designer/${font.designer_slug}`} className="font-ui text-ui text-mint-text no-underline hover:underline">
          {designerName}
        </Link>
      ) : (
        <span className="font-ui text-ui text-black">{designerName}</span>
      )}
    </p>
  );

  // หัวเรื่องในแท็บ — เจ้าของสั่งให้โชว์ทุกแท็บ (ตาม moodboard)
  const tabHeading = (
    <div className="mb-6">
      <h2 className="font-heading text-h1 text-black leading-none">{mainTitle}</h2>
      {subTitle && <div className="font-heading text-h2 text-black leading-none mt-1.5">{subTitle}</div>}
      <div className="mt-2">{designerLine}</div>
    </div>
  );

  const specRows: [string, string][] = [
    ["น้ำหนัก", weightTotal ? `${weightTotal} weights` : "—"],
    ["สไตล์", styleCount ? `${styleCount} styles` : "—"],
    ["Font Format", formats],
  ];

  // การ์ดราคา tier องค์กร — markup เดียวกันทั้ง custom/default (§8 ปล่อยซ้ำต่อ ไม่ยกเป็น component)
  const orgTiers = customLicenseTiers ?? defaultTiers;

  return (
    <>
      <Nav />
      <div className="bg-white min-h-screen">

        {/* หัวเรื่องหน้า — ชื่อฟอนต์ + หัวใจ (เห็นตลอด ไม่ขึ้นกับแท็บ) */}
        <Container className="pt-10 pb-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-font-slug text-black leading-none min-w-0">{mainTitle}</h1>

            {/* บันทึกไว้ดูภายหลัง — เหลือแค่ไอคอนเพราะพื้นที่ข้างชื่อฟอนต์จำกัด
                ข้อความเดิมย้ายไปอยู่ใน aria-label/title แทน */}
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  router.push(`/auth/login?next=${encodeURIComponent(`/fonts/${font.designer_slug ?? ""}/${font.slug}/`)}`);
                  return;
                }
                toggle(font.id);
              }}
              aria-pressed={isFavourite(font.id)}
              aria-label={isFavourite(font.id) ? "บันทึกแล้ว" : "บันทึกไว้ดูภายหลัง"}
              title={isFavourite(font.id) ? "บันทึกแล้ว" : "บันทึกไว้ดูภายหลัง"}
              className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-surface text-black hover:text-mint-text cursor-pointer border-none transition-colors duration-150 ease-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <svg viewBox="0 0 24 24" fill={isFavourite(font.id) ? "#5ECEC8" : "none"} stroke={isFavourite(font.id) ? "#5ECEC8" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
          <div className="mt-2">{designerLine}</div>
        </Container>

        {/* สไลด์ full-bleed — วางนอก Container เพื่อให้ peek ทะลุขอบจอ (§13.2) */}
        <CoverCarousel slides={slides} />

        <Container className="pt-5 pb-10">

          {/* แถบเมนู 3 หัวข้อ */}
          <div role="tablist" aria-label="ข้อมูลฟอนต์" className="grid grid-cols-3 gap-px bg-white mb-8">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-center text-center font-ui text-ui px-2 py-3 border-none cursor-pointer transition-colors duration-150 ease-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                  tab === t.id ? "bg-mint text-black" : "bg-surface text-black hover:bg-mint"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* แท็บที่ไม่ active ไม่ render — TypeTester ยิง Edge Function ตอน mount
              ถ้าปล่อยไว้จะยิงทุกครั้งที่เปิดหน้า ทั้งที่ผู้ใช้ยังไม่ได้กดดู */}
          {tab === "detail" && (
            <div role="tabpanel" id="panel-detail" aria-labelledby="tab-detail">
              {tabHeading}

              <div className="flex flex-col gap-px mb-6 max-w-lg">
                {specRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 bg-surface px-4 py-2.5">
                    <span className="font-body text-body-sm text-grey-600">{label}</span>
                    <span className="font-ui text-ui text-black text-right">{value}</span>
                  </div>
                ))}
              </div>

              {font.description_th && (
                <p className="font-body text-body text-black whitespace-pre-line mb-6">
                  {font.description_th}
                </p>
              )}

              {font.tags && font.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {font.tags.map((tag) => (
                    <Badge key={tag} variant="tag">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "tester" && (
            <div role="tabpanel" id="panel-tester" aria-labelledby="tab-tester">
              {tabHeading}
              <TypeTester font={font} />
              {font.specimen_files && font.specimen_files.length > 0 && (
                <Button variant="outline" size="lg" className="mt-5" onClick={() => setSpecimenOpen(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  ดูตัวอย่างฟอนต์เพิ่มเติม
                </Button>
              )}
            </div>
          )}

          {tab === "buy" && (
            <div role="tabpanel" id="panel-buy" aria-labelledby="tab-buy">
              {tabHeading}

              <div className="flex flex-col gap-8 max-w-2xl">

                {/* Personal tier */}
                <div>
                  <h3 className="font-heading text-h2 text-black mb-3">บุคคลทั่วไป</h3>
                  <div className="bg-surface px-4 py-3 mb-3">
                    <div className="flex justify-between items-center gap-3">
                      <span className="font-body text-body text-black">
                        ผู้ใช้งานทั่วไป นิสิต นักศึกษา นักออกแบบอิสระ
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {font.is_free ? (
                          <span className="font-ui text-ui text-success">ฟรี</span>
                        ) : font.is_sale ? (
                          <>
                            <Badge variant="sale">-{font.discount_percent ?? 0}%</Badge>
                            <span className="font-body text-body-sm text-grey-400 line-through">
                              ฿{(font.price ?? 0).toLocaleString()}
                            </span>
                            <span className="font-ui text-ui text-success">
                              ฿{(font.sale_price ?? 0).toLocaleString()}
                            </span>
                          </>
                        ) : font.price && activePromo ? (
                          <>
                            <Badge variant="sale">-{activePromo.discount_percent}%</Badge>
                            <span className="font-body text-body-sm text-grey-400 line-through">
                              ฿{font.price.toLocaleString()}
                            </span>
                            <span className="font-ui text-ui text-success">
                              ฿{Math.round(font.price * (1 - activePromo.discount_percent / 100)).toLocaleString()}
                            </span>
                          </>
                        ) : font.price ? (
                          <span className="font-ui text-ui text-black">
                            ฿{font.price.toLocaleString()}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  {font.is_free ? (
                    user ? (
                      <Button as="a" href={font.free_font_files?.[0] || "#"} external size="lg" className="w-full" onClick={() => trackFreeDownload(font.id)}>
                        ดาวน์โหลดฟรี
                      </Button>
                    ) : (
                      <div>
                        <Button
                          as="link"
                          href={`/auth/login/?next=${encodeURIComponent(`/fonts/${font.designer_slug ?? ""}/${font.slug}/`)}`}
                          size="lg"
                          className="w-full"
                        >
                          เข้าสู่ระบบเพื่อดาวน์โหลดฟรี
                        </Button>
                        <p className="font-body text-body-sm text-grey-600 text-center mt-2">
                          สมัครสมาชิกฟรี ใช้เวลาไม่ถึงนาที
                        </p>
                      </div>
                    )
                  ) : (
                    <div>
                      <Button
                        size="lg"
                        className="w-full"
                        disabled={!font.price || buying}
                        onClick={handleBuy}
                      >
                        {buying ? "กำลังไปหน้าชำระเงิน..." : "ซื้อฟอนต์นี้"}
                      </Button>
                      {buyError && (
                        <p className="font-body text-body-sm text-danger text-center mt-2">{buyError}</p>
                      )}
                      <p className="font-body text-body-sm text-grey-600 text-center mt-2">
                        ชำระผ่าน PromptPay หรือบัตรเครดิต — ดาวน์โหลดได้ทันที
                      </p>
                    </div>
                  )}

                  {font.demo_font_files && font.demo_font_files.length > 0 && (
                    <Button as="a" href={font.demo_font_files[0]} external variant="outline" size="lg" className="w-full mt-3">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      ดาวน์โหลด Demo ฟรี
                    </Button>
                  )}
                </div>

                {font.is_subscription && (
                  <div className="bg-surface px-4 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-ui text-ui text-black mb-1">รวมอยู่ใน Subscription</div>
                      <div className="font-body text-body-sm text-grey-600">
                        เข้าถึงฟอนต์ทุกตัวด้วยแพลนรายเดือน
                      </div>
                    </div>
                    <Button as="link" href="/subscribe/" size="sm">ดูแผนบริการ</Button>
                  </div>
                )}

                {/* Org tiers */}
                <div>
                  <h3 className="font-heading text-h2 text-black mb-3">ห้างร้าน องค์กร บริษัท</h3>
                  <div className="flex flex-col gap-px mb-3">
                    {orgTiers.map((tier) => (
                      <div key={tier.id} className="bg-surface px-4 py-3">
                        <div className="flex justify-between items-center gap-3">
                          <span className="font-body text-body text-black">{tier.name}</span>
                          <span className="font-ui text-ui text-black shrink-0">฿{tier.price.toLocaleString()}</span>
                        </div>
                        {tier.desc && (
                          <div className="font-body text-body-sm text-grey-600 mt-1">{tier.desc}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="font-body text-body-sm text-grey-600 mb-3">
                    ดูรายละเอียด{" "}
                    <Link href="/agreement/" className="text-mint-text no-underline hover:underline">สัญญาอนุญาต</Link>
                  </p>
                  <Button
                    as="link"
                    href={`/quote/?font=${font.slug}&designer_slug=${font.designer_slug ?? ""}`}
                    size="lg"
                    className="w-full"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    ขอใบเสนอราคา
                  </Button>
                </div>

              </div>
            </div>
          )}

          {/* ท้ายหน้า — อยู่นอกระบบแท็บ เห็นตลอด */}
          {related.length > 0 && (
            <div className="mt-12">
              <AdBanner slot="1401819374" className="-mx-4 md:-mx-6 lg:-mx-8 mb-8" />
              <h2 className="font-heading text-h2 text-black mb-4">ฟอนต์ที่คุณน่าจะสนใจ</h2>
              <FontGrid fonts={related} />
            </div>
          )}

        </Container>
      </div>

      {/* SPECIMEN LIGHTBOX */}
      <Modal
        open={specimenOpen}
        onClose={() => setSpecimenOpen(false)}
        title="ตัวอย่างฟอนต์เพิ่มเติม"
        className="w-[80vw] max-w-[1100px] h-[90vh]"
      >
        {/* Modal เป็น flex-col + overflow-hidden — ตัวเนื้อหาต้องขอ scroll เอง */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {font.specimen_files?.map((url, i) => (
            <iframe
              key={i}
              src={url}
              title={`Specimen ${i + 1}`}
              className="w-full"
              style={{ height: "75vh" }}
            />
          ))}
        </div>
      </Modal>

      <Footer />
    </>
  );
}
