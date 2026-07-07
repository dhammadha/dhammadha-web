-- Add SET row_security = off to admin_upsert_font so ALL operations inside
-- the function (including INSERT into fonts) bypass RLS entirely.
-- The function still verifies the caller is admin before proceeding.
create or replace function public.admin_upsert_font(
  p_id uuid,
  p_data jsonb
)
returns jsonb language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_role public.user_role;
  v_result jsonb;
begin
  -- Verify caller is admin (row_security=off lets us read users without RLS)
  select role into v_role from public.users where id = auth.uid();
  if v_role is null or v_role != 'admin' then
    raise exception 'Unauthorized: admin role required';
  end if;

  if p_id is not null then
    update public.fonts
    set
      name                = coalesce((p_data->>'name'), name),
      name_th             = coalesce((p_data->>'name_th'), name_th),
      slug                = coalesce((p_data->>'slug'), slug),
      designer_name       = coalesce((p_data->>'designer_name'), designer_name),
      category            = coalesce((p_data->>'category'), category),
      tags                = case when p_data ? 'tags' then (select array_agg(x) from jsonb_array_elements_text(p_data->'tags') x) else tags end,
      description_th      = coalesce((p_data->>'description_th'), description_th),
      description_en      = coalesce((p_data->>'description_en'), description_en),
      price               = case when p_data ? 'price' then (p_data->>'price')::numeric else price end,
      discount_percent    = case when p_data ? 'discount_percent' then (p_data->>'discount_percent')::int else discount_percent end,
      sale_price          = case when p_data ? 'sale_price' then (p_data->>'sale_price')::numeric else sale_price end,
      is_sale             = case when p_data ? 'is_sale' then (p_data->>'is_sale')::boolean else is_sale end,
      sale_label          = coalesce((p_data->>'sale_label'), sale_label),
      sale_end            = case when p_data ? 'sale_end' then (p_data->>'sale_end')::timestamptz else sale_end end,
      is_active           = case when p_data ? 'is_active' then (p_data->>'is_active')::boolean else is_active end,
      is_free             = case when p_data ? 'is_free' then (p_data->>'is_free')::boolean else is_free end,
      is_subscription     = case when p_data ? 'is_subscription' then (p_data->>'is_subscription')::boolean else is_subscription end,
      cover_image_url     = coalesce((p_data->>'cover_image_url'), cover_image_url),
      preview_images      = case when p_data ? 'preview_images' then (select array_agg(x) from jsonb_array_elements_text(p_data->'preview_images') x) else preview_images end,
      full_font_files     = case when p_data ? 'full_font_files' then (select array_agg(x) from jsonb_array_elements_text(p_data->'full_font_files') x) else full_font_files end,
      demo_font_files     = case when p_data ? 'demo_font_files' then (select array_agg(x) from jsonb_array_elements_text(p_data->'demo_font_files') x) else demo_font_files end,
      free_font_files     = case when p_data ? 'free_font_files' then (select array_agg(x) from jsonb_array_elements_text(p_data->'free_font_files') x) else free_font_files end,
      specimen_files      = case when p_data ? 'specimen_files' then (select array_agg(x) from jsonb_array_elements_text(p_data->'specimen_files') x) else specimen_files end,
      has_demo            = case when p_data ? 'has_demo' then (p_data->>'has_demo')::boolean else has_demo end,
      weight_count        = case when p_data ? 'weight_count' then (p_data->>'weight_count')::int else weight_count end,
      owner_id            = case when p_data ? 'owner_id' then (p_data->>'owner_id')::uuid else owner_id end
    where id = p_id
    returning to_jsonb(fonts.*) into v_result;
  else
    insert into public.fonts (
      name, name_th, slug, designer_name, category, tags,
      description_th, description_en, price, discount_percent, sale_price,
      is_sale, sale_label, sale_end, is_active, is_free, is_subscription,
      cover_image_url, preview_images, full_font_files, demo_font_files,
      free_font_files, specimen_files, has_demo, weight_count, owner_id
    ) values (
      p_data->>'name',
      p_data->>'name_th',
      p_data->>'slug',
      p_data->>'designer_name',
      p_data->>'category',
      case when p_data ? 'tags' then (select array_agg(x) from jsonb_array_elements_text(p_data->'tags') x) else null end,
      p_data->>'description_th',
      p_data->>'description_en',
      case when p_data ? 'price' then (p_data->>'price')::numeric else null end,
      case when p_data ? 'discount_percent' then (p_data->>'discount_percent')::int else null end,
      case when p_data ? 'sale_price' then (p_data->>'sale_price')::numeric else null end,
      case when p_data ? 'is_sale' then (p_data->>'is_sale')::boolean else false end,
      p_data->>'sale_label',
      case when p_data ? 'sale_end' then (p_data->>'sale_end')::timestamptz else null end,
      case when p_data ? 'is_active' then (p_data->>'is_active')::boolean else true end,
      case when p_data ? 'is_free' then (p_data->>'is_free')::boolean else false end,
      case when p_data ? 'is_subscription' then (p_data->>'is_subscription')::boolean else false end,
      p_data->>'cover_image_url',
      case when p_data ? 'preview_images' then (select array_agg(x) from jsonb_array_elements_text(p_data->'preview_images') x) else null end,
      case when p_data ? 'full_font_files' then (select array_agg(x) from jsonb_array_elements_text(p_data->'full_font_files') x) else null end,
      case when p_data ? 'demo_font_files' then (select array_agg(x) from jsonb_array_elements_text(p_data->'demo_font_files') x) else null end,
      case when p_data ? 'free_font_files' then (select array_agg(x) from jsonb_array_elements_text(p_data->'free_font_files') x) else null end,
      case when p_data ? 'specimen_files' then (select array_agg(x) from jsonb_array_elements_text(p_data->'specimen_files') x) else null end,
      case when p_data ? 'has_demo' then (p_data->>'has_demo')::boolean else false end,
      case when p_data ? 'weight_count' then (p_data->>'weight_count')::int else null end,
      case when p_data ? 'owner_id' then (p_data->>'owner_id')::uuid else null end
    )
    returning to_jsonb(fonts.*) into v_result;
  end if;

  return v_result;
end;
$$;

grant execute on function public.admin_upsert_font(uuid, jsonb) to authenticated;
