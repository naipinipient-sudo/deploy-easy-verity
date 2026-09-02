import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { CanonicalKey } from "@/lib/verity/canonical";
import type { Row } from "@/lib/verity/exploreRules";

const PAGE_SIZE = 1000;

export type ExploreSourceType = "dataset_version" | "master_version";
export type ExploreSourceOption = { id: string; type: ExploreSourceType; label: string; rowCount: number };

/** Dataset versions and master versions, unified as pickable Explore/Rider sources. */
export async function listExploreSources(workspaceId: string): Promise<ExploreSourceOption[]> {
  const [{ data: versions, error: vErr }, { data: masters, error: mErr }] = await Promise.all([
    supabase
      .from("dataset_versions")
      .select("id, version_no, row_count, created_at, datasets(name)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("master_versions")
      .select("id, version_no, row_count, created_at, published, master_datasets(name)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);
  if (vErr) throw vErr;
  if (mErr) throw mErr;

  const datasetOptions: ExploreSourceOption[] = (versions ?? []).map((v) => ({
    id: v.id,
    type: "dataset_version" as const,
    label: `${(v.datasets as unknown as { name: string } | null)?.name ?? "—"} · v${v.version_no}`,
    rowCount: v.row_count,
  }));
  const masterOptions: ExploreSourceOption[] = (masters ?? []).map((v) => ({
    id: v.id,
    type: "master_version" as const,
    label: `Master: ${(v.master_datasets as unknown as { name: string } | null)?.name ?? "—"} · v${v.version_no}${v.published ? " (published)" : ""}`,
    rowCount: v.row_count,
  }));
  return [...masterOptions, ...datasetOptions];
}

export type ExploreData = { fields: CanonicalKey[]; rows: Row[] };

async function loadDatasetVersionRows(versionId: string): Promise<ExploreData> {
  const { data: versionRow, error: vErr } = await supabase
    .from("dataset_versions")
    .select("mapping")
    .eq("id", versionId)
    .single();
  if (vErr) throw vErr;
  const mapping = (versionRow.mapping ?? {}) as Record<string, string>;
  const reverse = new Map<CanonicalKey, string>();
  for (const [sourceCol, canonicalKey] of Object.entries(mapping)) {
    if (canonicalKey) reverse.set(canonicalKey as CanonicalKey, sourceCol);
  }
  const fields = [...reverse.keys()];

  const rows: ExploreData["rows"] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("dataset_rows")
      .select("row_index, raw")
      .eq("version_id", versionId)
      .order("row_index")
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const raw = r.raw as Record<string, string>;
      const record: Row = {};
      for (const field of fields) {
        const col = reverse.get(field);
        record[field] = col ? String(raw[col] ?? "") : "";
      }
      rows.push(record);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return { fields, rows };
}

async function loadMasterVersionRows(versionId: string): Promise<ExploreData> {
  const rows: ExploreData["rows"] = [];
  const fieldSet = new Set<CanonicalKey>();
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("master_rows")
      .select("row_index, data")
      .eq("master_version_id", versionId)
      .order("row_index")
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const record = (r.data ?? {}) as Row;
      for (const field of Object.keys(record)) fieldSet.add(field as CanonicalKey);
      rows.push(record);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return { fields: [...fieldSet], rows };
}

/** Loads a source's rows projected onto canonical fields (dataset versions via mapping, master versions natively). */
export async function loadExploreSource(source: { id: string; type: ExploreSourceType }): Promise<ExploreData> {
  return source.type === "dataset_version" ? loadDatasetVersionRows(source.id) : loadMasterVersionRows(source.id);
}

export type SavedView = Database["public"]["Tables"]["saved_views"]["Row"];
export type SavedViewConfig = { filters: unknown; sortField: string | null; sortDir: "asc" | "desc"; visibleFields: string[] };

export async function listSavedViews(workspaceId: string, sourceType: ExploreSourceType, sourceId: string): Promise<SavedView[]> {
  const { data, error } = await supabase
    .from("saved_views")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSavedView(params: {
  workspaceId: string;
  sourceType: ExploreSourceType;
  sourceId: string;
  name: string;
  config: SavedViewConfig;
  userId: string;
}): Promise<SavedView> {
  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      workspace_id: params.workspaceId,
      source_type: params.sourceType,
      source_id: params.sourceId,
      name: params.name,
      config: params.config as unknown as Json,
      created_by: params.userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSavedView(id: string): Promise<void> {
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) throw error;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** PRD 8.9: exports are read-only snapshots -- filename records the source so the snapshot's origin stays traceable. */
export function exportRows(rows: Row[], fields: string[], sourceLabel: string, format: "csv" | "xlsx") {
  const plain = rows.map((r) => Object.fromEntries(fields.map((f) => [f, r[f] ?? ""])));
  const safeName = sourceLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  if (format === "csv") {
    downloadBlob(new Blob([Papa.unparse(plain)], { type: "text/csv" }), `${safeName}.csv`);
  } else {
    const sheet = XLSX.utils.json_to_sheet(plain);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Export");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" });
    downloadBlob(new Blob([buffer], { type: "application/octet-stream" }), `${safeName}.xlsx`);
  }
}
