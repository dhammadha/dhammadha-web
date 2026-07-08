"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/Button";

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
    showToast(`✓ Promote ${u.name ?? u.email} เป็น designer แล้ว`);
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
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-navy">Designers</h1>
          {applications.length > 0 && (
            <p className="text-[13px] text-amber-600 mt-0.5">
              ⚠️ {applications.length} คำขอรอพิจารณา
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#f5f5f2] rounded-xl p-1 w-fit">
        {(["applications", "designers"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelected(null); }}
            className={`px-4 py-1.5 rounded-[9px] text-[13px] font-medium transition-colors border-none cursor-pointer ${
              tab === t ? "bg-white text-navy shadow-sm" : "bg-transparent text-[#888] hover:text-navy"
            }`}
          >
            {t === "applications" ? "คำขอสมัคร" : "Designers"}
            {t === "applications" && applications.length > 0 && (
              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">
                {applications.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* List */}
        <div className="flex-1 bg-white rounded-2xl border border-border overflow-hidden">
          {tab === "applications" && (
            <div className="grid grid-cols-[100px_1fr_1.5fr_80px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
              <div>วันที่</div><div>ชื่อ</div><div>อีเมล</div><div>สถานะ</div>
            </div>
          )}

          {tab === "designers" && (
            <div className="grid grid-cols-[100px_1fr_1fr_120px_80px] gap-3 px-4 py-2.5 bg-[#f8f8f6] text-[11px] font-semibold text-[#aaa] tracking-[0.04em] border-b border-border">
              <div>วันที่</div><div>ชื่อ</div><div>อีเมล</div><div>ลิงก์</div><div>Role</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">กำลังโหลด…</div>
          ) : list.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[#aaa] text-[14px]">
              {tab === "applications" ? "ไม่มีคำขอรอพิจารณา" : "ยังไม่มี designer"}
            </div>
          ) : list.map((u) => (
            <div
              key={u.id}
              onClick={() => setSelected(selected?.id === u.id ? null : u)}
              className={`grid gap-3 px-4 py-3 border-b border-[#f8f8f8] last:border-0 cursor-pointer transition-colors items-center ${
                tab === "designers" ? "grid-cols-[100px_1fr_1fr_120px_80px]" : "grid-cols-[100px_1fr_1.5fr_80px]"
              } ${selected?.id === u.id ? "bg-mint-light" : "hover:bg-[#fafaf8]"}`}
            >
              <div className="text-[12px] text-[#888]">{fmtDate(u.created_at)}</div>
              <div className="text-[13px] text-navy font-medium truncate">{u.name ?? "—"}</div>
              <div className="text-[13px] text-[#555] truncate">{u.email ?? "—"}</div>
              {tab === "designers" && (
                <div>
                  {u.designer_slug ? (
                    <a
                      href={`/designer/${u.designer_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[12px] text-mint no-underline hover:underline truncate block"
                    >
                      {u.designer_slug}
                    </a>
                  ) : (
                    <span className="text-[12px] text-[#ccc]">—</span>
                  )}
                </div>
              )}
              <div>
                {tab === "applications" ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">รอพิจารณา</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-mint-light text-[#0a8a84] font-medium capitalize">{u.role}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[280px] flex-shrink-0 bg-white rounded-2xl border border-border p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-navy">รายละเอียด</h3>
              <button onClick={() => setSelected(null)} className="text-[#aaa] hover:text-navy bg-transparent border-none cursor-pointer text-lg leading-none">✕</button>
            </div>

            <div className="flex flex-col gap-2 text-[13px]">
              <Row label="ชื่อ" value={selected.name} />
              <Row label="อีเมล" value={selected.email} />
              <Row label="Role" value={selected.role} />
              {selected.designer_slug && <Row label="Slug" value={selected.designer_slug} />}
              {selected.portfolio_url && (
                <div>
                  <span className="text-[#aaa]">ผลงาน: </span>
                  <a
                    href={selected.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-mint no-underline hover:underline break-all"
                  >
                    {selected.portfolio_url}
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {tab === "applications" && (
                <>
                  <Button onClick={() => promote(selected)} className="w-full">
                    Promote เป็น Designer
                  </Button>
                  <button
                    onClick={() => reject(selected)}
                    className="w-full py-2 rounded-xl border border-red-200 text-red-500 bg-red-50 text-[13px] cursor-pointer hover:bg-red-100 transition-colors"
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
        <div className="fixed bottom-6 right-6 z-[190] px-4 py-3 rounded-xl bg-navy text-white text-[13px] font-medium shadow-lg">
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
      <span className="text-[#aaa]">{label}: </span>
      <span className="text-navy">{value}</span>
    </div>
  );
}
