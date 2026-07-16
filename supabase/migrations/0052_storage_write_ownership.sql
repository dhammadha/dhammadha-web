-- 🔴 ปิดรูรั่ว: ลูกค้าคนไหนก็ได้เขียนทับ/ลบไฟล์ฟอนต์ของ designer คนอื่นได้
--
-- policy เขียน/ลบบน storage.objects ทั้ง 21 ตัวเช็คแค่ `auth.role() = 'authenticated'`
-- = "login แล้วหรือยัง" ไม่เช็คว่าเป็นเจ้าของ และสมัครสมาชิกเปิดให้ทุกคน
-- → ใครสมัครบัญชีฟรีก็ upsert ทับ / ลบไฟล์ใน fonts-full (ฟอนต์ตัวจริงราคา ฿3,500–20,000),
--   covers, previews, specimens, fonts-demo, fonts-free, license-pdf ของคนอื่นได้
--
-- โครงสร้าง path (จาก src/lib/storage.ts storagePath): `${fontSlug}/${filename}`
-- ยกเว้น license-pdf ที่เป็น `${user_id}.${ext}` (จาก OwnPricing.tsx)
--
-- ข้อจำกัดสำคัญ: FontForm อัปไฟล์ก่อน แล้วค่อย insert แถว fonts (FontForm.tsx:272 → :374)
-- ดังนั้น policy ตอน INSERT เช็ค "เป็นเจ้าของฟอนต์" ตรง ๆ ไม่ได้ — แถวยังไม่เกิด
-- → ใช้กติกา "โฟลเดอร์ slug นี้ต้องยังไม่มีเจ้าของ หรือเป็นของเราเอง" แทน
--   (ยังกันการยึด slug ของคนอื่นได้ ซึ่งเป็นแก่นของช่องโหว่)
-- ส่วน UPDATE/DELETE เช็คความเป็นเจ้าของเต็มรูปแบบได้ เพราะแถวมีแล้วแน่นอน

-- helper: โฟลเดอร์ slug นี้ว่าง หรือเป็นของเรา (ใช้ตอน INSERT)
create or replace function public.can_write_font_slug(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select not exists (
    select 1 from public.fonts f
    where f.slug = split_part(p_path, '/', 1)
      and f.owner_id is distinct from auth.uid()
  );
$$;

-- helper: เราเป็นเจ้าของฟอนต์ของ path นี้ (ใช้ตอน UPDATE/DELETE/SELECT)
-- รับ path เป็น parameter เพื่อเลี่ยงบั๊กชื่อชนกัน: ถ้าเขียน split_part(name,'/',1)
-- ในซับคิวรีที่มี fonts อยู่ใน scope, `name` จะไปเข้า fonts.name แทน storage.objects.name
-- (เป็นบั๊กที่มีอยู่จริงใน policy "owner or admin read full" เดิม — ทำให้ designer
--  อ่านไฟล์ตัวเองไม่ได้เลย โชคดีที่ fail closed)
create or replace function public.owns_font_slug(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.fonts f
    where f.slug = split_part(p_path, '/', 1)
      and f.owner_id = auth.uid()
  );
$$;

-- บทเรียนจาก publish_fonts (0050): create function grant execute ให้ PUBLIC อัตโนมัติ
revoke execute on function public.can_write_font_slug(text) from public;
revoke execute on function public.owns_font_slug(text) from public;
grant execute on function public.can_write_font_slug(text) to authenticated;
grant execute on function public.owns_font_slug(text) to authenticated;

-- ลบ policy เดิมที่เช็คแค่ auth.role() = 'authenticated'
drop policy if exists "auth upload covers" on storage.objects;
drop policy if exists "auth upload previews" on storage.objects;
drop policy if exists "auth upload specimens" on storage.objects;
drop policy if exists "auth upload demo" on storage.objects;
drop policy if exists "auth upload free" on storage.objects;
drop policy if exists "auth upload full" on storage.objects;
drop policy if exists "auth upload license pdf" on storage.objects;
drop policy if exists "auth update covers" on storage.objects;
drop policy if exists "auth update previews" on storage.objects;
drop policy if exists "auth update specimens" on storage.objects;
drop policy if exists "auth update demo" on storage.objects;
drop policy if exists "auth update free" on storage.objects;
drop policy if exists "auth update full" on storage.objects;
drop policy if exists "auth update license pdf" on storage.objects;
drop policy if exists "auth delete covers" on storage.objects;
drop policy if exists "auth delete previews" on storage.objects;
drop policy if exists "auth delete specimens" on storage.objects;
drop policy if exists "auth delete demo" on storage.objects;
drop policy if exists "auth delete free" on storage.objects;
drop policy if exists "auth delete full" on storage.objects;
drop policy if exists "auth delete license pdf" on storage.objects;

-- admin จัดการได้ทุก bucket (เพิ่มฟอนต์แทน designer ได้ตามฟีเจอร์เดิม)
drop policy if exists "admin manage storage" on storage.objects;
create policy "admin manage storage" on storage.objects
  for all to authenticated
  using (public.get_my_role() = 'admin'::user_role)
  with check (public.get_my_role() = 'admin'::user_role);

-- designer อัปไฟล์เข้าโฟลเดอร์ slug ที่ว่างหรือของตัวเอง
create policy "designer upload own font assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('covers','previews','specimens','fonts-demo','fonts-free','fonts-full')
    and public.get_my_role() = 'designer'::user_role
    and public.can_write_font_slug(name)
  );

-- designer แก้/ลบ ได้เฉพาะไฟล์ของฟอนต์ตัวเอง
create policy "designer update own font assets" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('covers','previews','specimens','fonts-demo','fonts-free','fonts-full')
    and public.owns_font_slug(name)
  )
  with check (
    bucket_id in ('covers','previews','specimens','fonts-demo','fonts-free','fonts-full')
    and public.owns_font_slug(name)
  );

create policy "designer delete own font assets" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('covers','previews','specimens','fonts-demo','fonts-free','fonts-full')
    and public.owns_font_slug(name)
  );

-- license-pdf: ไฟล์ชื่อ <user_id>.<ext> → เจ้าตัวเท่านั้น
create policy "designer manage own license pdf" on storage.objects
  for all to authenticated
  using (bucket_id = 'license-pdf' and split_part(name, '.', 1) = auth.uid()::text)
  with check (bucket_id = 'license-pdf' and split_part(name, '.', 1) = auth.uid()::text);

-- แก้บั๊ก policy อ่าน fonts-full เดิม (f.name ไปเข้า fonts.name แทน objects.name
-- → เงื่อนไขเจ้าของไม่เคยเป็นจริง designer อ่านไฟล์ตัวเองไม่ได้)
drop policy if exists "owner or admin read full" on storage.objects;
create policy "owner or admin read full" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fonts-full'
    and (public.get_my_role() = 'admin'::user_role or public.owns_font_slug(name))
  );
