alter table public.verified_builds
add column if not exists wheel_brand text,
add column if not exists wheel_model text,
add column if not exists wheel_width numeric,
add column if not exists wheel_diameter integer,
add column if not exists tire_brand text,
add column if not exists tire_model text,
add column if not exists suspension_brand text,
add column if not exists suspension_model text,
add column if not exists suspension_type text;
