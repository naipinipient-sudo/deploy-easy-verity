import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWorkspaces, type WorkspaceWithRole } from "@/lib/verity/workspaces";

const STORAGE_KEY = "verity.activeWorkspaceId";

export function workspacesQueryOptions() {
  return {
    queryKey: ["workspaces"] as const,
    queryFn: listWorkspaces,
  };
}

/**
 * Tracks the workspace currently in focus. Persisted client-side only;
 * every read is still enforced by workspace membership rules in the backend.
 */
export function useActiveWorkspace() {
  const workspacesQuery = useQuery(workspacesQueryOptions());
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const workspaces: WorkspaceWithRole[] = workspacesQuery.data ?? [];
  const active =
    workspaces.find((w) => w.id === activeId) ?? (workspaces.length > 0 ? workspaces[0] : null);

  const selectWorkspace = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    setActiveId(id);
  }, []);

  return {
    workspaces,
    activeWorkspace: active ?? null,
    selectWorkspace,
    isLoading: workspacesQuery.isLoading,
    error: workspacesQuery.error as Error | null,
  };
}
