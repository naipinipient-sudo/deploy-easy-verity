import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers3, CheckCircle2 } from "lucide-react";
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
import { CANONICAL_FIELDS } from "@/lib/verity/canonical";
import { listVersionOptions } from "@/lib/verity/compare";
import {
  listMasterDatasets,
  createMasterDataset,
  listMasterVersions,
  buildMasterVersion,
  publishMasterVersion,
  listMasterRows,
  type MasterDataset,
} from "@/lib/verity/master";

export const Route = createFileRoute("/_authenticated/master")({
  component: MasterPage,
});

function MasterPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title="Master">
        <LoadingState label="Loading workspace" />
      </AppShell>
    );
  }
  if (!activeWorkspace) {
    return (
      <AppShell title="Master">
        <EmptyState
          icon={<Layers3 className="h-5 w-5" aria-hidden />}
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
  return <MasterForWorkspace workspaceId={activeWorkspace.id} />;
}

function MasterForWorkspace({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<MasterDataset | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["master-datasets", workspaceId],
    queryFn: () => listMasterDatasets(workspaceId),
  });

  const create = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || !newName.trim()) return;
    setCreating(true);
    try {
      await createMasterDataset(workspaceId, newName.trim(), userData.user.id);
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["master-datasets", workspaceId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create master dataset");
    } finally {
      setCreating(false);
    }
  };

  if (selected) {
    return <MasterDetail workspaceId={workspaceId} master={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <AppShell title="Master" description="Versioned, published outputs merged from selected dataset versions.">
      <div className="panel mb-6 flex flex-wrap items-end gap-3 p-6">
        <div className="flex-1">
          <Label>New master dataset name</Label>
          <Input className="mt-2" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <Button onClick={create} disabled={creating || !newName.trim()}>
          Create
        </Button>
      </div>

      {query.isLoading ? (
        <LoadingState label="Loading master datasets" />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Layers3 className="h-5 w-5" aria-hidden />}
          title="No master datasets yet"
          description="Create one above, then build a version from your imported datasets."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(query.data ?? []).map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="panel p-5 text-left transition-colors hover:border-primary/40"
            >
              <p className="font-medium">{m.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Created {new Date(m.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function MasterDetail({
  workspaceId,
  master,
  onBack,
}: {
  workspaceId: string;
  master: MasterDataset;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    queryKey: ["master-versions", master.id],
    queryFn: () => listMasterVersions(master.id),
  });
  const inputOptionsQuery = useQuery({
    queryKey: ["dataset-versions-options", workspaceId],
    queryFn: () => listVersionOptions(workspaceId),
  });

  const [inputIds, setInputIds] = useState<string[]>([]);
  const [keyField, setKeyField] = useState<string>(CANONICAL_FIELDS[0].key);
  const [building, setBuilding] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);

  const invalidateVersions = () => queryClient.invalidateQueries({ queryKey: ["master-versions", master.id] });

  const toggleInput = (id: string) => {
    setInputIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const build = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setBuilding(true);
    try {
      const outcome = await buildMasterVersion({
        workspaceId,
        masterId: master.id,
        inputVersionIds: inputIds,
        keyField: keyField as never,
        userId: userData.user.id,
      });
      toast.success(`Built version with ${outcome.rowCount} rows.`);
      setInputIds([]);
      invalidateVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  };

  const publish = async (versionId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    try {
      await publishMasterVersion(workspaceId, versionId, userData.user.id);
      toast.success("Published.");
      invalidateVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish");
    }
  };

  return (
    <AppShell
      title={master.name}
      description="Build a new version from selected dataset versions, then publish."
      actions={
        <Button variant="outline" size="sm" onClick={onBack}>
          ← All master datasets
        </Button>
      }
    >
      <div className="panel mb-6 space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Build new version</h2>
        {inputOptionsQuery.isLoading ? (
          <LoadingState label="Loading datasets" rows={2} />
        ) : (
          <>
            <div>
              <Label>Input versions (order = merge precedence, last wins on conflicts)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(inputOptionsQuery.data ?? []).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => toggleInput(v.id)}
                    className={
                      inputIds.includes(v.id)
                        ? "border-2 border-border bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        : "border-2 border-border bg-card px-3 py-1.5 text-xs"
                    }
                  >
                    {inputIds.includes(v.id) ? `${inputIds.indexOf(v.id) + 1}. ` : ""}
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-w-xs">
              <Label>Dedup key field</Label>
              <Select value={keyField} onValueChange={setKeyField}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANONICAL_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={build} disabled={building || inputIds.length === 0}>
              {building ? "Building…" : `Build from ${inputIds.length} version(s)`}
            </Button>
          </>
        )}
      </div>

      {versionsQuery.isLoading ? (
        <LoadingState label="Loading versions" />
      ) : versionsQuery.error ? (
        <ErrorState message={versionsQuery.error.message} onRetry={() => versionsQuery.refetch()} />
      ) : (versionsQuery.data ?? []).length === 0 ? (
        <EmptyState title="No versions yet" description="Build one above." />
      ) : (
        <div className="panel overflow-x-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Inputs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(versionsQuery.data ?? []).map((v) => (
                <TableRow key={v.id}>
                  <TableCell>v{v.version_no}</TableCell>
                  <TableCell>{v.row_count}</TableCell>
                  <TableCell>{(v.inputs as unknown as string[]).length}</TableCell>
                  <TableCell>
                    {v.published ? (
                      <Badge className="bg-success text-success-foreground">
                        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="outline">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewVersionId(v.id)}>
                      Preview
                    </Button>
                    {!v.published && (
                      <Button size="sm" onClick={() => publish(v.id)}>
                        Publish
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {previewVersionId && (
        <MasterRowsPreview versionId={previewVersionId} onClose={() => setPreviewVersionId(null)} />
      )}
    </AppShell>
  );
}

function MasterRowsPreview({ versionId, onClose }: { versionId: string; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["master-rows", versionId],
    queryFn: () => listMasterRows(versionId, 50),
  });
  const rows = query.data ?? [];
  const firstRow = rows[0];
  const fields = firstRow ? Object.keys(firstRow.data as Record<string, string>) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="panel max-h-[80vh] w-full max-w-4xl space-y-4 overflow-y-auto bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Preview (first {rows.length} rows)
          </h2>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        {query.isLoading ? (
          <LoadingState label="Loading rows" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {fields.map((f) => (
                    <TableHead key={f}>{f}</TableHead>
                  ))}
                  <TableHead>Sources</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const data = row.data as Record<string, string>;
                  const lineage = row.lineage as { versionId: string; rowIndex: number }[];
                  return (
                    <TableRow key={row.id}>
                      {fields.map((f) => (
                        <TableCell key={f} className="max-w-32 truncate text-xs">
                          {data[f] || "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs text-muted-foreground">{lineage.length} record(s)</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
