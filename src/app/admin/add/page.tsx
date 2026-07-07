"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import FontSlidePanel from "@/components/admin/FontSlidePanel";

export default function AdminAddFontPage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <FontSlidePanel
      mode="page"
      open={true}
      onClose={() => router.push("/admin")}
      editingFont={null}
      onSaved={() => router.push("/admin")}
      ownerId={user?.id}
      isAdmin
    />
  );
}
