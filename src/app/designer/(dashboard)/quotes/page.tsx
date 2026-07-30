"use client";

import OwnQuotes from "@/components/dashboard/OwnQuotes";
import { QuoteSystemGate } from "@/components/designer/SetupGate";

export default function DesignerQuotesPage() {
  return (
    <QuoteSystemGate>
      <OwnQuotes />
    </QuoteSystemGate>
  );
}
