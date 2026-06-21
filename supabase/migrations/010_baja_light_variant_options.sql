alter table public.product_variants
add column if not exists light_pattern text,
add column if not exists harness_included boolean not null default false,
add column if not exists price_cents integer;

update public.product_variants
set light_pattern = coalesce(light_pattern, beam_pattern);

update public.product_variants
set price_cents = case stripe_price_id
  when 'price_1TkUDzAxOgxntpwRJ97keK60' then 251995
  when 'price_1TkUmQAxOgxntpwRkHxLMzbz' then 8995
  when 'price_1TkVCWAxOgxntpwR73QN8vJo' then 20999
  when 'price_1TkVa0AxOgxntpwR6e15v37S' then 50999
  else price_cents
end
where price_cents is null;

drop index if exists public.product_variants_product_price_unique_idx;

create index if not exists product_variants_product_options_idx
  on public.product_variants(product_id, light_pattern, lens_color, harness_included);
