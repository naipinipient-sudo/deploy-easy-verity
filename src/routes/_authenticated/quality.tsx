import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { LoadingState, EmptyState, ErrorState } from "@/components/verity/states";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import {
  listQualityFindings,
  resolveFinding,
  reopenFinding,
  type QualityFindingWithContext,
} from "@/lib/verity/quality";

export const Route = createFileRoute("/_authenticated/quality")({
  component: QualityPage,
});

const SEVERITY_VARIANT = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
} as const;

function QualityPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title="Quality">
        <LoadingState label="Loading workspace" />
      </AppShell>
    );
  }

  if (!activeWorkspace) {
    return (
      <AppShell title="Quality">
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
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

  return <QualityForWorkspace workspaceId={activeWorkspace.id} />;
}

function QualityForWorkspace({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [resolving, setResolving] = useState<QualityFindingWithContext | null>(null);

  const query = useQuery({
    queryKey: ["quality-findings", workspaceId],
    queryFn: () => listQualityFindings(workspaceId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quality-findings", workspaceId] });

  const findings = (query.data ?? []).filter(
    (f) => statusFilter === "all" || f.status === statusFilter,
  );
  const openCount = (query.data ?? []).filter((f) => f.status === "open").length;

  return (
    <AppShell
      title="Quality"
      description="Findings derived from each import's schema profile — informational, no data is changed automatically."
      actions={<Badge className="bg-primary text-primary-foreground">{openCount} open</Badge>}
    >
      <div className="mb-4 flex gap-2">
        {(["open", "resolved", "all"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {query.isLoading ? (
        <LoadingState label="Loading findings" />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : findings.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
          title={statusFilter === "open" ? "No open findings" : "Nothing here"}
          description="Findings show up automatically after each dataset import."
        />
      ) : (
        <div className="panel overflow-x-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Dataset</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Finding</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Badge variant={SEVERITY_VARIANT[f.severity as keyof typeof SEVERITY_VARIANT] ?? "outline"}>
                      {f.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-40 truncate">
                    {f.dataset_name} <span className="text-muted-foreground">/ {f.file_name}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{f.field}</TableCell>
                  <TableCell className="max-w-md text-sm">{f.message}</TableCell>
                  <TableCell>{f.impacted_rows || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === "open" ? "outline" : "secondary"}>{f.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {f.status === "open" ? (
                      <Button size="sm" variant="outline" onClick={() => setResolving(f)}>
                        Resolve
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await reopenFinding(f.id);
                            invalidate();
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Could not reopen");
                          }
                        }}
                      >
                        Reopen
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {resolving && (
        <ResolveDialog
          finding={resolving}
          onCancel={() => setResolving(null)}
          onDone={() => {
            setResolving(null);
            invalidate();
          }}
        />
      )}
    </AppShell>
  );
}

function ResolveDialog({
  finding,
  onCancel,
  onDone,
}: {
  finding: QualityFindingWithContext;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await resolveFinding(finding.id, note);
      toast.success("Finding resolved.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resolve");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="panel w-full max-w-sm space-y-4 bg-card p-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resolve finding
          </h2>
          <p className="mt-2 text-sm">{finding.message}</p>
        </div>
        <Input
          placeholder="Resolution note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Mark resolved"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
