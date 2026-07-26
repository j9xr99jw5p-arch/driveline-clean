create index if not exists verified_builds_fitment_match_idx
  on public.verified_builds (
    year,
    tire_size,
    wheel_offset,
    wheel_width,
    lift_height
  )
  where published = true;
