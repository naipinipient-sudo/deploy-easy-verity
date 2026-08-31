-- Raw file preservation (PRD 8.2): the core schema stores parsed rows as
-- JSONB, but the original uploaded file should stay available as evidence.
insert into storage.buckets (id, name, public) values ('dataset-uploads', 'dataset-uploads', false);

create policy "members can read their workspace uploads" on storage.objects
  for select using (
    bucket_id = 'dataset-uploads'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
create policy "writers can upload to their workspace" on storage.objects
  for insert with check (
    bucket_id = 'dataset-uploads'
    and public.can_write_workspace((storage.foldername(name))[1]::uuid)
  );
