import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { LoadingState, EmptyState, ErrorState } from "@/components/verity/states";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { listAuditEvents } from "@/lib/verity/workspaces";
import { computeQualityFindings, insertQualityFindings } from "@/lib/verity/quality";
import { CANONICAL_FIELDS } from "@/lib/verity/canonical";
import {
  MAX_FILE_BYTES,
  MAX_ROWS,
  parseFile,
  profileColumns,
  sha256Hex,
  type ParsedFile,
  type FileProfile,
} from "@/lib/verity/fileProfile";

export const Route = createFileRoute("/_authenticated/datasets")({
  component: DatasetsPage,
});

interface DatasetRow {
  id: string;
  name: string;
  dataset_versions: { row_count: number; created_at: string }[];
}

function datasetsQueryOptions(workspaceId: string) {
  return {
    queryKey: ["datasets", workspaceId],
    queryFn: async (): Promise<DatasetRow[]> => {
      const { data, error } = await supabase
        .from("datasets")
        .select("id, name, dataset_versions(row_count, created_at)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as DatasetRow[]) ?? [];
    },
  };
}

function DatasetsPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title="Datasets">
        <LoadingState label="Loading workspace" />
      </AppShell>
    );
  }

  if (!activeWorkspace) {
    return (
      <AppShell title="Datasets">
        <EmptyState
          icon={<Database className="h-5 w-5" aria-hidden />}
          title="No workspace selected"
          description="Create or pick a workspace first."
          action={
            <Button asChild size="sm">
              <Link to="/workspaces/new">Create workspace</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return <DatasetsForWorkspace workspaceId={activeWorkspace.id} />;
}

function DatasetsForWorkspace({ workspaceId }: { workspaceId: string }) {
  const query = useQuery(datasetsQueryOptions(workspaceId));
  const auditQuery = useQuery({
    queryKey: ["audit-events", workspaceId],
    queryFn: () => listAuditEvents(workspaceId, 6),
  });

  const datasets = query.data ?? [];
  const versions = datasets.flatMap((d) => d.dataset_versions);
  const latestRows = datasets.reduce((sum, d) => sum + (d.dataset_versions.at(-1)?.row_count ?? 0), 0);

  return (
    <AppShell
      title="Datasets"
      actions={
        <Badge className="bg-primary text-primary-foreground">Step 1 → 3 · Ingest, profile, map</Badge>
      }
    >
      {query.isLoading ? (
        <LoadingState label="Loading datasets" />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <div className="space-y-6">
          <UploadPanel
            workspaceId={workspaceId}
            datasets={datasets.map((d) => ({ id: d.id, name: d.name }))}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Datasets" value={datasets.length} />
            <StatCard label="Versions" value={versions.length} />
            <StatCard label="Latest rows" value={latestRows} />
            <StatCard label="Mappings certified" value={`${versions.length}/${versions.length}`} />
          </div>

          {datasets.length > 0 ? (
            <div className="panel overflow-x-auto p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Latest rows</TableHead>
                    <TableHead>Versions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.dataset_versions.at(-1)?.row_count ?? "—"}</TableCell>
                      <TableCell>{d.dataset_versions.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="panel bg-secondary/40 p-10 text-center">
              <p className="text-lg font-bold">No datasets yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Drop a CSV or XLSX export above. Verity will profile it in your browser and keep it as
                immutable evidence — sources are never written back.
              </p>
            </div>
          )}

          <div className="panel p-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Audit trail
            </span>
            {auditQuery.data && auditQuery.data.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {auditQuery.data.map((event) => (
                  <li key={event.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <span>{event.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No events yet. Every upload, mapping edit, and certification is logged here.
              </p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

// ponytail: sequential chunked insert, O(rows/1000) requests. Fine for the
// browser-first MVP row limit; move bulk load to the Phase 3 Cloud Run path
// once files routinely approach MAX_ROWS.
const ROW_INSERT_CHUNK = 1000;

function UploadPanel({
  workspaceId,
  datasets,
}: {
  workspaceId: string;
  datasets: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [profile, setProfile] = useState<FileProfile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [targetDatasetId, setTargetDatasetId] = useState("__new__");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleFile(f: File) {
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`File is ${(f.size / 1024 / 1024).toFixed(1)}MB — MVP limit is ${MAX_FILE_BYTES / 1024 / 1024}MB.`);
      return;
    }
    const p = await parseFile(f);
    if (p.rowCount > MAX_ROWS) {
      toast.error(`File has ${p.rowCount} rows — MVP limit is ${MAX_ROWS}.`);
      return;
    }
    setFile(f);
    setParsed(p);
    setProfile(profileColumns(p.headers, p.rows));
    setNewName(f.name.replace(/\.(csv|xlsx?)$/i, ""));
  }

  async function pickSheet(sheetName: string) {
    if (!file) return;
    const p = await parseFile(file, sheetName);
    setParsed(p);
    setProfile(profileColumns(p.headers, p.rows));
  }

  function reset() {
    setFile(null);
    setParsed(null);
    setProfile(null);
    setMapping({});
    setProgress(null);
  }

  async function confirmImport() {
    if (!file || !parsed || !profile) return;
    setBusy(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("You must be signed in.");
      const userId = userData.user.id;

      const checksum = await sha256Hex(file);

      let datasetId = targetDatasetId;
      if (targetDatasetId === "__new__") {
        const { data, error } = await supabase
          .from("datasets")
          .insert({ workspace_id: workspaceId, name: newName, created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        datasetId = data.id;
      }

      const { count } = await supabase
        .from("dataset_versions")
        .select("id", { count: "exact", head: true })
        .eq("dataset_id", datasetId);
      const versionNo = (count ?? 0) + 1;

      setProgress("Uploading raw file…");
      const path = `${workspaceId}/${datasetId}/${versionNo}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("dataset-uploads").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: version, error: versionError } = await supabase
        .from("dataset_versions")
        .insert({
          workspace_id: workspaceId,
          dataset_id: datasetId,
          version_no: versionNo,
          file_name: file.name,
          file_path: path,
          sheet_name: parsed.activeSheet,
          checksum,
          row_count: parsed.rowCount,
          columns: profile.columns as unknown as Json,
          mapping,
          mapping_confirmed: true,
          uploaded_by: userId,
        })
        .select("id")
        .single();
      if (versionError) throw versionError;

      for (let start = 0; start < parsed.rows.length; start += ROW_INSERT_CHUNK) {
        const chunk = parsed.rows.slice(start, start + ROW_INSERT_CHUNK);
        setProgress(`Saving rows ${start + 1}–${Math.min(start + chunk.length, parsed.rows.length)} of ${parsed.rows.length}…`);
        const records = chunk.map((row, i) => ({
          workspace_id: workspaceId,
          version_id: version.id,
          row_index: start + i,
          raw: Object.fromEntries(parsed.headers.map((h, idx) => [h, row[idx] ?? ""])),
        }));
        const { error: rowsError } = await supabase.from("dataset_rows").insert(records);
        if (rowsError) throw rowsError;
      }

      await supabase.from("audit_events").insert({
        workspace_id: workspaceId,
        actor_id: userId,
        action: "dataset.imported",
        object_type: "dataset_version",
        object_id: version.id,
        details: { datasetId, versionNo, rowCount: parsed.rowCount },
      });

      const findings = computeQualityFindings(profile.columns, mapping, parsed.rowCount);
      await insertQualityFindings(workspaceId, version.id, findings);

      toast.success(
        findings.length > 0
          ? `Imported ${parsed.rowCount} rows — ${findings.length} quality finding(s) to review.`
          : `Imported ${parsed.rowCount} rows.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["datasets", workspaceId] });
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="panel p-6">
      {!profile && (
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step 1 — Ingest
            </p>
            <h2 className="mt-1 text-2xl font-bold">Drop CSV or XLSX exports</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Files are parsed in your browser. Every import becomes an append-only version with a
              checksum, row count, and detected schema. Re-uploading the same dataset name adds a new
              version instead of overwriting.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">CSV</Badge>
              <Badge variant="secondary">XLSX — one dataset per sheet</Badge>
              <Badge className="bg-secondary text-secondary-foreground">
                Browser limit ≈ {MAX_ROWS.toLocaleString()} rows
              </Badge>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <Button asChild size="lg">
              <label className="cursor-pointer">
                Choose files
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) handleFile(picked);
                  }}
                />
              </label>
            </Button>
            <span className="text-xs text-muted-foreground">or drag &amp; drop</span>
          </div>
        </div>
      )}

      {parsed && parsed.sheetNames.length > 1 && (
        <div className="mt-4 max-w-xs">
          <Label>Sheet</Label>
          <Select value={parsed.activeSheet} onValueChange={pickSheet}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {parsed.sheetNames.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {profile && parsed && (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {parsed.rowCount} rows detected. Map source columns to canonical fields:
          </p>
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source column</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Null %</TableHead>
                  <TableHead>Sample</TableHead>
                  <TableHead>Maps to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.columns.map((col) => (
                  <TableRow key={col.name}>
                    <TableCell className="font-medium">{col.name}</TableCell>
                    <TableCell>{col.type}</TableCell>
                    <TableCell>{Math.round(col.nullRate * 100)}%</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {col.sampleValues.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping[col.name] ?? "__ignore__"}
                        onValueChange={(value) =>
                          setMapping({ ...mapping, [col.name]: value === "__ignore__" ? "" : value })
                        }
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">— ignore —</SelectItem>
                          {CANONICAL_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-48">
              <Label>Dataset</Label>
              <Select value={targetDatasetId} onValueChange={setTargetDatasetId}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">New dataset</SelectItem>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} (new version)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {targetDatasetId === "__new__" && (
              <div className="min-w-48">
                <Label>Name</Label>
                <Input className="mt-2" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
            )}
            <Button onClick={confirmImport} disabled={busy || !newName.trim()}>
              {busy ? progress ?? "Importing…" : "Confirm mapping & import"}
            </Button>
            <Button variant="outline" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
