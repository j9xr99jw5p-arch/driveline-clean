alter table public.products
add column if not exists specs jsonb not null default '{}'::jsonb,
add column if not exists install_url text;

update public.products
set
  description = 'Morimoto XB Evo fog lights for 2016-2023 Toyota Tacoma trucks. A clean fog-light upgrade for better bad-weather visibility without overbuilding the truck.',
  install_url = 'https://www.morimotohid.com/core/media/media.nl?id=22902275&c=5129608&h=fe0YsWOvVx2_rcZeb1rkCZ9pV35LBOO_UeeM3zyuRvLV7Kx4',
  specs = jsonb_build_object(
    'Fitment', '2016-2023 Toyota Tacoma',
    'Light type', 'LED fog lights',
    'Lens color', 'Amber',
    'Connectors', 'H11/H9/H8',
    'Included', 'Pair of Type T XB Evo fog lights, Philips head mounting screws, connectors',
    'Optional add-ons', 'Dielectric grease, Yellow Lamin-X protective film',
    'Best for', 'Bad weather, dust, fog, rain, and daily driving'
  )
where slug = 'morimoto-tacoma-xb-evo-amber-fog-lights';

update public.products
set
  description = 'Morimoto XB LED Bed Lights add useful bed visibility with an OEM-plus fit and finish. They are a practical lighting upgrade for loading gear, camping, and late-night trail stops.',
  specs = jsonb_build_object(
    'Fitment', 'Toyota Tacoma',
    'Light type', 'LED bed lights',
    'Lens material', 'UV-coated polycarbonate',
    'LED technology', 'Osram LEDs',
    'Install', 'Plug-and-play',
    'Factory connection', 'Connects to factory connectors',
    'Best for', 'Bed visibility, camping, loading gear, and trail use'
  )
where slug = 'morimoto-tacoma-xb-led-bed-lights';
