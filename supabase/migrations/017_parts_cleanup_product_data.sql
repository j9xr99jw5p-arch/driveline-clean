update public.products
set category = 'Lighting'
where lower(trim(category)) in ('light', 'lights', 'lighting', 'offroad lighting', 'off-road lighting');

update public.products
set image_url = 'https://realtruck.com/production/gorilla-spline-closed-end-et-5lug-chrome-01/r/800x600/fff/80/4e4e5bd520786e71b41e72e5c09f3215.jpg'
where name = 'Spline Drive - Chrome';

with existing_grille as (
  select id, image_url
  from public.products
  where name = 'TRD Style Front Grille'
  limit 1
),
updated_grille as (
  update public.products
  set
    image_url = 'https://www.srqfabrications.com/cdn/shop/files/srq-fabrications-exterior-default-title-16-23-3rd-gen-tacoma-trd-grille-42709852193090_1066x.jpg',
    order_url = 'https://www.srqfabrications.com/products/16-24-3rd-gen-tacoma-trd-grille?glid=CjwKCAjw3ejRBhAdEiwADkqPn6lasuIQjEeW25WwEl1vtGDcQbgqqQpBPU1xSsz6lNCj5uXtRPCtqRoCijoQAvD_BwE&utm_source=google&utm_medium=cpc&utm_campaign=21083305172&utm_content=160437797995_692998669142&utm_term=&matchtype=&device=c&cmp_id=21083305172&adg_id=160437797995&kwd=&wickedsource=google&wickedid=CjwKCAjw3ejRBhAdEiwADkqPn6lasuIQjEeW25WwEl1vtGDcQbgqqQpBPU1xSsz6lNCj5uXtRPCtqRoCijoQAvD_BwE&w_adid=692998669142&w_campaignid=21083305172&wickedsource=google&wickedid=CjwKCAjw3ejRBhAdEiwADkqPn6lasuIQjEeW25WwEl1vtGDcQbgqqQpBPU1xSsz6lNCj5uXtRPCtqRoCijoQAvD_BwE&w_adid=692998669142&w_campaignid=21083305172&gad_source=1&gad_campaignid=21083305172&gbraid=0AAAAAC_Twwu1ptLPlRrqiYlX4Ov0C0Oat&gclid=CjwKCAjw3ejRBhAdEiwADkqPn6lasuIQjEeW25WwEl1vtGDcQbgqqQpBPU1xSsz6lNCj5uXtRPCtqRoCijoQAvD_BwE'
  where name = 'TRD Style Front Grille'
  returning id
)
insert into public.product_images (product_id, url, alt_text, sort_order)
select
  existing_grille.id,
  image.url,
  image.alt_text,
  image.sort_order
from existing_grille
cross join lateral (
  values
    ('https://www.srqfabrications.com/cdn/shop/files/srq-fabrications-exterior-default-title-16-23-3rd-gen-tacoma-trd-grille-42709852193090_1066x.jpg', 'TRD Style Front Grille primary product image', 0),
    (existing_grille.image_url, 'TRD Style Front Grille secondary product image', 1)
) as image(url, alt_text, sort_order)
where image.url is not null
on conflict (product_id, url) do update
set
  alt_text = excluded.alt_text,
  sort_order = excluded.sort_order;

update public.products
set order_url = 'https://www.diodedynamics.com/stage-series-30-white-light-bar.html?gad_source=1&gad_campaignid=22212218082&gbraid=0AAAAADEIEYhg9e_ryVFfOOQD6X34nV6Q6&gclid=CjwKCAjw3ejRBhAdEiwADkqPnyQIm7UbHqgnUMohh-Pcd5k_Nq5TLyDYXCOySYAuPSkg6Gg8F2clvxoCwYoQAvD_BwE'
where name = 'Diode Dynamics Stage Series 30 Inch Light Bar';
