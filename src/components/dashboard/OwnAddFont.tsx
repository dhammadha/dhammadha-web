"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import FontForm from "@/components/admin/FontForm";
import { AddFontGate } from "@/components/designer/SetupGate";

// หน้า "เพิ่มฟอนต์" ใช้ร่วมกันระหว่าง /designer และ /admin
// gate: designer ต้องตั้ง slug ก่อนถึงจะเพิ่มฟอนต์ได้ — admin ข้ามได้
export default function OwnAddFont({ basePath, gate = true }: {
  basePath: "/designer" | "/admin";
  gate?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();

  const form = (
    <FontForm
      mode="page"
      open={true}
      onClose={() => router.push(basePath)}
      editingFont={null}
      onSaved={() => router.push(basePath)}
      ownerId={user?.id}
    />
  );

  return gate ? <AddFontGate>{form}</AddFontGate> : form;
}
