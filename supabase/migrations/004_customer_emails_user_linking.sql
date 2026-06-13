alter table public.customer_emails
  add column if not exists user_id uuid null references auth.users (id) on delete set null,
  add column if not exists plan text,
  add column if not exists stripe_customer_id text,
  add column if not exists converted_at timestamptz;

update public.customer_emails ce
set user_id = au.id
from auth.users au
where ce.user_id is null
  and lower(ce.email) = lower(au.email);
