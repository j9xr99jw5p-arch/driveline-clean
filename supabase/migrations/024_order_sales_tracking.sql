alter table public.orders
  add column if not exists livemode boolean not null default false,
  add column if not exists paid_at timestamp with time zone;

create index if not exists orders_paid_live_checkout_idx
  on public.orders(stripe_checkout_session_id)
  where status = 'paid' and livemode = true;
