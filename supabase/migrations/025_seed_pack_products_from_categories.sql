with target_packs(category_name, pack_slug) as (
  values
    ('recovery', 'recovery'),
    ('lighting', 'lighting'),
    ('storage', 'storage'),
    ('appearance', 'appearance')
),
categorized_products as (
  select
    packs.id as pack_id,
    products.id as product_id,
    row_number() over (
      partition by packs.id
      order by products.name, products.id
    ) - 1 as sort_order
  from public.products
  join target_packs
    on lower(trim(products.category)) = target_packs.category_name
  join public.packs
    on packs.slug = target_packs.pack_slug
  where products.active = true
    and packs.active = true
)
insert into public.pack_products (
  pack_id,
  product_id,
  sort_order,
  quantity,
  selected_by_default
)
select
  pack_id,
  product_id,
  sort_order,
  1,
  true
from categorized_products
on conflict (pack_id, product_id) do update
set
  sort_order = excluded.sort_order,
  quantity = coalesce(public.pack_products.quantity, excluded.quantity),
  selected_by_default = coalesce(public.pack_products.selected_by_default, excluded.selected_by_default);
