-- Track which fonts have been deployed to the live site.
-- published_at = null means never published; if updated_at > published_at means has unpublished changes.
alter table public.fonts add column if not exists published_at timestamptz;
