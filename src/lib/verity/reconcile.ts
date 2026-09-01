import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { CanonicalKey } from "@/lib/verity/canonical";
import type { SideIndex } from "@/lib/verity/compareRules";
import { reconcileIndexes, type ToleranceConfig, type ReconciliationItem } from "@/lib/verity/reconcileRules";

export type ReconciliationRun = Database["public"]["Tables"]["reconciliation_runs"]["Row"];
export type ReconciliationItemRow = Database["public"]["Tables"]["reconciliation_items"]["Row"];

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

async function loadMapping(versionId: string): Promise<Map<CanonicalKey, string>> {
  const { data, error } = await supabase.from("dataset_versions").select("mapping").eq("id", versionId).single();
  if (error) throw error;
  const mapping = (data.mapping ?? {}) as Record<string, string>;
  const reverse = new Map<CanonicalKey, string>();
  for (const [sourceCol, canonicalKey] of Object.entries(mapping)) {
    if (canonicalKey) reverse.set(canonicalKey as CanonicalKey, sourceCol);
  }
  return reverse;
}

export async function commonMappedFields(leftVersionId: string, rightVersionId: string): Promise<CanonicalKey[]> {
  const [left, right] = await Promise.all([loadMapping(leftVersionId), loadMapping(rightVersionId)]);
  return [...left.keys()].filter((k) => right.has(k));
}

export async function runReconciliation(params: {
  workspaceId: string;
  leftVersionId: string;
  rightVersionId: string;
  keyField: CanonicalKey;
  tolerance: ToleranceConfig;
  userId: string;
}): Promise<{ runId: string; items: ReconciliationItem[] }> {
  const { workspaceId, leftVersionId, rightVersionId, keyField, tolerance, userId } = params;
  const [leftMapping, rightMapping, leftRows, rightRows] = await Promise.all([
    loadMapping(leftVersionId),
    loadMapping(rightVersionId),
    fetchAllRows(leftVersionId),
    fetchAllRows(rightVersionId),
  ]);

  const leftKeyCol = leftMapping.get(keyField);
  const rightKeyCol = rightMapping.get(keyField);
  if (!leftKeyCol || !rightKeyCol) throw new Error(`"${keyField}" is not mapped on both dataset versions.`);

  const compareFields = [...leftMapping.keys()].filter((k) => k !== keyField && rightMapping.has(k));

  const project = (mapping: Map<CanonicalKey, string>, row: RawRow) => {
    const record: Record<string, string> = {};
    for (const field of compareFields) {
      const col = mapping.get(field);
      record[field] = col ? String(row.raw[col] ?? "").trim() : "";
    }
    return record;
  };

  const buildIndex = (mapping: Map<CanonicalKey, string>, keyCol: string, rows: RawRow[]): SideIndex => {
    const index: SideIndex = new Map();
    for (const row of rows) {
      const key = normalizeKey(row.raw[keyCol]);
      if (!key) continue;
      const bucket = index.get(key) ?? [];
      bucket.push({ record: project(mapping, row) });
      index.set(key, bucket);
    }
    return index;
  };

  const leftIndex = buildIndex(leftMapping, leftKeyCol, leftRows);
  const rightIndex = buildIndex(rightMapping, rightKeyCol, rightRows);

  const items = reconcileIndexes(leftIndex, rightIndex, compareFields, tolerance);

  const summary = items.reduce(
    (acc, i) => {
      acc[i.state] = (acc[i.state] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const { data: run, error: runError } = await supabase
    .from("reconciliation_runs")
    .insert({
      workspace_id: workspaceId,
      left_version_id: leftVersionId,
      right_version_id: rightVersionId,
      config: { keyField, tolerance, compareFields } as Json,
      summary: summary as unknown as Json,
      status: "open",
      created_by: userId,
    })
    .select("id")
    .single();
  if (runError) throw runError;

  const records = items.map((item) => ({
    workspace_id: workspaceId,
    run_id: run.id,
    left_row: item.leftRow as unknown as Json,
    right_row: item.rightRow as unknown as Json,
    score: item.score,
    explanation: { key: item.key, side: item.side, fieldMatches: item.fieldMatches } as unknown as Json,
    state: item.state,
  }));
  for (let i = 0; i < records.length; i += PAGE_SIZE) {
    const { error } = await supabase.from("reconciliation_items").insert(records.slice(i, i + PAGE_SIZE));
    if (error) throw error;
  }

  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_id: userId,
    action: "reconciliation.run",
    object_type: "reconciliation_run",
    object_id: run.id,
    details: { leftVersionId, rightVersionId, keyField, summary },
  });

  return { runId: run.id, items };
}

export async function listReconciliationRuns(workspaceId: string): Promise<ReconciliationRun[]> {
  const { data, error } = await supabase
    .from("reconciliation_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listReconciliationItems(runId: string): Promise<ReconciliationItemRow[]> {
  const { data, error } = await supabase
    .from("reconciliation_items")
    .select("*")
    .eq("run_id", runId)
    .order("score", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type Decision = "matched" | "excluded";

export async function decideItem(params: {
  workspaceId: string;
  itemId: string;
  decision: Decision;
  isOverride: boolean;
  note: string | null;
  userId: string;
}): Promise<void> {
  const { workspaceId, itemId, decision, isOverride, note, userId } = params;
  const { error } = await supabase
    .from("reconciliation_items")
    .update({ state: decision, decided_by: userId, decided_at: new Date().toISOString(), note })
    .eq("id", itemId);
  if (error) throw error;

  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_id: userId,
    action: isOverride ? "reconciliation.override" : `reconciliation.${decision}`,
    object_type: "reconciliation_item",
    object_id: itemId,
    details: { note },
  });
}
