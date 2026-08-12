-- Public bucket for piece images. Rooms store https URLs instead of
-- base64 data URLs so PATCH bodies stay under Vercel's ~4.5 MB limit.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-images',
  'room-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read room-images" on storage.objects;
create policy "Public read room-images"
  on storage.objects for select
  to public
  using (bucket_id = 'room-images');
