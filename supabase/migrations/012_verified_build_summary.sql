alter table public.verified_builds
add column if not exists build_summary text;
