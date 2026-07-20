import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Container from "@/components/ui/Container";

// เลย์เอาต์กลางของหน้าเอกสาร (Privacy / Terms / Refund / Designer Agreement / Agreement)
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
      <section className="bg-white">
        <Container className="pt-10 pb-16">
          <div className="max-w-[720px] mx-auto">
            <h1 className="font-heading text-h1 text-black mb-3">{title}</h1>
            {subtitle && <p className="font-body text-body-sm text-grey-600 mb-2">{subtitle}</p>}
            <p className="font-body text-footnote text-grey-400 mb-12">มีผลบังคับใช้: {effectiveDate}</p>
            <div className="flex flex-col gap-10">{children}</div>
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-h2 text-black mb-4">{title}</h2>
      <div className="font-body text-body text-grey-800 leading-[1.8] flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
