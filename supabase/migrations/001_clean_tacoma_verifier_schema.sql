-- Driveline Auto / Tacoma Verifier clean schema
-- Supabase project: fwfsbeeamszwfiwvrfuz
-- Project URL: https://fwfsbeeamszwfiwvrfuz.supabase.co

create extension if not exists pgcrypto;

do $$
begin
  create type public.fitment_risk as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.subscription_plan as enum ('free', 'builder', 'pro_garage');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.verified_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,

  year integer not null check (year between 1995 and 2035),
  make text not null default 'Toyota',
  model text not null default 'Tacoma',
  trim text,
  cab text,
  bed text,

  tire_size text not null,
  wheel_size text,
  wheel_offset integer,
  lift_height numeric(4, 2),
  suspension_setup text,

  rubbing_severity text,
  trimming_required boolean,
  body_mount_chop boolean,
  fitment_risk public.fitment_risk not null default 'medium',
  notes text,

  owner_name text,
  source_url text,
  published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verified_build_photos (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references public.verified_builds(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fitment_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  input jsonb not null,
  report jsonb not null,
  overall_verdict text not null,
  rubbing_risk public.fitment_risk not null,
  trimming_likely boolean not null,
  body_mount_chop_likely boolean not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  status text not null default 'active',
  fitment_check_limit integer not null default 3,
  fitment_checks_used integer not null default 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan public.subscription_plan not null default 'free',
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fitment_form_options (
  id uuid primary key default gen_random_uuid(),
  field text not null,
  label text not null,
  value text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (field, value)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_verified_builds_updated_at on public.verified_builds;
create trigger set_verified_builds_updated_at
before update on public.verified_builds
for each row execute function public.set_updated_at();

drop trigger if exists set_verified_build_photos_updated_at on public.verified_build_photos;
create trigger set_verified_build_photos_updated_at
before update on public.verified_build_photos
for each row execute function public.set_updated_at();

drop trigger if exists set_fitment_assessments_updated_at on public.fitment_assessments;
create trigger set_fitment_assessments_updated_at
before update on public.fitment_assessments
for each row execute function public.set_updated_at();

drop trigger if exists set_user_plans_updated_at on public.user_plans;
create trigger set_user_plans_updated_at
before update on public.user_plans
for each row execute function public.set_updated_at();

drop trigger if exists set_stripe_customers_updated_at on public.stripe_customers;
create trigger set_stripe_customers_updated_at
before update on public.stripe_customers
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_fitment_form_options_updated_at on public.fitment_form_options;
create trigger set_fitment_form_options_updated_at
before update on public.fitment_form_options
for each row execute function public.set_updated_at();

alter table public.verified_builds enable row level security;
alter table public.verified_build_photos enable row level security;
alter table public.fitment_assessments enable row level security;
alter table public.user_plans enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.fitment_form_options enable row level security;

drop policy if exists "Published verified builds are public" on public.verified_builds;
create policy "Published verified builds are public"
on public.verified_builds
for select
to anon, authenticated
using (published = true);

drop policy if exists "Published build photos are public" on public.verified_build_photos;
create policy "Published build photos are public"
on public.verified_build_photos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.verified_builds
    where verified_builds.id = verified_build_photos.build_id
      and verified_builds.published = true
  )
);

drop policy if exists "Authenticated users can create their own assessments" on public.fitment_assessments;
create policy "Authenticated users can create their own assessments"
on public.fitment_assessments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own assessments" on public.fitment_assessments;
create policy "Users can read their own assessments"
on public.fitment_assessments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own plan" on public.user_plans;
create policy "Users can read their own plan"
on public.user_plans
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own Stripe customer" on public.stripe_customers;
create policy "Users can read their own Stripe customer"
on public.stripe_customers
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own subscriptions" on public.subscriptions;
create policy "Users can read their own subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Active fitment form options are public" on public.fitment_form_options;
create policy "Active fitment form options are public"
on public.fitment_form_options
for select
to anon, authenticated
using (active = true);

create index if not exists verified_builds_public_idx
on public.verified_builds (published, created_at desc);

create index if not exists verified_builds_fitment_idx
on public.verified_builds (year, make, model, trim, tire_size, wheel_offset, lift_height);

create index if not exists verified_build_photos_build_idx
on public.verified_build_photos (build_id, sort_order);

create index if not exists fitment_assessments_user_created_idx
on public.fitment_assessments (user_id, created_at desc);

create index if not exists subscriptions_user_status_idx
on public.subscriptions (user_id, status);

create index if not exists subscriptions_stripe_customer_idx
on public.subscriptions (stripe_customer_id);

create index if not exists fitment_form_options_field_idx
on public.fitment_form_options (field, sort_order)
where active = true;
