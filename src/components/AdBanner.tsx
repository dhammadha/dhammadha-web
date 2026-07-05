"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface Props {
  slot: string;
  className?: string;
}

export default function AdBanner({ slot, className = "" }: Props) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div className={`bg-[#ebe9e4] border-y border-[#e0ddd6] ${className}`}>
      <div className="max-w-site mx-auto px-8 py-2.5 flex items-center justify-center gap-2.5">
        <span className="text-[9px] text-[#bbb] tracking-[0.07em] uppercase shrink-0">ADS</span>
        <div className="flex-1 max-w-[728px] flex justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-4457591147215902"
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </div>
  );
}
