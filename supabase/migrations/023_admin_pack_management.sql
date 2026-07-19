create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.packs
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists active boolean default true,
  add column if not exists sort_order integer default 0,
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists updated_at timestamp with time zone default now();

update public.packs
set
  active = coalesce(active, true),
  sort_order = coalesce(sort_order, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.packs
  alter column name set not null,
  alter column slug set not null,
  alter column active set default true,
  alter column active set not null,
  alter column sort_order set default 0,
  alter column sort_order set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create unique index if not exists packs_slug_unique_idx
  on public.packs(slug);

create table if not exists public.pack_products (
  pack_id uuid not null references public.packs(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  quantity integer not null default 1,
  selected_by_default boolean not null default true,
  created_at timestamp with time zone not null default now(),
  primary key (pack_id, product_id)
);

alter table public.pack_products
  add column if not exists sort_order integer default 0,
  add column if not exists quantity integer default 1,
  add column if not exists selected_by_default boolean default true,
  add column if not exists created_at timestamp with time zone default now();

update public.pack_products
set
  sort_order = coalesce(sort_order, 0),
  quantity = greatest(1, coalesce(quantity, 1)),
  selected_by_default = coalesce(selected_by_default, true),
  created_at = coalesce(created_at, now());

alter table public.pack_products
  alter column sort_order set default 0,
  alter column sort_order set not null,
  alter column quantity set default 1,
  alter column quantity set not null,
  alter column selected_by_default set default true,
  alter column selected_by_default set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pack_products_quantity_check'
  ) then
    alter table public.pack_products
    add constraint pack_products_quantity_check check (quantity > 0);
  end if;
end $$;

create index if not exists packs_active_sort_idx
  on public.packs(active, sort_order);

create index if not exists pack_products_pack_sort_idx
  on public.pack_products(pack_id, sort_order);

create index if not exists pack_products_product_id_idx
  on public.pack_products(product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists packs_set_updated_at on public.packs;
create trigger packs_set_updated_at
before update on public.packs
for each row
execute function public.set_updated_at();

alter table public.packs enable row level security;
alter table public.pack_products enable row level security;

drop policy if exists "Public can read active packs" on public.packs;
create policy "Public can read active packs"
on public.packs
for select
using (active = true);

drop policy if exists "Public can read active pack products" on public.pack_products;
create policy "Public can read active pack products"
on public.pack_products
for select
using (
  exists (
    select 1
    from public.packs
    join public.products on products.id = pack_products.product_id
    where packs.id = pack_products.pack_id
      and packs.active = true
      and products.active = true
  )
);

grant select on public.packs to anon, authenticated;
grant select on public.pack_products to anon, authenticated;

insert into public.packs (name, slug, description, sort_order, active)
values
  ('Recovery Pack', 'recovery', 'Basic recovery gear for Tacoma owners who want to be prepared before they get stuck.', 0, true),
  ('Lighting Pack', 'lighting', 'Simple lighting upgrades that improve visibility without going overboard.', 10, true),
  ('Storage Pack', 'storage', 'Practical storage and utility parts for keeping gear organized on trips.', 20, true),
  ('Appearance Pack', 'appearance', 'Affordable exterior upgrades that clean up the look of the truck without hurting daily drivability.', 30, true)
on conflict (slug) do update
set
  name = excluded.name,
  description = coalesce(public.packs.description, excluded.description),
  sort_order = excluded.sort_order,
  active = excluded.active;

do $$
begin
  if to_regclass('public.starter_pack_items') is not null
    and to_regclass('public.starter_packs') is not null then
    insert into public.pack_products (
      pack_id,
      product_id,
      sort_order,
      quantity,
      selected_by_default
    )
    select
      packs.id,
      starter_pack_items.part_id,
      starter_pack_items.sort_order,
      greatest(1, coalesce(starter_pack_items.recommended_quantity, 1)),
      coalesce(starter_pack_items.default_selected, true)
    from public.starter_pack_items
    join public.starter_packs on starter_packs.id = starter_pack_items.pack_id
    join public.packs on packs.slug = starter_packs.slug
    join public.products on products.id = starter_pack_items.part_id
    where products.active = true
    on conflict (pack_id, product_id) do update
    set
      sort_order = excluded.sort_order,
      quantity = excluded.quantity,
      selected_by_default = excluded.selected_by_default;
  end if;
end $$;
