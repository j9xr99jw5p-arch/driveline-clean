-- Vehicle year/make/model reference tables for the
-- "Get Verified by Driveline" build submission form.
--
-- These are a CACHE of NHTSA vPIC data (https://vpic.nhtsa.dot.gov/api/),
-- kept current by the sync-vehicle-options Edge Function. The frontend
-- reads these tables directly and never calls NHTSA itself.

create table if not exists public.vehicle_makes (
  id   serial primary key,
  name text unique not null
);

create table if not exists public.vehicle_models (
  id         serial primary key,
  make_id    integer not null references public.vehicle_makes(id) on delete cascade,
  model_name text not null,
  model_year integer not null,
  unique (make_id, model_name, model_year)
);

-- Speeds up the cascading "models for this make + year" query the frontend
-- runs every time someone picks a make and year in the form.
create index if not exists idx_vehicle_models_year_make
  on public.vehicle_models (model_year, make_id);

-- Backs the year dropdown, which reads the distinct model years available.
create index if not exists idx_vehicle_models_year
  on public.vehicle_models (model_year);

-- Read-only reference data: anyone (including anonymous users filling out the
-- form) can select, and nobody can write except the service role used by the
-- sync Edge Function. The service role bypasses RLS, so no insert, update, or
-- delete policy is needed here.
alter table public.vehicle_makes  enable row level security;
alter table public.vehicle_models enable row level security;

drop policy if exists "Public read access to vehicle makes" on public.vehicle_makes;
create policy "Public read access to vehicle makes"
  on public.vehicle_makes for select
  using (true);

drop policy if exists "Public read access to vehicle models" on public.vehicle_models;
create policy "Public read access to vehicle models"
  on public.vehicle_models for select
  using (true);
