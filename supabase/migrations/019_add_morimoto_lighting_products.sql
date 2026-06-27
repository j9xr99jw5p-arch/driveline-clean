alter table public.product_variants
add column if not exists dielectric_grease_included boolean,
add column if not exists protective_film_included boolean;

drop index if exists public.product_variants_product_price_unique_idx;

create index if not exists product_variants_product_price_idx
  on public.product_variants(product_id, stripe_price_id);

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
    'morimoto-tacoma-xb-evo-amber-fog-lights',
    'Morimoto Amber Fogs',
    'Morimoto',
    'Lighting',
    $$Morimoto XB Evo fog lights for 2016-2023 Toyota Tacoma trucks. Includes one pair of Type T Morimoto XB Evo fog lights, Philips head mounting screws, H11/H9/H8 connectors, and optional Yellow Lamin-X protective film. A practical fog-light upgrade for better bad-weather visibility without overbuilding the truck. Installation instructions: https://www.morimotohid.com/core/media/media.nl?id=22902275&c=5129608&h=fe0YsWOvVx2_rcZeb1rkCZ9pV35LBOO_UeeM3zyuRvLV7Kx4$$,
    'https://www.morimotohid.com/images/Item%20Images/140586.Toyota_Tacoma_XB_Evo_White_Fogs.090.jpg?resizeid=9&resizeh=740&resizew=1109',
    null,
    'https://www.morimotohid.com/toyota-tacoma-16-23-xb-evo-standard-fog-lights_3?quantity=1',
    'https://www.morimotohid.com/toyota-tacoma-16-23-xb-evo-standard-fog-lights_3?quantity=1',
    'https://www.morimotohid.com/toyota-tacoma-16-23-xb-evo-standard-fog-lights_3?quantity=1',
    'price_1Tn3UcAxOgxntpwRHLJbqdqX',
    true,
    'in_stock'
  ),
  (
    'morimoto-tacoma-xb-led-bed-lights',
    'Morimoto XB LED Bed Lights',
    'Morimoto',
    'Lighting',
    $$Morimoto XB LED Bed Lights LFZ12 for Tacoma trucks add useful bed visibility with an OEM-plus fit and finish. They use UV-coated polycarbonate lenses, high-powered Osram LED technology, and a plug-and-play design that connects to factory connectors without modifications, error codes, flickering, hyper-flashing, or radio interference.$$,
    'https://www.morimotohid.com/images/Item%20Images/83776.010.jpg?resizeid=9&resizeh=740&resizew=1109',
    null,
    'https://www.morimotohid.com/20-Tacoma-XB-LED-Bed-Lights_4?quantity=1&utm_medium=cpc&utm_source=google&utm_campaign=16739567751&utm_content=_c_&gclsrc=aw.ds&gad_source=1&gad_campaignid=16752816704&gbraid=0AAAAAoSgE28C0DEqICtotWfuzOYs2hlmi&gclid=CjwKCAjw6f3RBhApEiwAMaCqWYbca-eZcb8OKzgAqxHvz9OuN5NGgrMCHxgDaIYSWcM6iheHbUpBHhoCTlQQAvD_BwE',
    'https://www.morimotohid.com/20-Tacoma-XB-LED-Bed-Lights_4?quantity=1&utm_medium=cpc&utm_source=google&utm_campaign=16739567751&utm_content=_c_&gclsrc=aw.ds&gad_source=1&gad_campaignid=16752816704&gbraid=0AAAAAoSgE28C0DEqICtotWfuzOYs2hlmi&gclid=CjwKCAjw6f3RBhApEiwAMaCqWYbca-eZcb8OKzgAqxHvz9OuN5NGgrMCHxgDaIYSWcM6iheHbUpBHhoCTlQQAvD_BwE',
    'https://www.morimotohid.com/20-Tacoma-XB-LED-Bed-Lights_4?quantity=1&utm_medium=cpc&utm_source=google&utm_campaign=16739567751&utm_content=_c_&gclsrc=aw.ds&gad_source=1&gad_campaignid=16752816704&gbraid=0AAAAAoSgE28C0DEqICtotWfuzOYs2hlmi&gclid=CjwKCAjw6f3RBhApEiwAMaCqWYbca-eZcb8OKzgAqxHvz9OuN5NGgrMCHxgDaIYSWcM6iheHbUpBHhoCTlQQAvD_BwE',
    'price_1Tn3YkAxOgxntpwRkwSwhMgc',
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
  price_cents = excluded.price_cents,
  affiliate_url = excluded.affiliate_url,
  product_url = excluded.product_url,
  order_url = excluded.order_url,
  stripe_price_id = excluded.stripe_price_id,
  active = excluded.active,
  inventory_status = excluded.inventory_status,
  updated_at = now();

delete from public.product_variants
where product_id in (
  select id
  from public.products
  where slug in (
    'morimoto-tacoma-xb-evo-amber-fog-lights',
    'morimoto-tacoma-xb-led-bed-lights'
  )
);

insert into public.product_variants (
  product_id,
  variant_name,
  lens_color,
  dielectric_grease_included,
  protective_film_included,
  stripe_price_id,
  image_url,
  active,
  inventory_status,
  price_cents
)
select
  products.id,
  options.variant_name,
  'Amber',
  options.dielectric_grease_included,
  options.protective_film_included,
  'price_1Tn3UcAxOgxntpwRHLJbqdqX',
  'https://www.morimotohid.com/images/Item%20Images/140586.Toyota_Tacoma_XB_Evo_White_Fogs.090.jpg?resizeid=9&resizeh=740&resizew=1109',
  true,
  'in_stock',
  null
from public.products
cross join (
  values
    ('No grease / No yellow film', false, false),
    ('Dielectric grease / No yellow film', true, false),
    ('No grease / Yellow film', false, true),
    ('Dielectric grease / Yellow film', true, true)
) as options(variant_name, dielectric_grease_included, protective_film_included)
where products.slug = 'morimoto-tacoma-xb-evo-amber-fog-lights';

insert into public.product_variants (
  product_id,
  variant_name,
  light_pattern,
  stripe_price_id,
  image_url,
  active,
  inventory_status,
  price_cents
)
select
  products.id,
  'Standard Tacoma Bed Light Kit',
  'Bed lighting',
  'price_1Tn3YkAxOgxntpwRkwSwhMgc',
  'https://www.morimotohid.com/images/Item%20Images/83776.010.jpg?resizeid=9&resizeh=740&resizew=1109',
  true,
  'in_stock',
  null
from public.products
where products.slug = 'morimoto-tacoma-xb-led-bed-lights';

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
  'mid',
  case
    when products.slug = 'morimoto-tacoma-xb-evo-amber-fog-lights' then 'Useful amber fog upgrade for bad weather, dust, and everyday visibility.'
    when products.slug = 'morimoto-tacoma-xb-led-bed-lights' then 'Practical bed lighting for loading gear, camping, and late-night trail stops.'
    else 'Practical lighting upgrade for beginner Tacoma setups.'
  end,
  case
    when products.slug = 'morimoto-tacoma-xb-evo-amber-fog-lights' then 20
    when products.slug = 'morimoto-tacoma-xb-led-bed-lights' then 30
    else 90
  end
from public.starter_packs
cross join public.products
where starter_packs.slug = 'lighting'
  and products.slug in (
    'morimoto-tacoma-xb-evo-amber-fog-lights',
    'morimoto-tacoma-xb-led-bed-lights'
  )
on conflict (pack_id, part_id) do update
set
  default_selected = excluded.default_selected,
  recommended_quantity = excluded.recommended_quantity,
  budget_tier = excluded.budget_tier,
  note = excluded.note,
  sort_order = excluded.sort_order;
