import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type WorkspaceMember = Database["public"]["Tables"]["workspace_members"]["Row"];
export type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];

export type WorkspaceWithRole = Workspace & { role: WorkspaceRole };

/** Workspaces the signed-in user is a member of, with their role. */
export async function listWorkspaces(): Promise<WorkspaceWithRole[]> {
  const { data: memberships, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role");
  if (memberError) throw memberError;
  if (!memberships || memberships.length === 0) return [];

  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const roleByWorkspace = new Map(memberships.map((m) => [m.workspace_id, m.role]));
  return (workspaces ?? []).map((w) => ({
    ...w,
    role: roleByWorkspace.get(w.id) ?? ("viewer" as WorkspaceRole),
  }));
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceWithRole | null> {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!workspace) return null;

  const { data: membership, error: memberError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (memberError) throw memberError;

  return { ...workspace, role: (membership?.role ?? "viewer") as WorkspaceRole };
}

export type CreateWorkspaceInput = {
  name: string;
  timezone: string;
  currency: string;
};

/** Creates a workspace, its owner membership, and an audit event. */
export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) throw new Error("You must be signed in to create a workspace.");

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({
      name: input.name.trim(),
      owner_id: user.id,
      timezone: input.timezone,
      currency: input.currency,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });
  if (memberError) throw memberError;

  await supabase.from("audit_events").insert({
    workspace_id: workspace.id,
    actor_id: user.id,
    action: "workspace.created",
    object_type: "workspace",
    object_id: workspace.id,
    details: { name: workspace.name },
  });

  return workspace;
}

export type WorkspaceStats = {
  datasets: number;
  versions: number;
  openFindings: number;
  publishedMasters: number;
  members: number;
};

export async function getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  const countFor = async (
    table: "datasets" | "dataset_versions" | "workspace_members",
  ) => {
    const { count, error } = await buildCountQuery(table, workspaceId);
    if (error) throw error;
    return count ?? 0;
  };

  const [datasets, versions, members, { count: publishedMasters, error: publishedError }] = await Promise.all([
    countFor("datasets"),
    countFor("dataset_versions"),
    countFor("workspace_members"),
    supabase
      .from("master_versions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("published", true),
  ]);
  if (publishedError) throw publishedError;

  const { count: openFindings, error: findingsError } = await supabase
    .from("quality_findings")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "open");
  if (findingsError) throw findingsError;

  return {
    datasets,
    versions,
    members,
    publishedMasters: publishedMasters ?? 0,
    openFindings: openFindings ?? 0,
  };
}

function buildCountQuery(
  table: "datasets" | "dataset_versions" | "workspace_members",
  workspaceId: string,
) {
  return supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
}

export type AuditEvent = Database["public"]["Tables"]["audit_events"]["Row"];

export async function listAuditEvents(workspaceId: string, limit = 10): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
