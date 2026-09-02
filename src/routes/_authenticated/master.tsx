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
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/master")({
  component: MasterPage,
});

function MasterPage() {
  const { t } = useLang();
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title={t("master.title")}>
        <LoadingState label={t("common.loadingWorkspace")} />
      </AppShell>
    );
  }
  if (!activeWorkspace) {
    return (
      <AppShell title={t("master.title")}>
        <EmptyState
          icon={<Layers3 className="h-5 w-5" aria-hidden />}
          title={t("common.noWorkspaceSelected")}
          description={t("common.pickWorkspaceFirst")}
          action={
            <Button asChild size="sm">
              <Link to="/workspaces/new">{t("workspaces.createWorkspace")}</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }
  return <MasterForWorkspace workspaceId={activeWorkspace.id} />;
}

function MasterForWorkspace({ workspaceId }: { workspaceId: string }) {
  const { t } = useLang();
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
      toast.error(error instanceof Error ? error.message : t("master.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  if (selected) {
    return <MasterDetail workspaceId={workspaceId} master={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <AppShell title={t("master.title")} description={t("master.pageDescription")}>
      <div className="panel mb-6 flex flex-wrap items-end gap-3 p-6">
        <div className="flex-1">
          <Label>{t("master.newNameLabel")}</Label>
          <Input className="mt-2" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <Button onClick={create} disabled={creating || !newName.trim()}>
          {t("master.create")}
        </Button>
      </div>

      {query.isLoading ? (
        <LoadingState label={t("master.loadingMasterDatasets")} />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Layers3 className="h-5 w-5" aria-hidden />}
          title={t("master.emptyTitle")}
          description={t("master.emptyDescription")}
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
                {t("master.createdOn", { date: new Date(m.created_at).toLocaleDateString() })}
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
  const { t } = useLang();
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
      toast.success(t("master.buildSuccess", { count: outcome.rowCount }));
      setInputIds([]);
      invalidateVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("master.buildFailed"));
    } finally {
      setBuilding(false);
    }
  };

  const publish = async (versionId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    try {
      await publishMasterVersion(workspaceId, versionId, userData.user.id);
      toast.success(t("master.publishSuccess"));
      invalidateVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("master.publishFailed"));
    }
  };

  return (
    <AppShell
      title={master.name}
      description={t("master.detailDescription")}
      actions={
        <Button variant="outline" size="sm" onClick={onBack}>
          {t("master.backToAll")}
        </Button>
      }
    >
      <div className="panel mb-6 space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("master.buildNewVersion")}
        </h2>
        {inputOptionsQuery.isLoading ? (
          <LoadingState label={t("master.loadingDatasets")} rows={2} />
        ) : (
          <>
            <div>
              <Label>{t("master.inputVersionsLabel")}</Label>
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
              <Label>{t("master.dedupKeyLabel")}</Label>
              <Select value={keyField} onValueChange={setKeyField}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANONICAL_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {t(`canonical.${f.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={build} disabled={building || inputIds.length === 0}>
              {building ? t("master.building") : t("master.buildFrom", { count: inputIds.length })}
            </Button>
          </>
        )}
      </div>

      {versionsQuery.isLoading ? (
        <LoadingState label={t("master.loadingVersions")} />
      ) : versionsQuery.error ? (
        <ErrorState message={versionsQuery.error.message} onRetry={() => versionsQuery.refetch()} />
      ) : (versionsQuery.data ?? []).length === 0 ? (
        <EmptyState title={t("master.noVersionsTitle")} description={t("master.noVersionsDescription")} />
      ) : (
        <div className="panel overflow-x-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("master.colVersion")}</TableHead>
                <TableHead>{t("master.colRows")}</TableHead>
                <TableHead>{t("master.colInputs")}</TableHead>
                <TableHead>{t("master.colStatus")}</TableHead>
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
                        {t("master.published")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{t("master.draft")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewVersionId(v.id)}>
                      {t("master.preview")}
                    </Button>
                    {!v.published && (
                      <Button size="sm" onClick={() => publish(v.id)}>
                        {t("master.publish")}
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
  const { t } = useLang();
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
            {t("master.previewHeading", { count: rows.length })}
          </h2>
          <Button size="sm" variant="outline" onClick={onClose}>
            {t("master.close")}
          </Button>
        </div>
        {query.isLoading ? (
          <LoadingState label={t("master.loadingRows")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {fields.map((f) => (
                    <TableHead key={f}>{f}</TableHead>
                  ))}
                  <TableHead>{t("master.colSources")}</TableHead>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {t("master.recordsCount", { count: lineage.length })}
                      </TableCell>
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
