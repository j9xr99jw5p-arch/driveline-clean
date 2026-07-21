insert into public.packs (name, slug, description, sort_order, active)
values (
  'Advanced Pack',
  'advanced',
  'Advanced Tacoma upgrades for experienced installers. These parts may require significant modification, fabrication, wiring, trimming, or fitment work and are not beginner-friendly bolt-on upgrades.',
  40,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = excluded.active;
