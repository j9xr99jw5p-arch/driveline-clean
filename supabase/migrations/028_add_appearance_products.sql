alter table public.products
add column if not exists price_cents integer,
add column if not exists affiliate_url text,
add column if not exists product_url text,
add column if not exists install_url text,
add column if not exists inventory_status text default 'unknown',
add column if not exists specs jsonb not null default '{}'::jsonb;

alter table public.product_variants
add column if not exists price_cents integer,
add column if not exists inventory_status text default 'unknown',
add column if not exists updated_at timestamp with time zone default now();

create index if not exists product_variants_product_price_idx
  on public.product_variants(product_id, stripe_price_id);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now()
);

create index if not exists product_images_product_id_idx
  on public.product_images(product_id, sort_order);

create unique index if not exists product_images_product_url_unique_idx
  on public.product_images(product_id, url);

do $$
declare
  appearance_pack_id uuid;
  badges_id uuid;
  grille_id uuid;
  mirror_id uuid;
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
  values
    (
      'toyota-tacoma-replacement-badges',
      'Toyota Tacoma Replacement Badges',
      'HELTOOL',
      'Appearance',
      'Replacement overlay badge sets for 2016-2023 Toyota Tacoma trucks, available in 3-piece, 4-piece, and 6-piece packages with black or silver finish options.',
      'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/6-piece.jpg',
      4299,
      null,
      'https://heltool.com/products/tacoma-emblem-overlay-badge-set-for-toyota-tacoma-2016-2023',
      null,
      'price_1Tv7TKAxOgxntpwR5TRtzBrj',
      true,
      'in_stock',
      jsonb_build_object(
        'Fitment', '2016-2023 Toyota Tacoma',
        'Package choices', '3-piece kit, 4-piece kit, or 6-piece kit',
        'Color choices', 'Black or Silver',
        'Package contents', jsonb_build_object(
          '3-Piece Kit', 'TACOMA door emblem overlays for both sides and one tailgate emblem overlay',
          '4-Piece Kit', 'TACOMA door emblem overlays for both sides, one tailgate emblem overlay, and one V6 emblem overlay',
          '6-Piece Kit', 'TACOMA door emblem overlays for both sides, one tailgate emblem overlay, one V6 emblem overlay, one SR5 emblem overlay, and one 4x4 emblem overlay'
        )
      )
    ),
    (
      'cali-raised-tacoma-grille-marker-lights',
      'TRD Pro Grille Marker Lights',
      'Cali Raised LED',
      'Appearance',
      'TRD Pro style grille marker light kit for Tacoma builds. Verify grille compatibility before checkout.',
      'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/cali-raised-grille-lights/main.png',
      6299,
      null,
      'https://caliraisedled.com/products/pro-grille-raptor-light-kit',
      null,
      'price_1Tv6VuAxOgxntpwRRiQKB9Ts',
      true,
      'in_stock',
      jsonb_build_object(
        'Fitment', 'Toyota Tacoma with compatible TRD Pro style grille',
        'Included', 'Amber grille marker light kit',
        'Compatibility warning', 'Only check out after confirming your Tacoma grille accepts this marker light kit. This is not a universal fit for every grille.'
      )
    ),
    (
      'srq-tacoma-sequential-mirror-signals',
      'Tacoma Sequential Mirror Turn Signals',
      'SRQ Fabrications',
      'Appearance',
      'Sequential mirror turn signals for 2016-2023 Toyota Tacoma trucks with smoked or black lens options.',
      'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/srq-mirror-signals/main.png',
      9599,
      null,
      'https://www.srqfabrications.com/products/16-24-3rd-gen-tacoma-sequential-mirror-turn-signals',
      null,
      'price_1Tv5arAxOgxntpwR9AAOOWd3',
      true,
      'in_stock',
      jsonb_build_object(
        'Fitment', '2016-2023 Toyota Tacoma',
        'Lens choices', 'Smoked Lens or Black Lens',
        'Included', 'Sold as a pair',
        'Install', 'Plug-and-play'
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

  select id into badges_id from public.products where slug = 'toyota-tacoma-replacement-badges';
  select id into grille_id from public.products where slug = 'cali-raised-tacoma-grille-marker-lights';
  select id into mirror_id from public.products where slug = 'srq-tacoma-sequential-mirror-signals';

  with desired_variants as (
    select * from (
      values
        (badges_id, '6-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-6PC-BLK', 'price_1Tv6ZCAxOgxntpwRb0qUkyLx', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/6-piece.jpg', true, 'in_stock', 6299),
        (badges_id, '6-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-6PC-SIL', 'price_1Tv6ZCAxOgxntpwRb0qUkyLx', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/6-piece.jpg', true, 'in_stock', 6299),
        (badges_id, '4-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-4PC-BLK', 'price_1Tv6bgAxOgxntpwRlC5oSSeP', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/4-piece.jpg', true, 'in_stock', 5299),
        (badges_id, '4-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-4PC-SIL', 'price_1Tv6bgAxOgxntpwRlC5oSSeP', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/4-piece.jpg', true, 'in_stock', 5299),
        (badges_id, '3-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-3PC-BLK', 'price_1Tv7TKAxOgxntpwR5TRtzBrj', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/3-piece.jpg', true, 'in_stock', 4299),
        (badges_id, '3-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-3PC-SIL', 'price_1Tv7TKAxOgxntpwR5TRtzBrj', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/3-piece.jpg', true, 'in_stock', 4299),
        (mirror_id, 'Smoked Lens', 'SRQ2050', 'price_1Tv5arAxOgxntpwR9AAOOWd3', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/srq-mirror-signals/main.png', true, 'in_stock', 9599),
        (mirror_id, 'Black Lens', 'SRQ2051', 'price_1Tv5arAxOgxntpwR9AAOOWd3', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/srq-mirror-signals/main.png', true, 'in_stock', 9599)
    ) as variants(product_id, variant_name, sku, stripe_price_id, image_url, active, inventory_status, price_cents)
  )
  delete from public.product_variants duplicate_variants
  using public.product_variants kept_variants, desired_variants
  where duplicate_variants.product_id = desired_variants.product_id
    and kept_variants.product_id = desired_variants.product_id
    and lower(trim(duplicate_variants.variant_name)) = lower(trim(desired_variants.variant_name))
    and lower(trim(kept_variants.variant_name)) = lower(trim(desired_variants.variant_name))
    and duplicate_variants.ctid > kept_variants.ctid;

  with desired_variants as (
    select * from (
      values
        (badges_id, '6-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-6PC-BLK', 'price_1Tv6ZCAxOgxntpwRb0qUkyLx', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/6-piece.jpg', true, 'in_stock', 6299),
        (badges_id, '6-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-6PC-SIL', 'price_1Tv6ZCAxOgxntpwRb0qUkyLx', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/6-piece.jpg', true, 'in_stock', 6299),
        (badges_id, '4-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-4PC-BLK', 'price_1Tv6bgAxOgxntpwRlC5oSSeP', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/4-piece.jpg', true, 'in_stock', 5299),
        (badges_id, '4-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-4PC-SIL', 'price_1Tv6bgAxOgxntpwRlC5oSSeP', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/4-piece.jpg', true, 'in_stock', 5299),
        (badges_id, '3-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-3PC-BLK', 'price_1Tv7TKAxOgxntpwR5TRtzBrj', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/3-piece.jpg', true, 'in_stock', 4299),
        (badges_id, '3-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-3PC-SIL', 'price_1Tv7TKAxOgxntpwR5TRtzBrj', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/3-piece.jpg', true, 'in_stock', 4299),
        (mirror_id, 'Smoked Lens', 'SRQ2050', 'price_1Tv5arAxOgxntpwR9AAOOWd3', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/srq-mirror-signals/main.png', true, 'in_stock', 9599),
        (mirror_id, 'Black Lens', 'SRQ2051', 'price_1Tv5arAxOgxntpwR9AAOOWd3', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/srq-mirror-signals/main.png', true, 'in_stock', 9599)
    ) as variants(product_id, variant_name, sku, stripe_price_id, image_url, active, inventory_status, price_cents)
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

  with desired_variants as (
    select * from (
      values
        (badges_id, '6-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-6PC-BLK', 'price_1Tv6ZCAxOgxntpwRb0qUkyLx', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/6-piece.jpg', true, 'in_stock', 6299),
        (badges_id, '6-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-6PC-SIL', 'price_1Tv6ZCAxOgxntpwRb0qUkyLx', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/6-piece.jpg', true, 'in_stock', 6299),
        (badges_id, '4-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-4PC-BLK', 'price_1Tv6bgAxOgxntpwRlC5oSSeP', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/4-piece.jpg', true, 'in_stock', 5299),
        (badges_id, '4-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-4PC-SIL', 'price_1Tv6bgAxOgxntpwRlC5oSSeP', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/4-piece.jpg', true, 'in_stock', 5299),
        (badges_id, '3-Piece Kit / Black', 'HELTOOL-TACOMA-BADGE-3PC-BLK', 'price_1Tv7TKAxOgxntpwR5TRtzBrj', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/3-piece.jpg', true, 'in_stock', 4299),
        (badges_id, '3-Piece Kit / Silver', 'HELTOOL-TACOMA-BADGE-3PC-SIL', 'price_1Tv7TKAxOgxntpwR5TRtzBrj', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/3-piece.jpg', true, 'in_stock', 4299),
        (mirror_id, 'Smoked Lens', 'SRQ2050', 'price_1Tv5arAxOgxntpwR9AAOOWd3', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/srq-mirror-signals/main.png', true, 'in_stock', 9599),
        (mirror_id, 'Black Lens', 'SRQ2051', 'price_1Tv5arAxOgxntpwR9AAOOWd3', 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/srq-mirror-signals/main.png', true, 'in_stock', 9599)
    ) as variants(product_id, variant_name, sku, stripe_price_id, image_url, active, inventory_status, price_cents)
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

  update public.product_variants
  set active = false, inventory_status = 'inactive', updated_at = now()
  where product_id = grille_id;

  insert into public.product_images (product_id, url, alt_text, sort_order)
  values
    (badges_id, 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/4-piece.jpg', 'Toyota Tacoma replacement badge 4-piece package image', 1),
    (badges_id, 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/heltool-tacoma-badges/3-piece.jpg', 'Toyota Tacoma replacement badge 3-piece package image', 2),
    (grille_id, 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/cali-raised-grille-lights/installed.png', 'Cali Raised Tacoma grille marker lights installed preview', 1),
    (grille_id, 'https://fwfsbeeamszwfiwvrfuz.supabase.co/storage/v1/object/public/product-images/cali-raised-grille-lights/tacoma-installed.jpg', 'Cali Raised Tacoma grille marker lights on Tacoma grille', 2)
  on conflict (product_id, url) do update
  set
    alt_text = excluded.alt_text,
    sort_order = excluded.sort_order;

  select id into appearance_pack_id from public.packs where slug = 'appearance';

  if appearance_pack_id is not null then
    insert into public.pack_products (
      pack_id,
      product_id,
      sort_order,
      quantity,
      selected_by_default
    )
    values
      (appearance_pack_id, badges_id, 100, 1, true),
      (appearance_pack_id, grille_id, 110, 1, true),
      (appearance_pack_id, mirror_id, 120, 1, true)
    on conflict (pack_id, product_id) do update
    set
      quantity = excluded.quantity,
      selected_by_default = excluded.selected_by_default;
  end if;
end $$;
