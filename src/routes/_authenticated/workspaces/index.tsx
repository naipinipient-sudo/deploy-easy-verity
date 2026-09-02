import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layers, Plus } from "lucide-react";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/verity/states";
import { workspacesQueryOptions, useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/workspaces/")({
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const query = useQuery(workspacesQueryOptions());
  const { selectWorkspace } = useActiveWorkspace();

  const openWorkspace = (id: string) => {
    selectWorkspace(id);
    navigate({ to: "/datasets" });
  };

  return (
    <AppShell
      title={t("workspaces.title")}
      description={t("workspaces.description")}
      actions={
        <Button asChild size="sm">
          <Link to="/workspaces/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {t("workspaces.newWorkspace")}
          </Link>
        </Button>
      }
    >
      {query.isLoading ? (
        <LoadingState label={t("workspaces.loading")} />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : query.data && query.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((ws) => (
            <button
              key={ws.id}
              onClick={() => openWorkspace(ws.id)}
              className="panel flex flex-col gap-2 p-5 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{ws.name}</span>
                <Badge variant="secondary">{ws.role}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {ws.timezone} · {ws.currency}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Layers className="h-5 w-5" aria-hidden />}
          title={t("workspaces.emptyTitle")}
          description={t("workspaces.emptyDescription")}
          action={
            <Button asChild size="sm">
              <Link to="/workspaces/new">{t("workspaces.createWorkspace")}</Link>
            </Button>
          }
        />
      )}
    </AppShell>
  );
}
