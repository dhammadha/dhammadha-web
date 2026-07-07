ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS designer_slug text UNIQUE;
