import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/datasets", label: "Datasets", soon: false },
  { to: "/quality", label: "Quality", soon: false },
  { to: "/compare", label: "Compare", soon: true },
  { to: "/reconcile", label: "Reconcile", soon: true },
  { to: "/master", label: "Master", soon: true },
  { to: "/explore", label: "Explore", soon: true },
  { to: "/riders", label: "Riders", soon: true },
  { to: "/ai-analyst", label: "AI analyst", soon: true },
  { to: "/settings", label: "Settings", soon: false },
] as const;

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeWorkspace } = useActiveWorkspace();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-header px-6 py-3 text-header-foreground">
        <div className="flex items-center gap-3">
          <Link to="/overview" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
              V
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Verity</span>
          </Link>
          <Badge variant="outline" className="border-primary text-primary">
            Read-only sources
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            to="/workspaces"
            className="border-2 border-header-foreground/60 px-3 py-1 font-semibold uppercase tracking-wide hover:border-header-foreground"
          >
            {activeWorkspace?.name ?? "No workspace"}
          </Link>
          {activeWorkspace && (
            <span className="border-2 border-header-foreground/60 px-3 py-1 font-semibold uppercase tracking-wide">
              {activeWorkspace.timezone} · {activeWorkspace.currency}
            </span>
          )}
          {user && (
            <button
              onClick={signOut}
              title="Sign out"
              className="rounded-full bg-header-foreground px-3 py-1 font-semibold text-header lowercase"
            >
              {user.email}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-64">
          <nav className="panel flex flex-col gap-2 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace
            </span>
            {NAV.map((item) =>
              item.soon ? (
                <div
                  key={item.to}
                  className="flex items-center justify-between border-2 border-dashed border-border/50 px-3 py-2 text-sm text-muted-foreground"
                >
                  <span>{item.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Soon
                  </Badge>
                </div>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  className="border-2 border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-accent"
                  activeProps={{ className: "border-2 border-border bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold" }}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="border-2 border-border bg-secondary p-4">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Principle
            </span>
            <p className="mt-2 text-sm font-medium">
              Verity never writes back to a source system. Uploads are immutable evidence.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Workspace home
              </p>
              <h1 className={cn("truncate text-3xl font-bold")}>{title}</h1>
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
