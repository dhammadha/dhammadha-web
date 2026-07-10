"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import FontForm from "@/components/admin/FontForm";

export default function DesignerAddFontPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || (role !== "designer" && role !== "admin"))) {
      router.replace(user ? "/" : "/auth/login");
    }
  }, [loading, user, role, router]);

  if (loading || !user || (role !== "designer" && role !== "admin")) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="text-[#aaa] text-[14px]">กำลังโหลด…</span>
      </div>
    );
  }

  return (
    <FontForm
      mode="page"
      open={true}
      onClose={() => router.push("/designer")}
      editingFont={null}
      onSaved={() => router.push("/designer")}
      ownerId={user.id}
      isAdmin={false}
    />
  );
}
