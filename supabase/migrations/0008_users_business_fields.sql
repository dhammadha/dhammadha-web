ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'individual' CHECK (entity_type IN ('individual', 'juristic'));
