alter table public.products
add column if not exists slug text,
add column if not exists price_cents integer,
add column if not exists affiliate_url text;

update public.products
set affiliate_url = coalesce(affiliate_url, order_url)
where affiliate_url is null
  and order_url is not null;

update public.products
set slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || left(id::text, 8)
where slug is null
  or slug = '';

create unique index if not exists products_slug_unique_idx
  on public.products(slug);

alter table public.product_variants
add column if not exists stripe_price_id text,
add column if not exists price_cents integer,
add column if not exists light_pattern text,
add column if not exists harness_included boolean not null default false;

alter table public.build_products
add column if not exists variant_id uuid references public.product_variants(id),
add column if not exists notes text;

create index if not exists products_slug_idx on public.products(slug);
create index if not exists build_products_variant_id_idx on public.build_products(variant_id);

drop policy if exists "Public can read active products on published builds" on public.products;
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products
for select
using (active = true);

drop policy if exists "Public can read active variants on published builds" on public.product_variants;
drop policy if exists "Public can read active variants for active products" on public.product_variants;
create policy "Public can read active variants for active products"
on public.product_variants
for select
using (
  active = true
  and exists (
    select 1
    from public.products
    where products.id = product_variants.product_id
      and products.active = true
  )
);
