alter table public.verified_builds
add column if not exists lighting_upgrades text,
add column if not exists favorite_modifications text;
