do $$
declare
  v_column_name text;
begin
  foreach v_column_name in array array[
    'trim',
    'cab',
    'bed',
    'tire_brand',
    'tire_model',
    'wheel_brand',
    'wheel_model',
    'wheel_offset',
    'lift_height',
    'suspension_setup',
    'suspension_brand',
    'suspension_model',
    'suspension_type',
    'notes',
    'owner_name',
    'source_url'
  ] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'verified_builds'
        and columns.column_name = v_column_name
    ) then
      execute format('alter table public.verified_builds alter column %I drop not null', v_column_name);
    end if;
  end loop;
end $$;
