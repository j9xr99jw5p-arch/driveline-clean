alter table public.products
add column if not exists slug text,
add column if not exists price_cents integer,
add column if not exists affiliate_url text,
add column if not exists product_url text,
add column if not exists order_url text,
add column if not exists inventory_status text default 'unknown',
add column if not exists specs jsonb not null default '{}'::jsonb,
add column if not exists review_sentiment text,
add column if not exists review_summary text,
add column if not exists review_praise jsonb,
add column if not exists review_complaints jsonb,
add column if not exists review_takeaway text,
add column if not exists review_count_analyzed integer,
add column if not exists review_rating_average numeric,
add column if not exists review_rating_breakdown jsonb,
add column if not exists review_source_name text,
add column if not exists review_source_url text;

create unique index if not exists products_slug_unique_idx
  on public.products(slug);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now()
);

create unique index if not exists product_images_product_url_unique_idx
  on public.product_images(product_id, url);

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
  specs,
  review_sentiment,
  review_summary,
  review_praise,
  review_complaints,
  review_takeaway,
  review_count_analyzed,
  review_rating_average,
  review_rating_breakdown,
  review_source_name,
  review_source_url
)
values
  (
    'tacoma-lifestyle-tactical-sun-visor-molle-panel',
    'Tacoma Lifestyle Tactical Sun Visor Molle Panel',
    'Tacoma Lifestyle',
    'Storage',
    'Designed to store essentials in a secure, easy-to-access MOLLE panel while adding storage capacity to your Tacoma. The panel attaches to either sun visor in seconds with integrated straps and velcro, giving you a quick-grab spot for small items on the go.',
    'https://www.tacomalifestyle.com/cdn/shop/products/molle_visor_panel_1987x2400.jpg?v=1663001694',
    null,
    null,
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-lifestyle-sun-visor-tactical-molle-panel',
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-lifestyle-sun-visor-tactical-molle-panel',
    'price_1TqbyhAxOgxntpwRXTVSrgtM',
    true,
    'in_stock',
    jsonb_build_object(
      'Options', 'Color: Red, White, Black; Quantity: 1 pack, 2 pack',
      'Install', 'Integrated straps and velcro',
      'Mounting location', 'Driver or passenger sun visor',
      'Best for', 'Small essentials, quick-access storage, MOLLE organization'
    ),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'tacoma-lifestyle-overland-storage-net',
    'Overland Storage Net',
    'Tacoma Lifestyle',
    'Storage',
    'An attic-style storage net for keeping light items like jackets, hats, gloves, and pillows up and away from passengers or cargo. The net mounts close to the ceiling so it avoids resting on shorter passengers, does not block rear visibility, and keeps the rear window fully operable.',
    'https://www.tacomalifestyle.com/cdn/shop/products/s670351017208873804_p1_i13_w3696_2400x1921.jpg?v=1762198442',
    null,
    null,
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-attic-storage-net',
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-attic-storage-net',
    'price_1Tqc31AxOgxntpwRI39lKaIw',
    true,
    'in_stock',
    jsonb_build_object(
      'Fitment', '2nd and 3rd gen double cab and access cab Tacomas',
      'Included', 'Elastic ceiling attic net, 4 black metal headliner clips, installation instructions',
      'Install', 'Requires removal of rear ceiling handles',
      'Best for', 'Light gear, jackets, hats, gloves, pillows, cabin storage'
    ),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'tacoma-lifestyle-smartphone-door-inserts',
    'Tacoma Lifestyle Smartphone Door Inserts',
    'Tacoma Lifestyle',
    'Storage',
    'Peel-and-stick smartphone door inserts that add a secure place to set your phone or small items in your Tacoma. The kit includes two high-quality black ABS plastic inserts for the driver and passenger side.',
    'https://www.tacomalifestyle.com/cdn/shop/products/B1ABCD64-19A9-47CA-8373-D3D27AE1C7BF_738x740.jpg?v=1762198180',
    null,
    null,
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-lifestyle-smartphone-door-inserts',
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-lifestyle-smartphone-door-inserts',
    'price_1Tqc9zAxOgxntpwRMZY2xJ4Q',
    true,
    'in_stock',
    jsonb_build_object(
      'Included', '2 pack, one insert for driver side and one insert for passenger side',
      'Material', 'High-quality black ABS plastic',
      'Install', 'Peel-and-stick adhesive',
      'Warranty', '2 year warranty',
      'Fitment note', 'Does not fit manual transmission Tacomas'
    ),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'tacoma-lifestyle-center-console-vault-2016-2023',
    'Tacoma Lifestyle Center Console Vault',
    'Tacoma Lifestyle',
    'Storage',
    'Keep valuable items safe and secure with a center console vault engineered for 2016-2023 Toyota Tacoma models. The vault bolts into existing factory holes with no cutting or drilling, uses a 4-digit combination lock, and is made from powder-coated textured black metal.',
    'https://www.tacomalifestyle.com/cdn/shop/files/Tacoma_lifestyle_center_console_vault_934x1401.jpg?v=1722012683',
    null,
    null,
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-lifestyle-center-console-vault-for-tacoma-2016-2023',
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-lifestyle-center-console-vault-for-tacoma-2016-2023',
    'price_1TqcDzAxOgxntpwRhSzrTQGL',
    true,
    'in_stock',
    jsonb_build_object(
      'Fitment', '2016-2023 Toyota Tacoma',
      'Lock type', '4-digit combination lock',
      'Install', 'Bolts into existing factory holes; no cutting or drilling',
      'Finish', 'Powder-coated black textured metal',
      'Included', 'Complete center console vault kit'
    ),
    'very_positive',
    'Owners consistently praise the vault for its easy installation, secure fit, and added peace of mind when storing valuables. Multiple reviewers specifically mention that it fits the 2016-2023 Tacoma center console well and still allows access to the factory plugs.',
    jsonb_build_array(
      'Quick and easy installation',
      'Secure, snug fit',
      'Adds useful hidden storage for valuables',
      'Maintains access to factory console plugs'
    ),
    jsonb_build_array(
      'Combination dial can feel stiff or sticky',
      'Fitment is generation-specific and does not fit 2024+ Tacomas'
    ),
    'A simple, low-effort security upgrade for 2016-2023 Tacoma owners. Installation feedback is consistently positive, and the main complaint is a somewhat stiff combination dial rather than an issue with the vault itself.',
    6,
    4.83,
    jsonb_build_object('5', 5, '4', 1, '3', 0, '2', 0, '1', 0),
    'Tacoma Lifestyle',
    'https://www.tacomalifestyle.com/collections/tacoma-storage/products/tacoma-lifestyle-center-console-vault-for-tacoma-2016-2023'
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
  review_sentiment = excluded.review_sentiment,
  review_summary = excluded.review_summary,
  review_praise = excluded.review_praise,
  review_complaints = excluded.review_complaints,
  review_takeaway = excluded.review_takeaway,
  review_count_analyzed = excluded.review_count_analyzed,
  review_rating_average = excluded.review_rating_average,
  review_rating_breakdown = excluded.review_rating_breakdown,
  review_source_name = excluded.review_source_name,
  review_source_url = excluded.review_source_url,
  updated_at = now();

insert into public.product_variants (
  product_id,
  variant_name,
  stripe_price_id,
  image_url,
  active,
  inventory_status,
  price_cents
)
select
  products.id,
  'Standard',
  products.stripe_price_id,
  products.image_url,
  true,
  'in_stock',
  products.price_cents
from public.products
where products.slug in (
  'tacoma-lifestyle-tactical-sun-visor-molle-panel',
  'tacoma-lifestyle-overland-storage-net',
  'tacoma-lifestyle-smartphone-door-inserts',
  'tacoma-lifestyle-center-console-vault-2016-2023'
)
on conflict (product_id, stripe_price_id) do update
set
  variant_name = excluded.variant_name,
  image_url = excluded.image_url,
  active = excluded.active,
  inventory_status = excluded.inventory_status,
  price_cents = excluded.price_cents,
  updated_at = now();

with image_rows(slug, url, alt_text, sort_order) as (
  values
    ('tacoma-lifestyle-tactical-sun-visor-molle-panel', 'https://www.tacomalifestyle.com/cdn/shop/products/molle_visor_panel_1987x2400.jpg?v=1663001694', 'Tacoma Lifestyle tactical sun visor MOLLE panel installed on a Tacoma visor', 0),
    ('tacoma-lifestyle-tactical-sun-visor-molle-panel', 'https://www.tacomalifestyle.com/cdn/shop/products/image_1438x1789.heic?v=1762198618', 'Tacoma Lifestyle tactical sun visor MOLLE panel product image', 1),
    ('tacoma-lifestyle-overland-storage-net', 'https://www.tacomalifestyle.com/cdn/shop/products/s670351017208873804_p1_i13_w3696_2400x1921.jpg?v=1762198442', 'Overland storage net mounted near the Tacoma ceiling', 0),
    ('tacoma-lifestyle-smartphone-door-inserts', 'https://www.tacomalifestyle.com/cdn/shop/products/B1ABCD64-19A9-47CA-8373-D3D27AE1C7BF_738x740.jpg?v=1762198180', 'Tacoma Lifestyle smartphone door insert in black plastic', 0),
    ('tacoma-lifestyle-smartphone-door-inserts', 'https://www.tacomalifestyle.com/cdn/shop/products/124A0859-C8A1-4A6B-90BD-C00ECAD904BD_794x902.jpg?v=1645570698', 'Tacoma Lifestyle smartphone door inserts installed in Tacoma door pockets', 1),
    ('tacoma-lifestyle-center-console-vault-2016-2023', 'https://www.tacomalifestyle.com/cdn/shop/files/Tacoma_lifestyle_center_console_vault_934x1401.jpg?v=1722012683', 'Tacoma Lifestyle center console vault installed in a Tacoma console', 0),
    ('tacoma-lifestyle-center-console-vault-2016-2023', 'https://www.tacomalifestyle.com/cdn/shop/files/Toyota_Tacoma_center_console_vault_safe_1400x1400.heic?v=1762199449', 'Tacoma Lifestyle center console vault safe product image', 1)
)
insert into public.product_images (
  product_id,
  url,
  alt_text,
  sort_order
)
select
  products.id,
  image_rows.url,
  image_rows.alt_text,
  image_rows.sort_order
from image_rows
join public.products on products.slug = image_rows.slug
on conflict (product_id, url) do update
set
  alt_text = excluded.alt_text,
  sort_order = excluded.sort_order;

delete from public.starter_pack_items
using public.starter_packs, public.products
where starter_pack_items.pack_id = starter_packs.id
  and starter_pack_items.part_id = products.id
  and lower(trim(starter_packs.slug)) in ('storage', 'recovery', 'lighting', 'appearance')
  and lower(trim(products.category)) <> lower(trim(starter_packs.slug));

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
  case products.slug
    when 'tacoma-lifestyle-tactical-sun-visor-molle-panel' then 'Quick-access MOLLE storage for small essentials on either sun visor.'
    when 'tacoma-lifestyle-overland-storage-net' then 'Adds overhead storage for light cabin gear while keeping rear visibility usable.'
    when 'tacoma-lifestyle-smartphone-door-inserts' then 'Simple door-pocket inserts for phones and small items.'
    when 'tacoma-lifestyle-center-console-vault-2016-2023' then 'Hidden console security storage for valuables in 2016-2023 Tacomas.'
    else 'Storage upgrade for keeping Tacoma gear organized.'
  end,
  case products.slug
    when 'tacoma-lifestyle-smartphone-door-inserts' then 10
    when 'tacoma-lifestyle-tactical-sun-visor-molle-panel' then 20
    when 'tacoma-lifestyle-overland-storage-net' then 30
    when 'tacoma-lifestyle-center-console-vault-2016-2023' then 40
    else 90
  end
from public.starter_packs
cross join public.products
where starter_packs.slug = 'storage'
  and lower(trim(products.category)) = lower(trim(starter_packs.slug))
  and products.slug in (
    'tacoma-lifestyle-tactical-sun-visor-molle-panel',
    'tacoma-lifestyle-overland-storage-net',
    'tacoma-lifestyle-smartphone-door-inserts',
    'tacoma-lifestyle-center-console-vault-2016-2023'
  )
on conflict (pack_id, part_id) do update
set
  default_selected = excluded.default_selected,
  recommended_quantity = excluded.recommended_quantity,
  budget_tier = excluded.budget_tier,
  note = excluded.note,
  sort_order = excluded.sort_order;
