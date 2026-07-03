import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Nav />
      <div className="min-h-[calc(100vh-112px)] flex items-center justify-center bg-bg px-8 py-16">
        <div className="text-center">
          <div className="text-[80px] font-semibold text-navy leading-none mb-4">404</div>
          <div className="text-[18px] text-[#666] mb-8">ไม่พบหน้าที่คุณต้องการ</div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#888] no-underline hover:text-navy transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            กลับหน้าแรก
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
