-- createWorkspace() does `.insert(workspace).select().single()`. Postgres
-- requires a freshly-inserted row to satisfy the table's SELECT policy to
-- return it via RETURNING, but ws_select required workspace membership --
-- which is only inserted in the *next* statement. Owners must be able to
-- see a workspace they own even before their membership row exists.
DROP POLICY IF EXISTS "ws_select" ON public.workspaces;
CREATE POLICY "ws_select" ON public.workspaces FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(id));
