-- Credit balances for the shift from check-count billing to spendable credits.
-- reserve_credits / refund_credits lock the balance row so two jobs cannot
-- spend the same credits at once.

create table if not exists public.mod_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.mod_requests enable row level security;

create table if not exists public.credit_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mod_request_id uuid references public.mod_requests(id) on delete set null,
  amount integer not null,
  type text not null check (type in ('purchase', 'reserve', 'charge', 'refund', 'admin_grant')),
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_created_idx
  on public.credit_transactions(user_id, created_at desc);

create index if not exists credit_transactions_mod_request_idx
  on public.credit_transactions(mod_request_id)
  where mod_request_id is not null;

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

-- No insert/update/delete policies: authenticated users cannot write.
-- The service role bypasses RLS.

create or replace function public.touch_credit_balance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists credit_balances_touch_updated_at on public.credit_balances;
create trigger credit_balances_touch_updated_at
  before update on public.credit_balances
  for each row
  execute function public.touch_credit_balance_updated_at();

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

revoke all on function public.reserve_credits(uuid, integer, uuid) from public;
revoke all on function public.reserve_credits(uuid, integer, uuid) from anon;
revoke all on function public.reserve_credits(uuid, integer, uuid) from authenticated;
grant execute on function public.reserve_credits(uuid, integer, uuid) to service_role;

revoke all on function public.refund_credits(uuid, integer, uuid) from public;
revoke all on function public.refund_credits(uuid, integer, uuid) from anon;
revoke all on function public.refund_credits(uuid, integer, uuid) from authenticated;
grant execute on function public.refund_credits(uuid, integer, uuid) to service_role;
