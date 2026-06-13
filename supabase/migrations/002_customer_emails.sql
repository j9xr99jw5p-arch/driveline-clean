create table if not exists public.customer_emails (
  email text primary key,
  user_id uuid null references auth.users (id) on delete set null,
  source text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.customer_emails enable row level security;
