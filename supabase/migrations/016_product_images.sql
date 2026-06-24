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

alter table public.product_images enable row level security;

drop policy if exists "Public can read product images for active products" on public.product_images;
create policy "Public can read product images for active products"
on public.product_images
for select
using (
  exists (
    select 1
    from public.products
    where products.id = product_images.product_id
      and products.active = true
  )
);

grant select on public.product_images to anon, authenticated;
