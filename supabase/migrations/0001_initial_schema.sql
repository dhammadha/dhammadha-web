-- Enable UUID extension
create extension if not exists "pgcrypto";

-- fonts table
create table public.fonts (
  id uuid primary key default gen_random_uuid(),
  name text,
  name_th text,
  slug text unique not null,
  designer_name text,
  category text,
  tags text[],
  description_th text,
  description_en text,
  price numeric,
  sale_price numeric,
  discount_percent numeric,
  is_sale boolean not null default false,
  sale_label text,
  sale_end text,
  is_active boolean not null default true,
  is_free boolean not null default false,
  is_subscription boolean not null default false,
  is_popular boolean not null default false,
  cover_image_url text,
  preview_images text[],
  full_font_files text[],
  demo_font_files text[],
  free_font_files text[],
  specimen_files text[],
  obfuscated_font_files text[],
  obfuscated_map jsonb,
  has_demo boolean not null default false,
  weight_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fonts_updated_at
  before update on public.fonts
  for each row execute function public.set_updated_at();

-- settings table (replaces Firestore settings/licensing document)
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- seed default licensing settings
insert into public.settings (key, value) values
  ('licensing', '{"small": 3500, "large": 7000, "extra": 20000}'::jsonb);

-- RLS: public read for active fonts
alter table public.fonts enable row level security;
alter table public.settings enable row level security;

create policy "public read active fonts"
  on public.fonts for select
  using (is_active = true);

create policy "public read settings"
  on public.settings for select
  using (true);
