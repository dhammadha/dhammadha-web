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

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "dhammadha.cart.v1";
/** ต้องตรงกับ MAX_CART_ITEMS ใน src/lib/checkout-service.ts */
export const CART_LIMIT = 20;

interface CartContextValue {
  items: string[];
  count: number;
  ready: boolean;
  has: (fontId: string) => boolean;
  /** คืน false เมื่อตะกร้าเต็ม */
  add: (fontId: string) => boolean;
  remove: (fontId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  count: 0,
  ready: false,
  has: () => false,
  add: () => false,
  remove: () => {},
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

  useEffect(() => {
    setItems(read());
    setReady(true);
    // แท็บอื่นแก้ตะกร้า → ตามให้ทัน
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: string[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // โหมดส่วนตัว/พื้นที่เต็ม — ตะกร้ายังใช้ได้ในหน้านี้ แค่ไม่ค้างข้ามหน้า
    }
  }, []);

  const add = useCallback(
    (fontId: string) => {
      if (items.includes(fontId)) return true;
      if (items.length >= CART_LIMIT) return false;
      persist([...items, fontId]);
      return true;
    },
    [items, persist]
  );

  const remove = useCallback(
    (fontId: string) => persist(items.filter((id) => id !== fontId)),
    [items, persist]
  );

  const clear = useCallback(() => persist([]), [persist]);

  return (
    <CartContext.Provider
      value={{
        items,
        count: items.length,
        ready,
        has: (fontId) => items.includes(fontId),
        add,
        remove,
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
