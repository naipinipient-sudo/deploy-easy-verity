-- One-time helper: run this ONCE in the Supabase SQL Editor of the
-- eoqbqklfvddegdqzkxax project to replace the old hand-rolled schema
-- with the Lovable-generated one (full PRD data model) plus the raw-file
-- storage bucket. Not a migration file itself -- the migrations/ folder
-- is the source of truth going forward.

-- 1) Drop the old schema (from the first scaffold)
drop table if exists audit_events cascade;
drop table if exists dataset_versions cascade;
drop table if exists datasets cascade;
drop table if exists workspace_members cascade;
drop table if exists workspaces cascade;
drop function if exists create_workspace(text) cascade;
drop function if exists can_write_workspace(uuid) cascade;
drop function if exists is_workspace_member(uuid) cascade;
drop policy if exists "members can read their workspace uploads" on storage.objects;
drop policy if exists "writers can upload to their workspace" on storage.objects;
delete from storage.buckets where id = 'dataset-uploads';

-- 2) Lovable's core schema (supabase/migrations/20260831092731_*.sql)
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- roles
CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','analyst','viewer');

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = _workspace_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = _workspace_id AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin','editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = _workspace_id AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin')
  );
$$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id));
CREATE POLICY "ws_insert" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ws_update" ON public.workspaces FOR UPDATE TO authenticated USING (public.is_workspace_admin(id)) WITH CHECK (public.is_workspace_admin(id));
CREATE POLICY "ws_delete" ON public.workspaces FOR DELETE TO authenticated USING (owner_id = auth.uid());

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "wm_insert_self_owner" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
    OR public.is_workspace_admin(workspace_id)
  );
CREATE POLICY "wm_update" ON public.workspace_members FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id)) WITH CHECK (public.is_workspace_admin(workspace_id));
CREATE POLICY "wm_delete" ON public.workspace_members FOR DELETE TO authenticated USING (public.is_workspace_admin(workspace_id));

-- datasets
CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'upload',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL DEFAULT 1,
  file_name TEXT NOT NULL,
  sheet_name TEXT,
  checksum TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapping_confirmed BOOLEAN NOT NULL DEFAULT false,
  parse_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dataset_rows (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw JSONB NOT NULL,
  normalized JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_dataset_rows_version ON public.dataset_rows(version_id, row_index);

CREATE TABLE public.quality_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  field TEXT,
  message TEXT NOT NULL,
  impacted_rows INTEGER NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.compare_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  left_version_id UUID NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  right_version_id UUID NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  left_version_id UUID NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  right_version_id UUID NOT NULL REFERENCES public.dataset_versions(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  left_row JSONB,
  right_row JSONB,
  score NUMERIC NOT NULL DEFAULT 0,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  state TEXT NOT NULL DEFAULT 'proposed',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  note TEXT
);
CREATE INDEX idx_recon_items_run ON public.reconciliation_items(run_id);

CREATE TABLE public.master_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.master_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  master_id UUID NOT NULL REFERENCES public.master_datasets(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL DEFAULT 1,
  inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  build_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.master_rows (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  master_version_id UUID NOT NULL REFERENCES public.master_versions(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  data JSONB NOT NULL,
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_master_rows_version ON public.master_rows(master_version_id, row_index);

CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_ws ON public.audit_events(workspace_id, created_at DESC);

CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  prompt TEXT NOT NULL,
  response TEXT,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['datasets','dataset_versions','dataset_rows','quality_findings','compare_runs','reconciliation_runs','reconciliation_items','master_datasets','master_versions','master_rows','audit_events','ai_conversations']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_workspace(workspace_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated USING (public.can_write_workspace(workspace_id)) WITH CHECK (public.can_write_workspace(workspace_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated USING (public.can_write_workspace(workspace_id))', t, t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3) Permission tightening (supabase/migrations/20260831092814_*.sql)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_workspace(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_workspace(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated;

-- 4) Raw file storage bucket (supabase/migrations/20260831110000_*.sql)
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

-- 5) file_path column (supabase/migrations/20260831110100_*.sql)
alter table public.dataset_versions add column file_path text;
