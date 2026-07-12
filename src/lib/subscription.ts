// Helper กลางเรื่อง subscription — ใช้ทั้งหน้า /subscribe, /account, และ admin
//
// "active" คำนวณเสมอจาก status + current_period_end (ไม่พึ่ง cron flip status)
// ดู migration 0046_subscriptions.sql

export type SubscriptionRow = {
  id: string;
  user_id: string;
  provider: "trial" | "stripe" | "payso" | "admin";
  provider_subscription_id: string | null;
  status: "active" | "cancelled" | "expired";
  price_amount: number;
  started_at: string;
  current_period_end: string;
  cancelled_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionSettings = {
  monthly_price: number;
  yearly_price: number;
  trial_active: boolean;
  trial_end_date: string; // "YYYY-MM-DD"
  download_win?: string;
  download_mac?: string;
};

export const DEFAULT_SUB_SETTINGS: SubscriptionSettings = {
  monthly_price: 290,
  yearly_price: 2900,
  trial_active: false,
  trial_end_date: "",
};

/** subscription ใช้งานได้จริง ณ ตอนนี้หรือไม่ */
export function isSubActive(s: SubscriptionRow | null | undefined, now: Date = new Date()): boolean {
  if (!s) return false;
  return s.status === "active" && new Date(s.current_period_end).getTime() > now.getTime();
}

/** ช่วงทดสอบยังเปิดรับสมัครอยู่หรือไม่ */
export function isTrialOpen(s: SubscriptionSettings | null | undefined, now: Date = new Date()): boolean {
  if (!s || !s.trial_active || !s.trial_end_date) return false;
  // trial_end_date เป็นวันสุดท้ายที่สมัครได้ (inclusive) → หมดเขตต้นวันถัดไป
  const end = new Date(s.trial_end_date + "T00:00:00");
  end.setDate(end.getDate() + 1);
  return end.getTime() > now.getTime();
}

/** แปลง jsonb settings ดิบเป็น SubscriptionSettings (เติมค่า default ให้ครบ) */
export function parseSubSettings(raw: unknown): SubscriptionSettings {
  const v = (raw ?? {}) as Partial<SubscriptionSettings>;
  return {
    monthly_price: typeof v.monthly_price === "number" ? v.monthly_price : DEFAULT_SUB_SETTINGS.monthly_price,
    yearly_price: typeof v.yearly_price === "number" ? v.yearly_price : DEFAULT_SUB_SETTINGS.yearly_price,
    trial_active: v.trial_active === true,
    trial_end_date: typeof v.trial_end_date === "string" ? v.trial_end_date : "",
    download_win: typeof v.download_win === "string" ? v.download_win : undefined,
    download_mac: typeof v.download_mac === "string" ? v.download_mac : undefined,
  };
}
