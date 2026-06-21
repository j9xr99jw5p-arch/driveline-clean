create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text not null,
  description text,
  image_url text,
  order_url text,
  stripe_price_id text not null,
  active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.build_products (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references public.verified_builds(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_type text,
  display_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  product_id uuid references public.products(id),
  build_id uuid references public.verified_builds(id),
  quantity integer,
  amount_total integer,
  currency text,
  status text,
  created_at timestamp with time zone default now()
);

create index if not exists products_active_idx on public.products(active);
create index if not exists build_products_build_id_idx on public.build_products(build_id);
create index if not exists build_products_product_id_idx on public.build_products(product_id);
create unique index if not exists build_products_build_product_unique_idx
  on public.build_products(build_id, product_id);

alter table public.products enable row level security;
alter table public.build_products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can read active products on published builds" on public.products;
create policy "Public can read active products on published builds"
on public.products
for select
using (
  active = true
  and exists (
    select 1
    from public.build_products
    join public.verified_builds on verified_builds.id = build_products.build_id
    where build_products.product_id = products.id
      and verified_builds.published = true
  )
);

drop policy if exists "Public can read product links on published builds" on public.build_products;
create policy "Public can read product links on published builds"
on public.build_products
for select
using (
  exists (
    select 1
    from public.verified_builds
    join public.products on products.id = build_products.product_id
    where verified_builds.id = build_products.build_id
      and verified_builds.published = true
      and products.active = true
  )
);

grant select on public.products to anon, authenticated;
grant select on public.build_products to anon, authenticated;
