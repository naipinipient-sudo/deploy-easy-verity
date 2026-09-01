-- PRD 8.9 wants saved views for Explore (filters, columns, pivot/chart
-- config) but the original migrations never created a table for it.
CREATE TABLE public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('dataset_version', 'master_version')),
  source_id UUID NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views TO authenticated;
GRANT ALL ON public.saved_views TO service_role;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_views_select" ON public.saved_views
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "saved_views_insert" ON public.saved_views
  FOR INSERT TO authenticated WITH CHECK (public.can_write_workspace(workspace_id));
CREATE POLICY "saved_views_update" ON public.saved_views
  FOR UPDATE TO authenticated USING (public.can_write_workspace(workspace_id)) WITH CHECK (public.can_write_workspace(workspace_id));
CREATE POLICY "saved_views_delete" ON public.saved_views
  FOR DELETE TO authenticated USING (public.can_write_workspace(workspace_id));
