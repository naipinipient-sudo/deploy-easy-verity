import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspace } from "@/lib/verity/workspaces";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export const Route = createFileRoute("/_authenticated/workspaces/new")({
  component: NewWorkspacePage,
});

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function NewWorkspacePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectWorkspace } = useActiveWorkspace();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const workspace = await createWorkspace({
        name: name.trim(),
        timezone: DEFAULT_TIMEZONE,
        currency: "USD",
      });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      selectWorkspace(workspace.id);
      navigate({ to: "/datasets" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="New workspace" description="A workspace holds its own datasets, rules, and members.">
      <form onSubmit={submit} className="panel max-w-md space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input id="ws-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Timezone defaults to {DEFAULT_TIMEZONE}, currency to USD — changeable later in Settings.
        </p>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create workspace"}
        </Button>
      </form>
    </AppShell>
  );
}
