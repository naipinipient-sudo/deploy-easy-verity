import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, FileSearch, Layers, Users } from "lucide-react";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/verity/states";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { getWorkspaceStats, listAuditEvents } from "@/lib/verity/workspaces";

export const Route = createFileRoute("/_authenticated/overview")({
  component: OverviewPage,
});

function OverviewPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  const statsQuery = useQuery({
    queryKey: ["workspace-stats", activeWorkspace?.id],
    queryFn: () => getWorkspaceStats(activeWorkspace!.id),
    enabled: !!activeWorkspace,
  });
  const auditQuery = useQuery({
    queryKey: ["audit-events", activeWorkspace?.id],
    queryFn: () => listAuditEvents(activeWorkspace!.id, 8),
    enabled: !!activeWorkspace,
  });

  if (workspaceLoading) {
    return (
      <AppShell title="Overview">
        <LoadingState label="Loading workspace" />
      </AppShell>
    );
  }

  if (!activeWorkspace) {
    return (
      <AppShell title="Overview">
        <EmptyState
          icon={<Layers className="h-5 w-5" aria-hidden />}
          title="No workspace selected"
          description="Create or pick a workspace to see its overview."
          action={
            <Button asChild size="sm">
              <Link to="/workspaces/new">Create workspace</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const stats = statsQuery.data;

  return (
    <AppShell title={activeWorkspace.name} description="Overview of this workspace's data.">
      {statsQuery.error ? (
        <ErrorState message={statsQuery.error.message} onRetry={() => statsQuery.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Database} label="Datasets" value={stats?.datasets} />
          <StatCard icon={FileSearch} label="Versions imported" value={stats?.versions} />
          <StatCard icon={Layers} label="Open quality findings" value={stats?.openFindings} />
          <StatCard icon={Users} label="Members" value={stats?.members} />
        </div>
      )}

      <div className="panel mt-6 p-5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {auditQuery.isLoading ? (
          <div className="mt-3">
            <LoadingState label="Loading activity" rows={2} />
          </div>
        ) : auditQuery.data && auditQuery.data.length > 0 ? (
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
          <p className="mt-3 text-sm text-muted-foreground">No activity yet — import a dataset to get started.</p>
        )}
      </div>

      <div className="mt-6">
        <Button asChild>
          <Link to="/datasets">Go to datasets</Link>
        </Button>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="panel p-5">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <p className="mt-3 text-2xl font-semibold">{value ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
