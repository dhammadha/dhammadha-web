import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// เลย์เอาต์กลางของหน้าเอกสาร (Privacy / Terms / Refund / Designer Agreement)
export default function LegalPage({
  title,
  subtitle,
  effectiveDate,
  children,
}: {
  title: string;
  subtitle?: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <div className="bg-bg min-h-[calc(100vh-56px)]">
        <div className="max-w-[720px] mx-auto px-8 py-12">
          <h1 className="text-[28px] font-semibold text-navy mb-1">{title}</h1>
          {subtitle && <p className="text-[14px] text-[#888] mb-1">{subtitle}</p>}
          <p className="text-[12px] text-[#aaa] mb-8">มีผลบังคับใช้: {effectiveDate}</p>
          <div className="bg-white border border-[0.5px] border-border rounded-xl p-8 legal-content">
            {children}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 last:mb-0">
      <h2 className="text-[16px] font-semibold text-navy mb-2.5">{title}</h2>
      <div className="text-[14px] text-[#555] leading-[1.8] flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
