"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface FavouritesContextValue {
  favourites: Set<string>;
  loading: boolean;
  isFavourite: (fontId: string) => boolean;
  /** สลับสถานะ favourite — คืน true ถ้าสำเร็จ, false ถ้ายังไม่ login (ให้ caller พาไป login) */
  toggle: (fontId: string) => Promise<boolean>;
}

const FavouritesContext = createContext<FavouritesContextValue>({
  favourites: new Set(),
  loading: true,
  isFavourite: () => false,
  toggle: async () => false,
});

export function FavouritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setFavourites(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("favourites")
      .select("font_id")
      .then(({ data }) => {
        if (!active) return;
        setFavourites(new Set((data ?? []).map((r) => r.font_id)));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const isFavourite = useCallback((fontId: string) => favourites.has(fontId), [favourites]);

  const toggle = useCallback(
    async (fontId: string): Promise<boolean> => {
      if (!user) return false;
      const wasFav = favourites.has(fontId);

      // optimistic update
      setFavourites((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(fontId);
        else next.add(fontId);
        return next;
      });

      const { error } = wasFav
        ? await supabase.from("favourites").delete().match({ user_id: user.id, font_id: fontId })
        : await supabase.from("favourites").insert({ user_id: user.id, font_id: fontId });

      // insert ซ้ำ (23505) ถือว่าสำเร็จ — แถวมีอยู่แล้ว
      if (error && !(("code" in error) && (error as { code?: string }).code === "23505")) {
        // rollback ถ้าล้มเหลวจริง
        setFavourites((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(fontId);
          else next.delete(fontId);
          return next;
        });
      }
      return true;
    },
    [user, favourites]
  );

  return (
    <FavouritesContext.Provider value={{ favourites, loading, isFavourite, toggle }}>
      {children}
    </FavouritesContext.Provider>
  );
}

export const useFavourites = () => useContext(FavouritesContext);
