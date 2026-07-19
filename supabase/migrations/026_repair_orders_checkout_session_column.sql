alter table public.orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists livemode boolean not null default false,
  add column if not exists paid_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_stripe_checkout_session_id_key'
  ) then
    alter table public.orders
      add constraint orders_stripe_checkout_session_id_key unique (stripe_checkout_session_id);
  end if;
end $$;

create index if not exists orders_paid_live_checkout_idx
  on public.orders(stripe_checkout_session_id)
  where status = 'paid' and livemode = true;
