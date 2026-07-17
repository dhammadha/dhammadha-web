"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import FontForm from "@/components/admin/FontForm";
import { AddFontGate } from "@/components/designer/SetupGate";

export default function DesignerAddFontPage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <AddFontGate>
      <FontForm
        mode="page"
        open={true}
        onClose={() => router.push("/designer")}
        editingFont={null}
        onSaved={() => router.push("/designer")}
        ownerId={user?.id}
      />
    </AddFontGate>
  );
}
