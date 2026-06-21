alter table public.products
add column if not exists slug text,
add column if not exists price_cents integer,
add column if not exists affiliate_url text,
add column if not exists order_url text;

alter table public.product_variants
add column if not exists price_cents integer,
add column if not exists inventory_status text default 'unknown';

create unique index if not exists products_slug_unique_idx
  on public.products(slug);

create unique index if not exists product_variants_product_price_unique_idx
  on public.product_variants(product_id, stripe_price_id);

update public.products
set
  slug = 'weld-racing-aluminum-valve-stem-caps',
  brand = 'Weld Racing',
  category = 'Wheel Hardware',
  description = 'Valve stem caps, standard type, flat, aluminum, silver, set of 5.',
  image_url = 'https://static.summitracing.com/global/images/prod/xlarge/wld-aw12824_qv_xl.jpg',
  price_cents = 1399,
  affiliate_url = null,
  order_url = 'https://www.summitracing.com/parts/wld-aw12824?seid=srese1&ppckw=pmax-gcm&gad_source=1&gad_campaignid=18826007465&gclid=CjwKCAjwl97RBhBWEiwAa9rbXUZ9fVA28qPHJnPo42hCiTg_R7piaGEkXXSq2u6rVH0D_bkGINL6LRoClYMQAvD_BwE',
  stripe_price_id = 'price_1Tku7PAxOgxntpwREO5L7xj5',
  active = true
where name = 'Weld Racing Aluminum Valve Stem Caps';

update public.products
set
  slug = 'gorilla-spline-drive-chrome-lug-nut-kit',
  brand = 'Gorilla Automotive',
  category = 'Wheel Hardware',
  description = 'Chrome spline drive lug nut and wheel lock kit. Length: 1.36 inches. Thread size: 12mm x 1.50. Includes 20 lug nuts, 4 wheel locks, 4 valve stems, and 1 key.',
  image_url = null,
  price_cents = 5499,
  affiliate_url = null,
  order_url = 'https://realtruck.com/p/gorilla-automotive-lug-nuts/gau-k5ces-12150gr/?utm_source=google&utm_medium=cpc&utm_campaign=RT+GA+PMax+ACQ+Promo+Pixis&gad_source=1&gad_campaignid=20238427171&gbraid=0AAAAAD2KksDaNEXCu2WDuxki86tVMGQ5r&gclid=CjwKCAjwl97RBhBWEiwAa9rbXZ209-aTZvx3dcTTLuJGJEr8EnBgncUm7tbKt5rE3eELQuAPpubKmBoCoV8QAvD_BwE',
  stripe_price_id = 'price_1Tku0WAxOgxntpwRZscxi1MX',
  active = true
where name = 'Spline Drive - Chrome';

with product_row as (
  insert into public.products (
    slug,
    name,
    brand,
    category,
    description,
    image_url,
    price_cents,
    affiliate_url,
    order_url,
    stripe_price_id,
    active
  )
  values (
    'weld-racing-aluminum-valve-stem-caps',
    'Weld Racing Aluminum Valve Stem Caps',
    'Weld Racing',
    'Wheel Hardware',
    'Valve stem caps, standard type, flat, aluminum, silver, set of 5.',
    'https://static.summitracing.com/global/images/prod/xlarge/wld-aw12824_qv_xl.jpg',
    1399,
    null,
    'https://www.summitracing.com/parts/wld-aw12824?seid=srese1&ppckw=pmax-gcm&gad_source=1&gad_campaignid=18826007465&gclid=CjwKCAjwl97RBhBWEiwAa9rbXUZ9fVA28qPHJnPo42hCiTg_R7piaGEkXXSq2u6rVH0D_bkGINL6LRoClYMQAvD_BwE',
    null,
    true
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
    order_url = excluded.order_url,
    active = excluded.active,
    updated_at = now()
  returning id
)
insert into public.product_variants (
  product_id,
  variant_name,
  finish,
  stripe_price_id,
  image_url,
  active,
  inventory_status,
  price_cents
)
select
  product_row.id,
  'Standard / Silver',
  'Silver',
  'price_1Tku7PAxOgxntpwREO5L7xj5',
  'https://static.summitracing.com/global/images/prod/xlarge/wld-aw12824_qv_xl.jpg',
  true,
  'in_stock',
  1399
from product_row
on conflict (product_id, stripe_price_id) do update
set
  variant_name = excluded.variant_name,
  finish = excluded.finish,
  image_url = excluded.image_url,
  active = excluded.active,
  inventory_status = excluded.inventory_status,
  price_cents = excluded.price_cents,
  updated_at = now();

with product_row as (
  insert into public.products (
    slug,
    name,
    brand,
    category,
    description,
    image_url,
    price_cents,
    affiliate_url,
    order_url,
    stripe_price_id,
    active
  )
  values (
    'gorilla-spline-drive-chrome-lug-nut-kit',
    'Spline Drive - Chrome',
    'Gorilla Automotive',
    'Wheel Hardware',
    'Chrome spline drive lug nut and wheel lock kit. Length: 1.36 inches. Thread size: 12mm x 1.50. Includes 20 lug nuts, 4 wheel locks, 4 valve stems, and 1 key.',
    null,
    5499,
    null,
    'https://realtruck.com/p/gorilla-automotive-lug-nuts/gau-k5ces-12150gr/?utm_source=google&utm_medium=cpc&utm_campaign=RT+GA+PMax+ACQ+Promo+Pixis&gad_source=1&gad_campaignid=20238427171&gbraid=0AAAAAD2KksDaNEXCu2WDuxki86tVMGQ5r&gclid=CjwKCAjwl97RBhBWEiwAa9rbXZ209-aTZvx3dcTTLuJGJEr8EnBgncUm7tbKt5rE3eELQuAPpubKmBoCoV8QAvD_BwE',
    null,
    true
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
    order_url = excluded.order_url,
    active = excluded.active,
    updated_at = now()
  returning id
)
insert into public.product_variants (
  product_id,
  variant_name,
  finish,
  size,
  stripe_price_id,
  image_url,
  active,
  inventory_status,
  price_cents
)
select
  product_row.id,
  '12mm x 1.50 / Chrome',
  'Chrome',
  '12mm x 1.50',
  'price_1Tku0WAxOgxntpwRZscxi1MX',
  null,
  true,
  'out_of_stock',
  5499
from product_row
on conflict (product_id, stripe_price_id) do update
set
  variant_name = excluded.variant_name,
  finish = excluded.finish,
  size = excluded.size,
  image_url = excluded.image_url,
  active = excluded.active,
  inventory_status = excluded.inventory_status,
  price_cents = excluded.price_cents,
  updated_at = now();
