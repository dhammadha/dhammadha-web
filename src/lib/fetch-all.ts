/**
 * ดึงข้อมูลจาก Supabase เกินเพดาน 1000 แถวต่อ request ของ PostgREST
 *
 * ถ้า select ตรง ๆ โดยไม่ .range() PostgREST จะตัดผลลัพธ์ที่ 1000 แถวเงียบ ๆ —
 * หน้า analytics/revenue ที่ sum ยอดจากทุกแถวจะนับขาดโดยไม่มี error ใด ๆ
 * helper นี้วน .range() ทีละ batch จนหมด
 *
 * ข้อควรระวัง: query ที่ส่งเข้ามาต้องมี .order(...) ที่เสถียร (เช่น id หรือ
 * created_at) เสมอ ไม่งั้นลำดับแถวระหว่าง batch ไม่นิ่ง อาจได้แถวซ้ำ/หลุด
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  batchSize = 1000
): Promise<{ rows: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await page(from, from + batchSize - 1);
    if (error) return { rows, error };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < batchSize) break;
  }
  return { rows, error: null };
}
