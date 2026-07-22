"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  designer_slug: string | null;
  portfolio_url: string | null;
  designer_application_status: "pending" | "approved" | "rejected" | null;
  created_at: string;
};

type Tab = "applications" | "designers";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function AdminDesignersPage() {
  const [tab, setTab] = useState<Tab>("applications");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, name, email, role, designer_slug, portfolio_url, designer_application_status, created_at")
      .order("created_at", { ascending: false });
    setUsers((data as UserRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const applications = users.filter((u) => u.designer_application_status === "pending");
  const designers = users.filter((u) => u.role === "designer" || u.role === "admin");

  const promote = async (u: UserRow) => {
    await supabase.from("users").update({
      role: "designer",
      designer_application_status: "approved",
    } as never).eq("id", u.id);

    // Recipient is resolved server-side from user_id; the endpoint verifies
    // the caller's admin role from the Supabase access token.
    let emailOk = true;
    if (u.email) {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ type: "promote", payload: { user_id: u.id } }),
      }).catch(() => null);
      emailOk = !!res?.ok;
    }

    showToast(
      emailOk
        ? `✓ Promote ${u.name ?? u.email} เป็น designer แล้ว`
        : `✓ Promote สำเร็จ แต่ส่งอีเมลแจ้ง designer ไม่สำเร็จ`
    );
    setSelected(null);
    loadUsers();
  };

  const reject = async (u: UserRow) => {
    if (!confirm(`ปฏิเสธคำขอของ "${u.name ?? u.email}"?`)) return;
    await supabase.from("users").update({
      designer_application_status: "rejected",
    } as never).eq("id", u.id);
    showToast("ปฏิเสธคำขอแล้ว");
    setSelected(null);
    loadUsers();
  };

  const demote = async (u: UserRow) => {
    if (!confirm(`เปลี่ยน "${u.name ?? u.email}" กลับเป็น customer?`)) return;
    await supabase.from("users").update({ role: "customer" } as never).eq("id", u.id);
    showToast("เปลี่ยน role แล้ว");
    setSelected(null);
    loadUsers();
  };

  const promoteExisting = async (u: UserRow) => {
    await supabase.from("users").update({ role: "designer" } as never).eq("id", u.id);
    showToast(`✓ Promote ${u.name ?? u.email} เป็น designer แล้ว`);
    setSelected(null);
    loadUsers();
  };

  const list = tab === "applications" ? applications : designers;

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-h2 text-black">Designers</h1>
          {applications.length > 0 && (
            <p className="font-body text-body-sm text-warning mt-0.5">
              ⚠️ {applications.length} คำขอรอพิจารณา
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 w-fit">
        {(["applications", "designers"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelected(null); }}
            className={`px-4 py-2 font-ui text-ui border-none cursor-pointer transition-colors duration-150 ease-base ${
              tab === t ? "bg-mint text-black" : "bg-surface text-grey-600 hover:bg-grey-200"
            }`}
          >
            {t === "applications" ? "คำขอสมัคร" : "Designers"}
            {t === "applications" && applications.length > 0 && (
              <span className="ml-1.5 text-badge font-heading px-1.5 py-0.5 bg-danger text-white leading-none">
                {applications.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* List */}
        <div className="flex-1 bg-surface overflow-hidden">
          {tab === "applications" && (
            <div className="grid grid-cols-[100px_1fr_1.5fr_80px] gap-3 px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]">
              <div>วันที่</div><div>ชื่อ</div><div>อีเมล</div><div>สถานะ</div>
            </div>
          )}

          {tab === "designers" && (
            <div className="grid grid-cols-[100px_1fr_1fr_120px_80px] gap-3 px-4 py-2.5 bg-white font-heading text-badge text-grey-600 tracking-[0.04em]">
              <div>วันที่</div><div>ชื่อ</div><div>อีเมล</div><div>ลิงก์</div><div>Role</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">กำลังโหลด…</div>
          ) : list.length === 0 ? (
            <div className="flex items-center justify-center py-12 font-body text-body-sm text-grey-600">
              {tab === "applications" ? "ไม่มีคำขอรอพิจารณา" : "ยังไม่มี designer"}
            </div>
          ) : list.map((u) => (
            <div
              key={u.id}
              onClick={() => setSelected(selected?.id === u.id ? null : u)}
              className={`grid gap-3 px-4 py-3 cursor-pointer transition-colors duration-150 ease-base items-center ${
                tab === "designers" ? "grid-cols-[100px_1fr_1fr_120px_80px]" : "grid-cols-[100px_1fr_1.5fr_80px]"
              } ${selected?.id === u.id ? "bg-mint/20" : "hover:bg-grey-200"}`}
            >
              <div className="font-body text-footnote text-grey-600">{fmtDate(u.created_at)}</div>
              <div className="font-ui text-ui text-black truncate">{u.name ?? "—"}</div>
              <div className="font-body text-body-sm text-grey-600 truncate">{u.email ?? "—"}</div>
              {tab === "designers" && (
                <div>
                  {u.designer_slug ? (
                    <a
                      href={`/designer/${u.designer_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-body text-footnote text-mint-text no-underline hover:underline truncate block"
                    >
                      {u.designer_slug}
                    </a>
                  ) : (
                    <span className="font-body text-footnote text-grey-600">—</span>
                  )}
                </div>
              )}
              <div>
                {tab === "applications" ? (
                  <span className="text-badge font-heading px-2 py-0.5 bg-warning text-black">รอพิจารณา</span>
                ) : (
                  <span className="text-badge font-heading px-2 py-0.5 bg-mint text-black capitalize">{u.role}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[280px] flex-shrink-0 bg-surface p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="font-ui text-ui text-black">รายละเอียด</h3>
              <button onClick={() => setSelected(null)} className="text-grey-600 hover:text-black bg-transparent border-none cursor-pointer text-lg leading-none">✕</button>
            </div>

            <div className="flex flex-col gap-2 font-body text-body-sm">
              <Row label="ชื่อ" value={selected.name} />
              <Row label="อีเมล" value={selected.email} />
              <Row label="Role" value={selected.role} />
              {selected.designer_slug && <Row label="Slug" value={selected.designer_slug} />}
              {selected.portfolio_url && (
                <div>
                  <span className="text-grey-600">ผลงาน: </span>
                  <a
                    href={selected.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-mint-text no-underline hover:underline break-all"
                  >
                    {selected.portfolio_url}
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-3">
              {tab === "applications" && (
                <>
                  <Button onClick={() => promote(selected)} className="w-full">
                    Promote เป็น Designer
                  </Button>
                  <button
                    onClick={() => reject(selected)}
                    className="w-full py-2 text-danger-dark bg-white font-ui text-ui cursor-pointer hover:bg-danger hover:text-white transition-colors duration-150 ease-base border-none"
                  >
                    ปฏิเสธ
                  </button>
                </>
              )}
              {tab === "designers" && selected.role !== "admin" && (
                <>
                  {selected.role === "customer" && (
                    <Button onClick={() => promoteExisting(selected)} className="w-full">
                      Promote เป็น Designer
                    </Button>
                  )}
                  {selected.role === "designer" && (
                    <Button variant="outline" onClick={() => demote(selected)} className="w-full">
                      เปลี่ยนกลับเป็น Customer
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 bg-black text-white font-body text-body-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-grey-600">{label}: </span>
      <span className="text-black">{value}</span>
    </div>
  );
}
