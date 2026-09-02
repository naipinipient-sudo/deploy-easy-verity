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
import { describeError } from "@/lib/verity/errors";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/workspaces/new")({
  component: NewWorkspacePage,
});

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function NewWorkspacePage() {
  const navigate = useNavigate();
  const { t } = useLang();
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
      toast.error(describeError(error, "Could not create workspace"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title={t("workspaces.newTitle")} description={t("workspaces.newDescription")}>
      <form onSubmit={submit} className="panel max-w-md space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="ws-name">{t("workspaces.nameLabel")}</Label>
          <Input id="ws-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{t("workspaces.timezoneHint", { tz: DEFAULT_TIMEZONE })}</p>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? t("workspaces.creating") : t("workspaces.createWorkspace")}
        </Button>
      </form>
    </AppShell>
  );
}
