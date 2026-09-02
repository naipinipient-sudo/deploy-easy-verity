import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, FileSearch, Layers, Users } from "lucide-react";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/verity/states";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { getWorkspaceStats, listAuditEvents } from "@/lib/verity/workspaces";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/overview")({
  component: OverviewPage,
});

function OverviewPage() {
  const { t } = useLang();
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
      <AppShell title={t("overview.title")}>
        <LoadingState label={t("common.loadingWorkspace")} />
      </AppShell>
    );
  }

  if (!activeWorkspace) {
    return (
      <AppShell title={t("overview.title")}>
        <EmptyState
          icon={<Layers className="h-5 w-5" aria-hidden />}
          title={t("common.noWorkspaceSelected")}
          description={t("overview.noWorkspaceDescription")}
          action={
            <Button asChild size="sm">
              <Link to="/workspaces/new">{t("workspaces.createWorkspace")}</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const stats = statsQuery.data;

  return (
    <AppShell title={activeWorkspace.name} description={t("overview.description")}>
      {statsQuery.error ? (
        <ErrorState message={statsQuery.error.message} onRetry={() => statsQuery.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Database} label={t("overview.statDatasets")} value={stats?.datasets} />
          <StatCard icon={FileSearch} label={t("overview.statVersions")} value={stats?.versions} />
          <StatCard icon={Layers} label={t("overview.statFindings")} value={stats?.openFindings} />
          <StatCard icon={Users} label={t("overview.statMembers")} value={stats?.members} />
        </div>
      )}

      <div className="panel mt-6 p-5">
        <h2 className="text-sm font-semibold">{t("overview.recentActivity")}</h2>
        {auditQuery.isLoading ? (
          <div className="mt-3">
            <LoadingState label={t("common.loading")} rows={2} />
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
          <p className="mt-3 text-sm text-muted-foreground">{t("overview.noActivity")}</p>
        )}
      </div>

      <div className="mt-6">
        <Button asChild>
          <Link to="/datasets">{t("overview.goToDatasets")}</Link>
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
