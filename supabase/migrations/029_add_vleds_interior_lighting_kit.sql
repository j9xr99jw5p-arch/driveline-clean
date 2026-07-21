alter table public.products
add column if not exists price_cents integer,
add column if not exists affiliate_url text,
add column if not exists product_url text,
add column if not exists inventory_status text default 'unknown',
add column if not exists specs jsonb not null default '{}'::jsonb;

alter table public.product_variants
add column if not exists price_cents integer,
add column if not exists inventory_status text default 'unknown',
add column if not exists updated_at timestamp with time zone default now();

do $$
declare
  appearance_pack_id uuid;
  vleds_product_id uuid;
begin
  insert into public.products (
    slug,
    name,
    brand,
    category,
    description,
    image_url,
    price_cents,
    affiliate_url,
    product_url,
    order_url,
    stripe_price_id,
    active,
    inventory_status,
    specs
  )
  values (
    'vleds-tacoma-interior-lighting-kit',
    'Tacoma Interior Lighting Kit',
    'VLEDs',
    'Lighting',
    'Plug-and-play LED interior lighting kit for 2016-2023 Toyota Tacoma trucks. Choose color temperatures for map lights, dome light, and vanity lights.',
    'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/vleds-tacoma-interior-lighting-kit/main.jpg',
    6299,
    null,
    'https://www.vleds.com/toyota-tacoma-third-gen-led-interior-kit.html',
    null,
    'price_1Tv7kZAxOgxntpwR9xcTpwS5',
    true,
    'in_stock',
    jsonb_build_object(
      'Fitment', '2016-2023 Toyota Tacoma',
      'Color temperatures', '4000K Warm White, 5000K Natural White, 5500K Pure White, 6000K Cool White',
      'Selectable locations', 'Map Lights, Dome Light, Vanity Lights',
      'Included', 'Map lights, dome light, and vanity lights for the cabin',
      'Install', 'Plug-and-play',
      'Safety note', 'Disconnect the negative battery cable before installation.'
    )
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    brand = excluded.brand,
    category = excluded.category,
    description = excluded.description,
    image_url = excluded.image_url,
    price_cents = excluded.price_cents,
    affiliate_url = excluded.affiliate_url,
    product_url = excluded.product_url,
    order_url = excluded.order_url,
    stripe_price_id = excluded.stripe_price_id,
    active = excluded.active,
    inventory_status = excluded.inventory_status,
    specs = excluded.specs,
    updated_at = now();

  select id into vleds_product_id
  from public.products
  where slug = 'vleds-tacoma-interior-lighting-kit';

  with color_options as (
    select * from (
      values
        ('4000K Warm White', 10),
        ('5000K Natural White', 20),
        ('5500K Pure White', 30),
        ('6000K Cool White', 40)
    ) as colors(label, sort_order)
  ),
  desired_variants as (
    select
      vleds_product_id as product_id,
      format('Map Lights: %s / Dome Light: %s / Vanity Lights: %s', map_colors.label, dome_colors.label, vanity_colors.label) as variant_name,
      format('VLEDS-TACOMA-INT-%s-%s-%s',
        regexp_replace(split_part(map_colors.label, ' ', 1), '[^0-9K]', '', 'g'),
        regexp_replace(split_part(dome_colors.label, ' ', 1), '[^0-9K]', '', 'g'),
        regexp_replace(split_part(vanity_colors.label, ' ', 1), '[^0-9K]', '', 'g')
      ) as sku,
      'price_1Tv7kZAxOgxntpwR9xcTpwS5'::text as stripe_price_id,
      'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/vleds-tacoma-interior-lighting-kit/main.jpg'::text as image_url,
      true as active,
      'in_stock'::text as inventory_status,
      6299 as price_cents
    from color_options map_colors
    cross join color_options dome_colors
    cross join color_options vanity_colors
  )
  delete from public.product_variants duplicate_variants
  using public.product_variants kept_variants, desired_variants
  where duplicate_variants.product_id = desired_variants.product_id
    and kept_variants.product_id = desired_variants.product_id
    and lower(trim(duplicate_variants.variant_name)) = lower(trim(desired_variants.variant_name))
    and lower(trim(kept_variants.variant_name)) = lower(trim(desired_variants.variant_name))
    and duplicate_variants.ctid > kept_variants.ctid;

  with color_options as (
    select * from (
      values
        ('4000K Warm White', 10),
        ('5000K Natural White', 20),
        ('5500K Pure White', 30),
        ('6000K Cool White', 40)
    ) as colors(label, sort_order)
  ),
  desired_variants as (
    select
      vleds_product_id as product_id,
      format('Map Lights: %s / Dome Light: %s / Vanity Lights: %s', map_colors.label, dome_colors.label, vanity_colors.label) as variant_name,
      format('VLEDS-TACOMA-INT-%s-%s-%s',
        regexp_replace(split_part(map_colors.label, ' ', 1), '[^0-9K]', '', 'g'),
        regexp_replace(split_part(dome_colors.label, ' ', 1), '[^0-9K]', '', 'g'),
        regexp_replace(split_part(vanity_colors.label, ' ', 1), '[^0-9K]', '', 'g')
      ) as sku,
      'price_1Tv7kZAxOgxntpwR9xcTpwS5'::text as stripe_price_id,
      'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/vleds-tacoma-interior-lighting-kit/main.jpg'::text as image_url,
      true as active,
      'in_stock'::text as inventory_status,
      6299 as price_cents
    from color_options map_colors
    cross join color_options dome_colors
    cross join color_options vanity_colors
  )
  update public.product_variants
  set
    variant_name = desired_variants.variant_name,
    sku = desired_variants.sku,
    stripe_price_id = desired_variants.stripe_price_id,
    image_url = desired_variants.image_url,
    active = desired_variants.active,
    inventory_status = desired_variants.inventory_status,
    price_cents = desired_variants.price_cents,
    updated_at = now()
  from desired_variants
  where product_variants.product_id = desired_variants.product_id
    and lower(trim(product_variants.variant_name)) = lower(trim(desired_variants.variant_name));

  with color_options as (
    select * from (
      values
        ('4000K Warm White', 10),
        ('5000K Natural White', 20),
        ('5500K Pure White', 30),
        ('6000K Cool White', 40)
    ) as colors(label, sort_order)
  ),
  desired_variants as (
    select
      vleds_product_id as product_id,
      format('Map Lights: %s / Dome Light: %s / Vanity Lights: %s', map_colors.label, dome_colors.label, vanity_colors.label) as variant_name,
      format('VLEDS-TACOMA-INT-%s-%s-%s',
        regexp_replace(split_part(map_colors.label, ' ', 1), '[^0-9K]', '', 'g'),
        regexp_replace(split_part(dome_colors.label, ' ', 1), '[^0-9K]', '', 'g'),
        regexp_replace(split_part(vanity_colors.label, ' ', 1), '[^0-9K]', '', 'g')
      ) as sku,
      'price_1Tv7kZAxOgxntpwR9xcTpwS5'::text as stripe_price_id,
      'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/vleds-tacoma-interior-lighting-kit/main.jpg'::text as image_url,
      true as active,
      'in_stock'::text as inventory_status,
      6299 as price_cents
    from color_options map_colors
    cross join color_options dome_colors
    cross join color_options vanity_colors
  )
  insert into public.product_variants (
    product_id,
    variant_name,
    sku,
    stripe_price_id,
    image_url,
    active,
    inventory_status,
    price_cents
  )
  select
    desired_variants.product_id,
    desired_variants.variant_name,
    desired_variants.sku,
    desired_variants.stripe_price_id,
    desired_variants.image_url,
    desired_variants.active,
    desired_variants.inventory_status,
    desired_variants.price_cents
  from desired_variants
  where not exists (
    select 1
    from public.product_variants
    where product_variants.product_id = desired_variants.product_id
      and lower(trim(product_variants.variant_name)) = lower(trim(desired_variants.variant_name))
  );

  select id into appearance_pack_id
  from public.packs
  where slug = 'appearance';

  if appearance_pack_id is not null then
    insert into public.pack_products (
      pack_id,
      product_id,
      sort_order,
      quantity,
      selected_by_default
    )
    values (
      appearance_pack_id,
      vleds_product_id,
      130,
      1,
      true
    )
    on conflict (pack_id, product_id) do update
    set
      quantity = excluded.quantity,
      selected_by_default = excluded.selected_by_default;
  end if;
end $$;
