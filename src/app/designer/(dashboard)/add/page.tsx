"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import FontForm from "@/components/admin/FontForm";

export default function DesignerAddFontPage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <FontForm
      mode="page"
      open={true}
      onClose={() => router.push("/designer")}
      editingFont={null}
      onSaved={() => router.push("/designer")}
      ownerId={user?.id}
      isAdmin={false}
    />
  );
}
