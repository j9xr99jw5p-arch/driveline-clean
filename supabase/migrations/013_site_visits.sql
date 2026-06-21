create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text,
  user_agent text,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists site_visits_created_at_idx on public.site_visits(created_at desc);
create index if not exists site_visits_path_idx on public.site_visits(path);
create index if not exists site_visits_user_id_idx on public.site_visits(user_id);

alter table public.site_visits enable row level security;

drop policy if exists "Public can insert site visits" on public.site_visits;
create policy "Public can insert site visits"
on public.site_visits
for insert
with check (true);

grant insert on public.site_visits to anon, authenticated;
