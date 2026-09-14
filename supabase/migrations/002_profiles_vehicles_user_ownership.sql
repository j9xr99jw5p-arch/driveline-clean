-- Profiles and garage ownership for Driveline Auto / Tacoma Verifier.
-- Supabase Auth remains the identity source of truth; no public.users table is created.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (user_id) do nothing;

  insert into public.user_plans (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

insert into public.profiles (user_id, display_name, avatar_url)
select
  id,
  coalesce(
    nullif(raw_user_meta_data ->> 'display_name', ''),
    nullif(raw_user_meta_data ->> 'full_name', ''),
    nullif(raw_user_meta_data ->> 'name', ''),
    split_part(email, '@', 1)
  ),
  coalesce(
    nullif(raw_user_meta_data ->> 'avatar_url', ''),
    nullif(raw_user_meta_data ->> 'picture', '')
  )
from auth.users
on conflict (user_id) do nothing;

insert into public.user_plans (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check (year between 1995 and 2035),
  make text not null default 'Toyota',
  model text not null default 'Tacoma',
  trim text not null,
  cab text not null,
  bed text not null,
  current_tire_size text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.vehicles
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists year integer,
  add column if not exists make text default 'Toyota',
  add column if not exists model text default 'Tacoma',
  add column if not exists trim text,
  add column if not exists cab text,
  add column if not exists bed text,
  add column if not exists current_tire_size text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.vehicle_configurations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  tire_size text not null,
  wheel_diameter numeric(4, 1) not null,
  wheel_width numeric(4, 1) not null,
  wheel_offset integer not null,
  lift_height numeric(4, 2) not null,
  use_case text not null,
  rear_load text not null,
  build_goals text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.vehicle_configurations
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete cascade,
  add column if not exists tire_size text,
  add column if not exists wheel_diameter numeric(4, 1),
  add column if not exists wheel_width numeric(4, 1),
  add column if not exists wheel_offset integer,
  add column if not exists lift_height numeric(4, 2),
  add column if not exists use_case text,
  add column if not exists rear_load text,
  add column if not exists build_goals text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_vehicles_updated_at on public.vehicles;
create trigger set_vehicles_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists set_vehicle_configurations_updated_at on public.vehicle_configurations;
create trigger set_vehicle_configurations_updated_at
before update on public.vehicle_configurations
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_configurations enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own vehicles" on public.vehicles;
create policy "Users can read their own vehicles"
on public.vehicles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own vehicles" on public.vehicles;
create policy "Users can insert their own vehicles"
on public.vehicles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own vehicles" on public.vehicles;
create policy "Users can update their own vehicles"
on public.vehicles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own vehicles" on public.vehicles;
create policy "Users can delete their own vehicles"
on public.vehicles
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read configurations for their own vehicles" on public.vehicle_configurations;
create policy "Users can read configurations for their own vehicles"
on public.vehicle_configurations
for select
to authenticated
using (
  exists (
    select 1
    from public.vehicles
    where vehicles.id = vehicle_configurations.vehicle_id
      and vehicles.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert configurations for their own vehicles" on public.vehicle_configurations;
create policy "Users can insert configurations for their own vehicles"
on public.vehicle_configurations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.vehicles
    where vehicles.id = vehicle_configurations.vehicle_id
      and vehicles.user_id = auth.uid()
  )
);

drop policy if exists "Users can update configurations for their own vehicles" on public.vehicle_configurations;
create policy "Users can update configurations for their own vehicles"
on public.vehicle_configurations
for update
to authenticated
using (
  exists (
    select 1
    from public.vehicles
    where vehicles.id = vehicle_configurations.vehicle_id
      and vehicles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.vehicles
    where vehicles.id = vehicle_configurations.vehicle_id
      and vehicles.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete configurations for their own vehicles" on public.vehicle_configurations;
create policy "Users can delete configurations for their own vehicles"
on public.vehicle_configurations
for delete
to authenticated
using (
  exists (
    select 1
    from public.vehicles
    where vehicles.id = vehicle_configurations.vehicle_id
      and vehicles.user_id = auth.uid()
  )
);

create index if not exists profiles_role_idx
on public.profiles (role);

create index if not exists vehicles_user_updated_idx
on public.vehicles (user_id, updated_at desc);

create index if not exists vehicles_user_identity_idx
on public.vehicles (user_id, year, make, model, trim, cab, bed);

create index if not exists vehicle_configurations_vehicle_created_idx
on public.vehicle_configurations (vehicle_id, created_at desc);
