create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  company_name text not null,
  address text not null,
  tax_id text not null,
  email text not null,
  license_type text not null,
  fonts text[] not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.quotes enable row level security;

-- allow anyone to insert (public quote request form)
create policy "public insert quotes"
  on public.quotes for insert
  with check (true);
