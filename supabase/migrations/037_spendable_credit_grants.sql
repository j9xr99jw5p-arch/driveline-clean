-- Spendable credit grants for the new packs: 12 free on first account,
-- one-time Stripe packs, and the $25 Priority monthly refill.

create table if not exists public.mod_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.credit_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  priority boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mod_request_id uuid references public.mod_requests(id) on delete set null,
  amount integer not null,
  type text not null check (type in ('purchase', 'reserve', 'charge', 'refund', 'admin_grant', 'signup', 'subscription')),
  stripe_checkout_session_id text,
  stripe_invoice_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.credit_balances
  add column if not exists priority boolean not null default false;

alter table public.credit_transactions
  add column if not exists stripe_checkout_session_id text;

alter table public.credit_transactions
  add column if not exists stripe_invoice_id text;

alter table public.credit_transactions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.credit_transactions
  drop constraint if exists credit_transactions_type_check;

alter table public.credit_transactions
  add constraint credit_transactions_type_check
  check (type in ('purchase', 'reserve', 'charge', 'refund', 'admin_grant', 'signup', 'subscription'));

create unique index if not exists credit_transactions_checkout_session_key
  on public.credit_transactions(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists credit_transactions_invoice_key
  on public.credit_transactions(stripe_invoice_id)
  where stripe_invoice_id is not null;

alter table public.credit_balances enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "Users can read own credit balances" on public.credit_balances;
create policy "Users can read own credit balances"
  on public.credit_balances
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own credit transactions" on public.credit_transactions;
create policy "Users can read own credit transactions"
  on public.credit_transactions
  for select
  using (auth.uid() = user_id);

create or replace function public.ensure_starting_credits(
  p_user_id uuid,
  p_amount integer default 12
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do nothing
  returning balance into current_balance;

  if current_balance is not null then
    insert into public.credit_transactions (
      user_id,
      amount,
      type,
      metadata
    )
    values (
      p_user_id,
      p_amount,
      'signup',
      '{"source":"starting_credits"}'::jsonb
    );
  else
    select balance
      into current_balance
      from public.credit_balances
      where user_id = p_user_id;
  end if;

  return current_balance;
end;
$$;

create or replace function public.grant_spendable_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_priority boolean default false,
  p_stripe_checkout_session_id text default null,
  p_stripe_invoice_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_type not in ('purchase', 'subscription', 'admin_grant') then
    raise exception 'invalid grant type';
  end if;

  insert into public.credit_balances (user_id, balance, priority)
  values (p_user_id, 0, false)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (
    user_id,
    amount,
    type,
    stripe_checkout_session_id,
    stripe_invoice_id,
    metadata
  )
  values (
    p_user_id,
    p_amount,
    p_type,
    p_stripe_checkout_session_id,
    p_stripe_invoice_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  update public.credit_balances
     set balance = balance + p_amount,
         priority = credit_balances.priority or p_priority
   where user_id = p_user_id
  returning balance into current_balance;

  return current_balance;
end;
$$;

create or replace function public.set_credit_priority(
  p_user_id uuid,
  p_priority boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  insert into public.credit_balances (user_id, balance, priority)
  values (p_user_id, 0, p_priority)
  on conflict (user_id)
  do update set priority = excluded.priority;
end;
$$;

revoke all on function public.ensure_starting_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.ensure_starting_credits(uuid, integer) to service_role;

revoke all on function public.grant_spendable_credits(uuid, integer, text, boolean, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.grant_spendable_credits(uuid, integer, text, boolean, text, text, jsonb) to service_role;

revoke all on function public.set_credit_priority(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_credit_priority(uuid, boolean) to service_role;

create or replace function public.reserve_credits(
  p_user_id uuid,
  p_amount integer,
  p_mod_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select balance
    into current_balance
    from public.credit_balances
    where user_id = p_user_id
    for update;

  if current_balance is null or current_balance < p_amount then
    return false;
  end if;

  update public.credit_balances
     set balance = current_balance - p_amount
   where user_id = p_user_id;

  insert into public.credit_transactions (
    user_id,
    mod_request_id,
    amount,
    type
  )
  values (
    p_user_id,
    p_mod_request_id,
    -p_amount,
    'reserve'
  );

  return true;
end;
$$;

create or replace function public.refund_credits(
  p_user_id uuid,
  p_amount integer,
  p_mod_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  perform 1
    from public.credit_balances
    where user_id = p_user_id
    for update;

  update public.credit_balances
     set balance = balance + p_amount
   where user_id = p_user_id;

  insert into public.credit_transactions (
    user_id,
    mod_request_id,
    amount,
    type
  )
  values (
    p_user_id,
    p_mod_request_id,
    p_amount,
    'refund'
  );
end;
$$;

revoke all on function public.reserve_credits(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.reserve_credits(uuid, integer, uuid) to service_role;

revoke all on function public.refund_credits(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.refund_credits(uuid, integer, uuid) to service_role;
