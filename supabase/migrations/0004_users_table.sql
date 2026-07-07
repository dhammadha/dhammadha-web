-- User roles enum
do $$ begin
  create type public.user_role as enum ('admin', 'designer', 'customer');
exception when duplicate_object then null;
end $$;

-- Users table (mirrors auth.users via trigger)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  name text,
  designer_id text unique,
  email text,
  phone text,
  address text,
  tax_id text,
  bank jsonb,
  is_active boolean not null default true,
  revenue_share_percent numeric,
  payout_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.users enable row level security;

drop policy if exists "users read own" on public.users;
create policy "users read own"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users update own" on public.users;
create policy "users update own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "admin read all users" on public.users;
create policy "admin read all users"
  on public.users for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

drop policy if exists "admin update all users" on public.users;
create policy "admin update all users"
  on public.users for update
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Helper function
create or replace function public.get_my_role()
returns public.user_role language sql security definer stable set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

-- Grants
grant select, update on public.users to authenticated;
grant execute on function public.get_my_role() to authenticated;
