update public.products
set
  category = 'Lighting',
  updated_at = now()
where slug = 'srq-tacoma-sequential-mirror-signals'
  and category is distinct from 'Lighting';
