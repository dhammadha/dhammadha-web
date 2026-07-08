-- Update handle_new_user trigger to read portfolio data from auth metadata
-- This fixes designer signup: since user has no session yet during email confirmation,
-- we can't do an authenticated update, so we pass the data via signUp options.data instead.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name, portfolio_url, designer_application_status)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'portfolio_url',
    new.raw_user_meta_data->>'designer_application_status'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
