create table if not exists public.fitment_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  premium_checks_remaining integer not null default 0 check (premium_checks_remaining >= 0),
  premium_build_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fitment_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_delta integer not null,
  transaction_type text not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  fitment_check_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists fitment_credit_transactions_checkout_session_key
  on public.fitment_credit_transactions(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists fitment_credit_transactions_payment_intent_key
  on public.fitment_credit_transactions(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists fitment_credit_transactions_usage_request_key
  on public.fitment_credit_transactions(user_id, request_id)
  where request_id is not null and transaction_type = 'premium_check_used';

create index if not exists fitment_credit_transactions_user_created_idx
  on public.fitment_credit_transactions(user_id, created_at desc);

alter table public.fitment_credit_accounts enable row level security;
alter table public.fitment_credit_transactions enable row level security;

drop policy if exists "Users can read own fitment credit account" on public.fitment_credit_accounts;
create policy "Users can read own fitment credit account"
  on public.fitment_credit_accounts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own fitment credit transactions" on public.fitment_credit_transactions;
create policy "Users can read own fitment credit transactions"
  on public.fitment_credit_transactions
  for select
  using (auth.uid() = user_id);

create or replace function public.touch_fitment_credit_account_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fitment_credit_accounts_touch_updated_at on public.fitment_credit_accounts;
create trigger fitment_credit_accounts_touch_updated_at
  before update on public.fitment_credit_accounts
  for each row
  execute function public.touch_fitment_credit_account_updated_at();

create or replace function public.grant_fitment_credits(
  p_user_id uuid,
  p_credit_delta integer,
  p_premium_build_access boolean,
  p_transaction_type text,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.fitment_credit_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.fitment_credit_accounts;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_credit_delta <= 0 then
    raise exception 'credit_delta must be positive for grants';
  end if;

  insert into public.fitment_credit_transactions (
    user_id,
    credit_delta,
    transaction_type,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    metadata
  )
  values (
    p_user_id,
    p_credit_delta,
    p_transaction_type,
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  insert into public.fitment_credit_accounts (
    user_id,
    premium_checks_remaining,
    premium_build_access
  )
  values (
    p_user_id,
    p_credit_delta,
    p_premium_build_access
  )
  on conflict (user_id)
  do update set
    premium_checks_remaining = public.fitment_credit_accounts.premium_checks_remaining + excluded.premium_checks_remaining,
    premium_build_access = public.fitment_credit_accounts.premium_build_access or excluded.premium_build_access;

  select *
    into v_account
    from public.fitment_credit_accounts
    where user_id = p_user_id;

  return v_account;
end;
$$;

revoke all on function public.grant_fitment_credits(uuid, integer, boolean, text, text, text, jsonb) from public;
revoke all on function public.grant_fitment_credits(uuid, integer, boolean, text, text, text, jsonb) from anon;
revoke all on function public.grant_fitment_credits(uuid, integer, boolean, text, text, text, jsonb) from authenticated;
grant execute on function public.grant_fitment_credits(uuid, integer, boolean, text, text, text, jsonb) to service_role;

create or replace function public.consume_premium_fitment_credit(
  p_user_id uuid,
  p_fitment_check_id uuid default null,
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.fitment_credit_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.fitment_credit_accounts;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_request_id is not null then
    select account.*
      into v_account
      from public.fitment_credit_transactions transaction
      join public.fitment_credit_accounts account on account.user_id = transaction.user_id
      where transaction.user_id = p_user_id
        and transaction.request_id = p_request_id
        and transaction.transaction_type = 'premium_check_used';

    if found then
      return v_account;
    end if;
  end if;

  update public.fitment_credit_accounts
    set premium_checks_remaining = premium_checks_remaining - 1
    where user_id = p_user_id
      and premium_checks_remaining > 0
    returning *
    into v_account;

  if not found then
    raise exception 'No premium fitment checks remaining';
  end if;

  insert into public.fitment_credit_transactions (
    user_id,
    credit_delta,
    transaction_type,
    fitment_check_id,
    request_id,
    metadata
  )
  values (
    p_user_id,
    -1,
    'premium_check_used',
    p_fitment_check_id,
    p_request_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return v_account;
end;
$$;

revoke all on function public.consume_premium_fitment_credit(uuid, uuid, text, jsonb) from public;
revoke all on function public.consume_premium_fitment_credit(uuid, uuid, text, jsonb) from anon;
revoke all on function public.consume_premium_fitment_credit(uuid, uuid, text, jsonb) from authenticated;
grant execute on function public.consume_premium_fitment_credit(uuid, uuid, text, jsonb) to service_role;
