alter table public.products
add column if not exists product_url text,
add column if not exists stripe_product_id text,
add column if not exists inventory_status text default 'unknown',
add column if not exists price_cents integer,
add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.starter_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subtitle text,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.starter_pack_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.starter_packs(id) on delete cascade,
  part_id uuid not null references public.products(id) on delete cascade,
  required boolean not null default false,
  default_selected boolean not null default true,
  recommended_quantity integer not null default 1,
  budget_tier text,
  note text,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'starter_pack_items_recommended_quantity_check'
  ) then
    alter table public.starter_pack_items
    add constraint starter_pack_items_recommended_quantity_check
    check (recommended_quantity between 1 and 10);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'starter_pack_items_budget_tier_check'
  ) then
    alter table public.starter_pack_items
    add constraint starter_pack_items_budget_tier_check
    check (budget_tier is null or budget_tier in ('budget', 'mid', 'premium'));
  end if;
end $$;

create index if not exists starter_packs_active_sort_idx
  on public.starter_packs(active, sort_order);

create index if not exists starter_pack_items_pack_sort_idx
  on public.starter_pack_items(pack_id, sort_order);

create index if not exists starter_pack_items_part_id_idx
  on public.starter_pack_items(part_id);

create unique index if not exists starter_pack_items_pack_part_unique_idx
  on public.starter_pack_items(pack_id, part_id);

alter table public.starter_packs enable row level security;
alter table public.starter_pack_items enable row level security;

drop policy if exists "Public can read active starter packs" on public.starter_packs;
create policy "Public can read active starter packs"
on public.starter_packs
for select
using (active = true);

drop policy if exists "Public can read active starter pack items" on public.starter_pack_items;
create policy "Public can read active starter pack items"
on public.starter_pack_items
for select
using (
  exists (
    select 1
    from public.starter_packs
    join public.products on products.id = starter_pack_items.part_id
    where starter_packs.id = starter_pack_items.pack_id
      and starter_packs.active = true
      and products.active = true
  )
);

grant select on public.starter_packs to anon, authenticated;
grant select on public.starter_pack_items to anon, authenticated;

insert into public.starter_packs (slug, name, subtitle, description, sort_order)
values
  (
    'recovery',
    'Recovery Pack',
    'Basic recovery gear for Tacoma owners who want to be prepared before they get stuck.',
    'Pick the recovery parts you still need, skip the ones you already own, and check out with only the useful upgrades.',
    0
  ),
  (
    'lighting',
    'Lighting Pack',
    'Simple lighting upgrades that improve visibility without going overboard.',
    'Pick practical lighting upgrades without overbuilding the truck.',
    10
  ),
  (
    'storage',
    'Storage Pack',
    'Practical storage and utility parts for keeping gear organized on trips.',
    'Pick storage and utility upgrades that make packing, repairs, and weekend trips easier.',
    20
  ),
  (
    'appearance',
    'Appearance Pack',
    'Affordable exterior upgrades that clean up the look of the truck without hurting daily drivability.',
    'Pick simple exterior upgrades that improve the truck without compromising daily use.',
    30
  )
on conflict (slug) do update
set
  name = excluded.name,
  subtitle = excluded.subtitle,
  description = excluded.description,
  sort_order = excluded.sort_order;

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
  inventory_status
)
values
  (
    'ovs-brute-tow-strap-40000-lb',
    'OVS Brute Tow Strap 40,000 lb',
    'Overland Vehicle Systems',
    'Recovery',
    'Overland Vehicle Systems provides professional-grade recovery tow straps designed to perform in any situation. Rated to 40,000 lbs, these straps are built for pulling a stuck vehicle out of mud, sand, or snow with maximum safety and reliability. Constructed from high-quality tightly woven synthetic fiber with reinforced double-stitched loops and protective sleeves. Specs: 40,000 LB - 4" x 8''.',
    'https://cdn11.bigcommerce.com/s-707pax8i4u/images/stencil/1920w/attribute_rule_images/409_source_1765411725.jpg',
    null,
    'https://overlandvehiclesystems.com/brute-tow-straps',
    'https://overlandvehiclesystems.com/brute-tow-straps',
    'https://overlandvehiclesystems.com/brute-tow-straps',
    'price_1TmhBnAxOgxntpwRFSJteEhA',
    true,
    'in_stock'
  ),
  (
    'ovs-soft-shackle-recovery-ring-combo',
    'OVS Soft Shackle and Recovery Ring Combo',
    'Overland Vehicle Systems',
    'Recovery',
    'OVS Soft Shackle Combo Kit containing a 7/16" 41,000 lb soft shackle with loop and abrasive sleeve plus a 4.00" 41,000 lb recovery ring. A safe, lightweight recovery setup for overland and off-road rigs, with storage bags included.',
    'https://cdn11.bigcommerce.com/s-707pax8i4u/images/stencil/1920w/products/332/11042/19-4716__73329.1733865849.jpg?c=2',
    null,
    'https://overlandvehiclesystems.com/combo-pack-soft-shackle-7-16-41-000-lb-and-recovery-ring-4-0-41-000-lb/',
    'https://overlandvehiclesystems.com/combo-pack-soft-shackle-7-16-41-000-lb-and-recovery-ring-4-0-41-000-lb/',
    'https://overlandvehiclesystems.com/combo-pack-soft-shackle-7-16-41-000-lb-and-recovery-ring-4-0-41-000-lb/',
    'price_1TmhPSAxOgxntpwRI5xmI5Tx',
    true,
    'in_stock'
  ),
  (
    'ovs-receiver-mount-recovery-shackle',
    'OVS Receiver Mount Recovery Shackle',
    'Overland Vehicle Systems',
    'Recovery',
    'Receiver Mount Recovery Shackle with 3/4" 4.75 ton rating, dual-hole design, and black powder coat finish. A practical hitch recovery point for off-road recovery setups.',
    'https://cdn11.bigcommerce.com/s-707pax8i4u/images/stencil/1920w/products/273/10932/19109901__67202.1722291690.jpg?c=2',
    null,
    'https://overlandvehiclesystems.com/receiver-mount-recovery-shackle-3-4-4-75-ton-with-dual-hole-black-universal/',
    'https://overlandvehiclesystems.com/receiver-mount-recovery-shackle-3-4-4-75-ton-with-dual-hole-black-universal/',
    'https://overlandvehiclesystems.com/receiver-mount-recovery-shackle-3-4-4-75-ton-with-dual-hole-black-universal/',
    'price_1TmhTQAxOgxntpwRhSEY4rtC',
    true,
    'in_stock'
  ),
  (
    'ovs-off-road-bottle-jack',
    'OVS Off-Road Bottle Jack',
    'Overland Vehicle Systems',
    'Recovery',
    '15-piece off-road bottle jack kit with 6 ton bottle jack, lift extensions, adjustable 8.5" to 37 3/4" lift height, axle and frame saddle options, oversized bolt-on base, ergonomic handle, jack stem isolator, mounting tool, and canvas organizer bag.',
    'https://cdn11.bigcommerce.com/s-707pax8i4u/images/stencil/1280x1280/products/1161/14517/Bottle_Jack_Web_Presentation__35803.1761872766.jpg?c=2',
    null,
    'https://overlandvehiclesystems.com/bottle-jack/',
    'https://overlandvehiclesystems.com/bottle-jack/',
    'https://overlandvehiclesystems.com/bottle-jack/',
    'price_1TmhWJAxOgxntpwRm4JD7JQw',
    true,
    'in_stock'
  )
on conflict (slug) do update
set
  name = excluded.name,
  brand = excluded.brand,
  category = excluded.category,
  description = excluded.description,
  image_url = excluded.image_url,
  affiliate_url = excluded.affiliate_url,
  product_url = excluded.product_url,
  order_url = excluded.order_url,
  stripe_price_id = excluded.stripe_price_id,
  active = excluded.active,
  inventory_status = excluded.inventory_status,
  updated_at = now();

insert into public.starter_pack_items (
  pack_id,
  part_id,
  required,
  default_selected,
  recommended_quantity,
  budget_tier,
  note,
  sort_order
)
select
  starter_packs.id,
  products.id,
  false,
  true,
  1,
  'budget',
  case
    when products.slug = 'ovs-brute-tow-strap-40000-lb' then 'Basic recovery strap for safe pulls in mud, sand, or snow.'
    when products.slug = 'ovs-soft-shackle-recovery-ring-combo' then 'Lightweight soft shackle and ring combo for safer recovery points.'
    when products.slug = 'ovs-receiver-mount-recovery-shackle' then 'Adds a practical receiver hitch recovery point.'
    when products.slug = 'ovs-off-road-bottle-jack' then 'Useful for trail repairs and controlled lifting when a standard jack is not enough.'
    else 'Recovery basics that belong in the truck before cosmetic upgrades.'
  end,
  case
    when products.slug ilike '%board%' then 10
    when products.slug = 'ovs-brute-tow-strap-40000-lb' then 20
    when products.slug = 'ovs-soft-shackle-recovery-ring-combo' then 30
    when products.slug = 'ovs-receiver-mount-recovery-shackle' then 40
    when products.slug = 'ovs-off-road-bottle-jack' then 50
    else 90
  end
from public.starter_packs
cross join public.products
where starter_packs.slug = 'recovery'
  and lower(trim(products.category)) = 'recovery'
  and products.active = true
on conflict (pack_id, part_id) do update
set
  default_selected = excluded.default_selected,
  recommended_quantity = excluded.recommended_quantity,
  budget_tier = excluded.budget_tier,
  note = excluded.note,
  sort_order = excluded.sort_order;
