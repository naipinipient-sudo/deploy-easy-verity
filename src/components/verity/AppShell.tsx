import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bike,
  Database,
  GitCompare,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/workspaces", label: "Workspaces", icon: Layers },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/explore", label: "Explore", icon: BarChart3 },
  { to: "/riders", label: "Rider Performance", icon: Bike },
  { to: "/ai-analyst", label: "AI Analyst", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { workspaces, activeWorkspace, selectWorkspace } = useActiveWorkspace();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Link to="/overview" className="flex items-center gap-2 px-2 py-1">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-display text-lg font-semibold tracking-tight">Verity</span>
        </Link>

        <div className="mt-6">
          <label className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workspace
          </label>
          <Select
            value={activeWorkspace?.id ?? ""}
            onValueChange={(value) => {
              if (value === "__new") {
                navigate({ to: "/workspaces/new" });
                return;
              }
              selectWorkspace(value);
            }}
          >
            <SelectTrigger className="mt-2 w-full">
              <SelectValue placeholder="No workspace yet" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
              <SelectItem value="__new">+ New workspace</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to as never}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Button variant="ghost" size="sm" className="justify-start" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-surface/60 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">{title}</h1>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to as never}
                className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
