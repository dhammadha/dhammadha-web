"use client";

/**
 * ตะกร้าสินค้า — เก็บ **เฉพาะ font_id** ไว้ใน localStorage
 *
 * จงใจไม่เก็บราคา/ชื่อไว้ในตะกร้า: ราคาจริงคำนวณใหม่ฝั่ง server ทุกครั้งที่กด
 * ชำระเงิน (`handleCheckoutRequest`) ถ้า cache ราคาไว้ ตะกร้าที่ค้างข้ามวันจะโชว์
 * ราคาโปรที่หมดอายุแล้ว แล้วไม่ตรงกับที่ Stripe เก็บจริง
 *
 * ไม่ผูกกับบัญชี (anon ใช้ได้) — ตั้งใจ เพราะตะกร้าไม่ใช่ข้อมูลที่ต้องข้ามเครื่อง
 * ส่วน "รายการโปรด" ที่ต้องข้ามเครื่องมี FavouritesContext แยกอยู่แล้ว
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mergeShopPromos } from "@/lib/shop-promo";

// ⚠️ จงใจ **ไม่** ผูกกับชื่อแบรนด์ใน lib/brand.ts — ถ้าคีย์นี้เปลี่ยนตามชื่อแบรนด์
// การเปลี่ยนชื่อแพลตฟอร์มจะทำให้ตะกร้าของทุกคนที่ค้างอยู่หายทันทีตอน deploy
// (localStorage เดิมยังอยู่ แต่โค้ดอ่านคีย์ใหม่ที่ยังว่าง) คีย์นี้ผู้ใช้ไม่เห็น
//
// **กฎข้างบนยังใช้อยู่** — การเปลี่ยนชื่อแบรนด์ครั้งหน้าห้ามแตะคีย์นี้
//
// รอบ dhammadha → typedee (7 ส.ค. 2569) เป็น**ข้อยกเว้น** เพราะเปลี่ยนโดเมนไปพร้อมกัน:
// localStorage ผูกกับ origin ผู้ใช้ที่ย้ายจาก www.dhammadha.com ไป www.typedee.com
// เจอ origin ใหม่ที่ localStorage ว่างเปล่าอยู่แล้ว → ตะกร้าถูกล้างโดยตัวการย้ายโดเมนเอง
// ไม่ว่าคีย์จะชื่ออะไร ค่าเสียหายที่กฎข้างบนกันไว้จึงถูกจ่ายไปแล้ว เปลี่ยนชื่อไม่เพิ่มอะไร
const STORAGE_KEY = "typedee.cart.v1";
/** ต้องตรงกับ MAX_CART_ITEMS ใน src/lib/checkout-service.ts */
export const CART_LIMIT = 20;

/** ข้อมูลฟอนต์ในตะกร้าเท่าที่ต้องใช้แสดงผล (โหลดจาก DB ทุกครั้งที่ตะกร้าเปลี่ยน) */
export type CartFont = {
  id: string;
  slug: string;
  name: string | null;
  name_th: string | null;
  price: number | null;
  sale_price: number | null;
  sale_end: string | null;
  is_sale: boolean;
  is_free: boolean;
  discount_percent: number | null;
  sale_label: string | null;
  cover_image_url: string | null;
  owner_id: string | null;
  designer_profiles?: { designer_slug?: string | null; business_name?: string | null } | null;
  shop_discount_percent?: number | null;
  shop_sale_end?: string | null;
};

const FONT_SELECT =
  "id, slug, name, name_th, price, sale_price, sale_end, is_sale, is_free, discount_percent, sale_label, cover_image_url, owner_id, designer_profiles!owner_id(designer_slug, business_name)";

interface CartContextValue {
  items: string[];
  count: number;
  ready: boolean;
  /** ฟอนต์ในตะกร้าพร้อมข้อมูลแสดงผล เรียงตามลำดับที่หยิบใส่ (ตัวที่ปิดขายแล้วจะหายไป) */
  fonts: CartFont[];
  loadingFonts: boolean;
  /** เพิ่มขึ้น 1 ทุกครั้งที่หยิบของใส่ตะกร้าสำเร็จ — Nav ใช้เป็นสัญญาณเล่น animation */
  bump: number;
  has: (fontId: string) => boolean;
  /** คืน false เมื่อตะกร้าเต็ม */
  add: (fontId: string) => boolean;
  remove: (fontId: string) => void;
  /** เอาหลายตัวออกพร้อมกัน — ใช้ตอนจ่ายเงินสำเร็จแล้วเคลียร์เฉพาะฟอนต์ในใบนั้น */
  removeMany: (fontIds: string[]) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  count: 0,
  ready: false,
  fonts: [],
  loadingFonts: false,
  bump: 0,
  has: () => false,
  add: () => false,
  remove: () => {},
  removeMany: () => {},
  clear: () => {},
});

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<string[]>([]);
  // ready = อ่าน localStorage แล้ว — กันตัวเลขบนไอคอนตะกร้ากะพริบจาก 0 ตอน hydrate
  const [ready, setReady] = useState(false);
  /**
   * กระจกเงาของ items ไว้ให้ callback อ่านค่าล่าสุดเสมอ — จำเป็นเพราะ
   * `add/remove/removeMany` ถูกเรียกจาก effect ที่ผูก dependency ไว้ตัวอื่น
   * (เช่นหน้า success poll แล้วลบทีละใบ) ถ้าอ่านจาก closure จะเห็นค่าเก่า
   * แล้วการลบหลายตัวติดกันจะทับกันเอง เหลือผลของตัวสุดท้ายตัวเดียว
   */
  const itemsRef = useRef<string[]>([]);

  useEffect(() => {
    const initial = read();
    itemsRef.current = initial;
    setItems(initial);
    setReady(true);
    // แท็บอื่นแก้ตะกร้า → ตามให้ทัน
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const next = read();
        itemsRef.current = next;
        setItems(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: string[]) => {
    itemsRef.current = next;
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // โหมดส่วนตัว/พื้นที่เต็ม — ตะกร้ายังใช้ได้ในหน้านี้ แค่ไม่ค้างข้ามหน้า
    }
  }, []);

  const [bump, setBump] = useState(0);

  const add = useCallback(
    (fontId: string) => {
      const current = itemsRef.current;
      if (current.includes(fontId)) return true;
      if (current.length >= CART_LIMIT) return false;
      persist([...current, fontId]);
      setBump((n) => n + 1);
      return true;
    },
    [persist]
  );

  const remove = useCallback(
    (fontId: string) => persist(itemsRef.current.filter((id) => id !== fontId)),
    [persist]
  );

  const removeMany = useCallback(
    (fontIds: string[]) => {
      if (!fontIds.length) return;
      const next = itemsRef.current.filter((id) => !fontIds.includes(id));
      if (next.length !== itemsRef.current.length) persist(next);
    },
    [persist]
  );

  const clear = useCallback(() => persist([]), [persist]);

  // ข้อมูลฟอนต์สำหรับ submenu ตะกร้าใน Nav และหน้า /cart — โหลดที่เดียวใช้สองที่
  const [fonts, setFonts] = useState<CartFont[]>([]);
  const [loadingFonts, setLoadingFonts] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (items.length === 0) {
      setFonts([]);
      setLoadingFonts(false);
      return;
    }
    let active = true;
    setLoadingFonts(true);
    supabase
      .from("fonts")
      .select(FONT_SELECT)
      .in("id", items)
      .eq("is_active", true)
      .not("published_at", "is", null)
      // ฟอนต์ที่เปลี่ยนเป็น Subscription Exclusive ทีหลังจะหลุดจากตะกร้าเอง
      // (ทางเดียวกับฟอนต์ที่ถูกซ่อน) — checkout ก็กันซ้ำอีกชั้นฝั่ง server
      .eq("is_sub_exclusive", false)
      .then(async ({ data }) => {
        if (!active) return;
        const withPromo = await mergeShopPromos((data ?? []) as unknown as CartFont[]);
        if (!active) return;
        setFonts(items.map((id) => withPromo.find((f) => f.id === id)).filter((f): f is CartFont => !!f));
        setLoadingFonts(false);
      });
    return () => {
      active = false;
    };
  }, [items, ready]);

  return (
    <CartContext.Provider
      value={{
        items,
        count: items.length,
        ready,
        fonts,
        loadingFonts,
        bump,
        has: (fontId) => items.includes(fontId),
        add,
        remove,
        removeMany,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
