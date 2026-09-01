import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { computeQualityFindings, type NewFinding } from "@/lib/verity/qualityRules";

export { computeQualityFindings, type NewFinding };
export type QualityFinding = Database["public"]["Tables"]["quality_findings"]["Row"];

export async function insertQualityFindings(
  workspaceId: string,
  versionId: string,
  findings: NewFinding[],
): Promise<void> {
  if (findings.length === 0) return;
  const { error } = await supabase.from("quality_findings").insert(
    findings.map((f) => ({
      workspace_id: workspaceId,
      version_id: versionId,
      ...f,
    })),
  );
  if (error) throw error;
}

export type QualityFindingWithContext = QualityFinding & {
  dataset_name: string;
  file_name: string;
};

export async function listQualityFindings(workspaceId: string): Promise<QualityFindingWithContext[]> {
  const { data, error } = await supabase
    .from("quality_findings")
    .select("*, dataset_versions(file_name, datasets(name))")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const version = row.dataset_versions as unknown as {
      file_name: string;
      datasets: { name: string } | null;
    } | null;
    const { dataset_versions: _omit, ...finding } = row as typeof row & { dataset_versions?: unknown };
    return {
      ...(finding as QualityFinding),
      dataset_name: version?.datasets?.name ?? "—",
      file_name: version?.file_name ?? "—",
    };
  });
}

export async function resolveFinding(findingId: string, resolutionNote: string): Promise<void> {
  const { error } = await supabase
    .from("quality_findings")
    .update({ status: "resolved", resolution_note: resolutionNote })
    .eq("id", findingId);
  if (error) throw error;
}

export async function reopenFinding(findingId: string): Promise<void> {
  const { error } = await supabase
    .from("quality_findings")
    .update({ status: "open", resolution_note: null })
    .eq("id", findingId);
  if (error) throw error;
}
