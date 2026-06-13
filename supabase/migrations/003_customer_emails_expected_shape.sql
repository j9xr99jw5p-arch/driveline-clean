create table if not exists public.customer_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text default 'unknown',
  plan text,
  created_at timestamptz default now()
);

alter table public.customer_emails
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists email text,
  add column if not exists source text default 'unknown',
  add column if not exists plan text,
  add column if not exists created_at timestamptz default now();

alter table public.customer_emails
  alter column email set not null;

create unique index if not exists customer_emails_email_key
  on public.customer_emails (email);

create unique index if not exists customer_emails_lower_email_key
  on public.customer_emails (lower(email));
