import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { CanonicalKey } from "@/lib/verity/canonical";
import { mergeSources, type Source } from "@/lib/verity/masterRules";

export type MasterDataset = Database["public"]["Tables"]["master_datasets"]["Row"];
export type MasterVersion = Database["public"]["Tables"]["master_versions"]["Row"];
export type MasterRow = Database["public"]["Tables"]["master_rows"]["Row"];

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

export async function listMasterDatasets(workspaceId: string): Promise<MasterDataset[]> {
  const { data, error } = await supabase
    .from("master_datasets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMasterDataset(workspaceId: string, name: string, userId: string): Promise<MasterDataset> {
  const { data, error } = await supabase
    .from("master_datasets")
    .insert({ workspace_id: workspaceId, name, created_by: userId, definition: {} as Json })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listMasterVersions(masterId: string): Promise<MasterVersion[]> {
  const { data, error } = await supabase
    .from("master_versions")
    .select("*")
    .eq("master_id", masterId)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Builds a new master version from source dataset versions given in
 * precedence order (last wins on non-blank field conflicts). Only fields
 * mapped on at least one input are carried through.
 */
export async function buildMasterVersion(params: {
  workspaceId: string;
  masterId: string;
  inputVersionIds: string[];
  keyField: CanonicalKey;
  userId: string;
}): Promise<{ versionId: string; rowCount: number }> {
  const { workspaceId, masterId, inputVersionIds, keyField, userId } = params;
  if (inputVersionIds.length === 0) throw new Error("Pick at least one input version.");

  const mappings = await Promise.all(inputVersionIds.map(loadMapping));
  const allRows = await Promise.all(inputVersionIds.map(fetchAllRows));

  const allFields = new Set<string>();
  for (const mapping of mappings) for (const field of mapping.keys()) allFields.add(field);
  allFields.delete(keyField);
  const fields = [...allFields];

  const sources: Source[] = inputVersionIds.map((versionId, i) => {
    const mapping = mappings[i]!;
    const rows = allRows[i]!;
    const keyCol = mapping.get(keyField);
    const index: Source["index"] = new Map();
    if (keyCol) {
      for (const row of rows) {
        const key = normalizeKey(row.raw[keyCol]);
        if (!key) continue;
        const record: Record<string, string> = {};
        for (const field of fields) {
          const col = mapping.get(field as CanonicalKey);
          record[field] = col ? String(row.raw[col] ?? "").trim() : "";
        }
        const bucket = index.get(key) ?? [];
        bucket.push({ record, rowIndex: row.row_index });
        index.set(key, bucket);
      }
    }
    return { versionId, index };
  });

  const merged = mergeSources(sources, fields);

  const { count } = await supabase
    .from("master_versions")
    .select("id", { count: "exact", head: true })
    .eq("master_id", masterId);
  const versionNo = (count ?? 0) + 1;

  const { data: version, error: versionError } = await supabase
    .from("master_versions")
    .insert({
      workspace_id: workspaceId,
      master_id: masterId,
      version_no: versionNo,
      inputs: inputVersionIds as unknown as Json,
      build_rules: { keyField, precedence: inputVersionIds } as Json,
      row_count: merged.length,
      published: false,
    })
    .select("id")
    .single();
  if (versionError) throw versionError;

  const records = merged.map((row, i) => ({
    workspace_id: workspaceId,
    master_version_id: version.id,
    row_index: i,
    data: row.data as unknown as Json,
    lineage: row.lineage as unknown as Json,
  }));
  for (let i = 0; i < records.length; i += PAGE_SIZE) {
    const { error } = await supabase.from("master_rows").insert(records.slice(i, i + PAGE_SIZE));
    if (error) throw error;
  }

  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_id: userId,
    action: "master.built",
    object_type: "master_version",
    object_id: version.id,
    details: { masterId, versionNo, inputVersionIds, keyField, rowCount: merged.length },
  });

  return { versionId: version.id, rowCount: merged.length };
}

export async function publishMasterVersion(workspaceId: string, versionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("master_versions")
    .update({ published: true, published_at: new Date().toISOString(), published_by: userId })
    .eq("id", versionId);
  if (error) throw error;

  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_id: userId,
    action: "master.published",
    object_type: "master_version",
    object_id: versionId,
    details: {},
  });
}

export async function listMasterRows(versionId: string, limit = 50): Promise<MasterRow[]> {
  const { data, error } = await supabase
    .from("master_rows")
    .select("*")
    .eq("master_version_id", versionId)
    .order("row_index")
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
