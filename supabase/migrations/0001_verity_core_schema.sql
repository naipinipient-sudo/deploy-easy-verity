-- Verity core schema: workspaces, datasets, versions, audit trail.
-- Run this once in the Supabase SQL Editor of a fresh project.

-- Workspaces: top-level tenant
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  timezone text not null default 'UTC',
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','editor','analyst','viewer')),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Datasets: an uploaded source (append-only versions)
create table datasets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  source_type text not null default 'upload',
  current_version_id uuid,
  status text not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Dataset versions: immutable per import, carries schema profile + mapping
create table dataset_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  version_number int not null,
  file_path text not null,
  file_name text not null,
  checksum text not null,
  sheet_name text,
  row_count int not null,
  schema_profile jsonb not null,
  mapping jsonb,
  mapping_confirmed boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (dataset_id, version_number)
);

alter table datasets
  add constraint datasets_current_version_fk
  foreign key (current_version_id) references dataset_versions(id);

-- Audit trail for material actions
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  object_type text not null,
  object_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- Helper: is the current user a member of this workspace (any role)?
create function is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and status = 'active'
  );
$$;

-- Helper: can the current user write (upload/map) in this workspace?
create function can_write_workspace(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
      and status = 'active' and role in ('owner','admin','editor')
  );
$$;

-- Atomically create a workspace + owner membership
create function create_workspace(ws_name text)
returns workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ws workspaces;
begin
  insert into workspaces (name, owner_id) values (ws_name, auth.uid())
  returning * into new_ws;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_ws.id, auth.uid(), 'owner');

  return new_ws;
end;
$$;

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table datasets enable row level security;
alter table dataset_versions enable row level security;
alter table audit_events enable row level security;

create policy "members can read their workspace" on workspaces
  for select using (is_workspace_member(id));

create policy "members can read their membership rows" on workspace_members
  for select using (is_workspace_member(workspace_id));

create policy "members can read datasets" on datasets
  for select using (is_workspace_member(workspace_id));
create policy "writers can insert datasets" on datasets
  for insert with check (can_write_workspace(workspace_id));
create policy "writers can update datasets" on datasets
  for update using (can_write_workspace(workspace_id));

create policy "members can read dataset_versions" on dataset_versions
  for select using (is_workspace_member(workspace_id));
create policy "writers can insert dataset_versions" on dataset_versions
  for insert with check (can_write_workspace(workspace_id));
create policy "writers can update dataset_versions" on dataset_versions
  for update using (can_write_workspace(workspace_id));

create policy "members can read audit_events" on audit_events
  for select using (is_workspace_member(workspace_id));
create policy "writers can insert audit_events" on audit_events
  for insert with check (is_workspace_member(workspace_id));

-- Storage bucket for raw uploads (private, workspace-scoped path convention)
insert into storage.buckets (id, name, public) values ('dataset-uploads', 'dataset-uploads', false);

create policy "members can read their workspace uploads" on storage.objects
  for select using (
    bucket_id = 'dataset-uploads'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );
create policy "writers can upload to their workspace" on storage.objects
  for insert with check (
    bucket_id = 'dataset-uploads'
    and can_write_workspace((storage.foldername(name))[1]::uuid)
  );
