create table if not exists public.starter_pack_checkout_selections (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text unique,
  pack_id uuid references public.packs(id) on delete set null,
  pack_slug text not null,
  items jsonb not null,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default (now() + interval '7 days')
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  stripe_checkout_session_id text not null,
  stripe_line_item_id text unique,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  stripe_price_id text,
  product_name text,
  variant_name text,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount integer,
  amount_subtotal integer,
  amount_total integer,
  currency text,
  created_at timestamp with time zone default now()
);

create index if not exists starter_pack_checkout_selections_session_idx
  on public.starter_pack_checkout_selections(stripe_checkout_session_id);

create index if not exists starter_pack_checkout_selections_expires_at_idx
  on public.starter_pack_checkout_selections(expires_at);

create index if not exists order_items_order_id_idx
  on public.order_items(order_id);

create index if not exists order_items_checkout_session_idx
  on public.order_items(stripe_checkout_session_id);

alter table public.starter_pack_checkout_selections enable row level security;
alter table public.order_items enable row level security;

revoke all on public.starter_pack_checkout_selections from anon, authenticated;
revoke all on public.order_items from anon, authenticated;

comment on table public.starter_pack_checkout_selections is
  'Server-written checkout selections used by Stripe webhook order-item mapping. Delete expired rows where expires_at < now() after webhook retention needs are met.';
