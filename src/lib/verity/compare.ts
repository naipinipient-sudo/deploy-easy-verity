import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { CanonicalKey } from "@/lib/verity/canonical";
import { diffIndexes, type CompareSummary, type CompareResults, type SideIndex } from "@/lib/verity/compareRules";

export { type CompareSummary, type CompareResults };
export type CompareRun = Database["public"]["Tables"]["compare_runs"]["Row"];

const PAGE_SIZE = 1000;

type RawRow = { row_index: number; raw: Record<string, string> };

async function fetchAllRows(versionId: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("dataset_rows")
      .select("row_index, raw")
      .eq("version_id", versionId)
      .order("row_index")
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as RawRow[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeValue(value: unknown): string {
  return String(value ?? "").trim();
}

type Side = {
  versionId: string;
  mapping: Record<string, string>;
  reverseMapping: Map<CanonicalKey, string>; // canonical key -> source column
};

async function loadSide(versionId: string): Promise<Side> {
  const { data, error } = await supabase
    .from("dataset_versions")
    .select("mapping")
    .eq("id", versionId)
    .single();
  if (error) throw error;
  const mapping = (data.mapping ?? {}) as Record<string, string>;
  const reverseMapping = new Map<CanonicalKey, string>();
  for (const [sourceCol, canonicalKey] of Object.entries(mapping)) {
    if (canonicalKey) reverseMapping.set(canonicalKey as CanonicalKey, sourceCol);
  }
  return { versionId, mapping, reverseMapping };
}

/** Canonical fields mapped on both sides — the only ones we can compare. */
export async function commonMappedFields(leftVersionId: string, rightVersionId: string): Promise<CanonicalKey[]> {
  const [left, right] = await Promise.all([loadSide(leftVersionId), loadSide(rightVersionId)]);
  return [...left.reverseMapping.keys()].filter((k) => right.reverseMapping.has(k));
}

export async function runCompare(params: {
  workspaceId: string;
  leftVersionId: string;
  rightVersionId: string;
  keyField: CanonicalKey;
  userId: string;
}): Promise<{ summary: CompareSummary; runId: string }> {
  const { workspaceId, leftVersionId, rightVersionId, keyField, userId } = params;
  const [left, right, leftRows, rightRows] = await Promise.all([
    loadSide(leftVersionId),
    loadSide(rightVersionId),
    fetchAllRows(leftVersionId),
    fetchAllRows(rightVersionId),
  ]);

  const leftKeyCol = left.reverseMapping.get(keyField);
  const rightKeyCol = right.reverseMapping.get(keyField);
  if (!leftKeyCol || !rightKeyCol) {
    throw new Error(`"${keyField}" is not mapped on both dataset versions.`);
  }

  const compareFields = [...left.reverseMapping.keys()].filter(
    (k) => k !== keyField && right.reverseMapping.has(k),
  );

  const project = (side: Side, row: RawRow) => {
    const record: Record<string, string> = {};
    for (const field of compareFields) {
      const col = side.reverseMapping.get(field);
      record[field] = col ? normalizeValue(row.raw[col]) : "";
    }
    return record;
  };

  const buildIndex = (side: Side, keyCol: string, rows: RawRow[]) => {
    const index = new Map<string, { row: RawRow; record: Record<string, string> }[]>();
    for (const row of rows) {
      const key = normalizeKey(row.raw[keyCol]);
      if (!key) continue;
      const bucket = index.get(key) ?? [];
      bucket.push({ row, record: project(side, row) });
      index.set(key, bucket);
    }
    return index;
  };

  const leftIndex: SideIndex = buildIndex(left, leftKeyCol, leftRows);
  const rightIndex: SideIndex = buildIndex(right, rightKeyCol, rightRows);

  const { summary, results } = diffIndexes(leftIndex, rightIndex, compareFields);

  const { data: run, error: runError } = await supabase
    .from("compare_runs")
    .insert({
      workspace_id: workspaceId,
      left_version_id: leftVersionId,
      right_version_id: rightVersionId,
      keys: [keyField] as unknown as Json,
      config: { compareFields } as Json,
      summary: summary as unknown as Json,
      results: results as unknown as Json,
      created_by: userId,
    })
    .select("id")
    .single();
  if (runError) throw runError;

  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_id: userId,
    action: "compare.run",
    object_type: "compare_run",
    object_id: run.id,
    details: { leftVersionId, rightVersionId, keyField, summary },
  });

  return { summary, runId: run.id };
}

export async function listCompareRuns(workspaceId: string): Promise<CompareRun[]> {
  const { data, error } = await supabase
    .from("compare_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCompareRun(runId: string): Promise<CompareRun | null> {
  const { data, error } = await supabase.from("compare_runs").select("*").eq("id", runId).maybeSingle();
  if (error) throw error;
  return data;
}

export type VersionOption = { id: string; label: string; rowCount: number };

export async function listVersionOptions(workspaceId: string): Promise<VersionOption[]> {
  const { data, error } = await supabase
    .from("dataset_versions")
    .select("id, version_no, row_count, datasets(name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.id,
    label: `${(v.datasets as unknown as { name: string } | null)?.name ?? "—"} · v${v.version_no}`,
    rowCount: v.row_count,
  }));
}
