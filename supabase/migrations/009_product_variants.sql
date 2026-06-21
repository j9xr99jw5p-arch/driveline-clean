alter table public.products
add column if not exists order_url text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'stripe_price_id'
  ) then
    alter table public.products alter column stripe_price_id drop not null;
  end if;
end $$;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_name text not null,
  beam_pattern text,
  lens_color text,
  size text,
  finish text,
  sku text,
  supplier_sku text,
  stripe_price_id text not null,
  image_url text,
  active boolean not null default true,
  inventory_status text default 'unknown',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

insert into public.product_variants (
  product_id,
  variant_name,
  stripe_price_id,
  image_url,
  active
)
select
  products.id,
  'Standard',
  products.stripe_price_id,
  products.image_url,
  products.active
from public.products
where products.stripe_price_id is not null
  and not exists (
    select 1
    from public.product_variants
    where product_variants.product_id = products.id
      and product_variants.stripe_price_id = products.stripe_price_id
  );

alter table public.orders
add column if not exists variant_id uuid references public.product_variants(id),
add column if not exists customer_email text,
add column if not exists shipping_name text,
add column if not exists shipping_address jsonb;

update public.orders
set quantity = 1
where quantity is null;

alter table public.orders
alter column quantity set default 1;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'quantity'
  ) then
    alter table public.orders alter column quantity set not null;
  end if;
end $$;

create index if not exists product_variants_product_id_idx
  on public.product_variants(product_id);

create index if not exists product_variants_active_idx
  on public.product_variants(active);

create unique index if not exists product_variants_product_price_unique_idx
  on public.product_variants(product_id, stripe_price_id);

alter table public.product_variants enable row level security;

drop policy if exists "Public can read active variants on published builds" on public.product_variants;
create policy "Public can read active variants on published builds"
on public.product_variants
for select
using (
  active = true
  and exists (
    select 1
    from public.build_products
    join public.verified_builds on verified_builds.id = build_products.build_id
    join public.products on products.id = build_products.product_id
    where build_products.product_id = product_variants.product_id
      and verified_builds.published = true
      and products.active = true
  )
);

grant select on public.product_variants to anon, authenticated;
