create or replace view public.verified_build_previews as
select
  verified_builds.id,
  verified_builds.year,
  verified_builds.make,
  verified_builds.model,
  primary_photo.url as primary_photo_url,
  primary_photo.alt_text as primary_photo_alt_text
from public.verified_builds
left join lateral (
  select
    verified_build_photos.url,
    verified_build_photos.alt_text
  from public.verified_build_photos
  where verified_build_photos.build_id = verified_builds.id
  order by verified_build_photos.sort_order asc, verified_build_photos.created_at asc
  limit 1
) as primary_photo on true
where verified_builds.published = true;

revoke all on table public.verified_builds from anon;
revoke all on table public.verified_builds from authenticated;
revoke all on table public.verified_builds from public;
revoke all on table public.verified_build_photos from anon;
revoke all on table public.verified_build_photos from authenticated;
revoke all on table public.verified_build_photos from public;
revoke all on table public.verified_build_previews from public;

grant all on table public.verified_builds to service_role;
grant all on table public.verified_build_photos to service_role;
grant select on table public.verified_build_previews to anon;
grant select on table public.verified_build_previews to authenticated;
grant select on table public.verified_build_previews to service_role;
