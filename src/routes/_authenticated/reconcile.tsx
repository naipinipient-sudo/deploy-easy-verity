import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";
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
import { listVersionOptions, commonMappedFields } from "@/lib/verity/compare";
import {
  runReconciliation,
  listReconciliationItems,
  decideItem,
  type ReconciliationItemRow,
} from "@/lib/verity/reconcile";

export const Route = createFileRoute("/_authenticated/reconcile")({
  component: ReconcilePage,
});

function ReconcilePage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title="Reconcile">
        <LoadingState label="Loading workspace" />
      </AppShell>
    );
  }
  if (!activeWorkspace) {
    return (
      <AppShell title="Reconcile">
        <EmptyState
          icon={<Scale className="h-5 w-5" aria-hidden />}
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
  return <ReconcileForWorkspace workspaceId={activeWorkspace.id} />;
}

function ReconcileForWorkspace({ workspaceId }: { workspaceId: string }) {
  const versionsQuery = useQuery({
    queryKey: ["dataset-versions-options", workspaceId],
    queryFn: () => listVersionOptions(workspaceId),
  });

  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [keyField, setKeyField] = useState("");
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [amountTolerance, setAmountTolerance] = useState("0");
  const [dateToleranceDays, setDateToleranceDays] = useState("0");
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!leftId || !rightId) {
      setAvailableKeys([]);
      setKeyField("");
      return;
    }
    commonMappedFields(leftId, rightId).then((keys) => {
      setAvailableKeys(keys);
      setKeyField((current) => (keys.includes(current as never) ? current : keys[0] ?? ""));
    });
  }, [leftId, rightId]);

  const run = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setBusy(true);
    try {
      const outcome = await runReconciliation({
        workspaceId,
        leftVersionId: leftId,
        rightVersionId: rightId,
        keyField: keyField as never,
        tolerance: {
          amountTolerance: Number(amountTolerance) || 0,
          dateToleranceDays: Number(dateToleranceDays) || 0,
        },
        userId: userData.user.id,
      });
      setRunId(outcome.runId);
      toast.success(`Reconciliation run created — ${outcome.items.length} item(s) to review.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reconciliation failed");
    } finally {
      setBusy(false);
    }
  };

  if (versionsQuery.isLoading) {
    return (
      <AppShell title="Reconcile">
        <LoadingState label="Loading datasets" />
      </AppShell>
    );
  }
  const versions = versionsQuery.data ?? [];
  const fieldLabel = (key: string) => CANONICAL_FIELDS.find((f) => f.key === key)?.label ?? key;

  return (
    <AppShell title="Reconcile" description="Scored candidate matches across a key field, with amount/date tolerance.">
      {runId ? (
        <ReviewQueue workspaceId={workspaceId} runId={runId} onBack={() => setRunId(null)} />
      ) : (
        <div className="panel space-y-4 p-6">
          {versions.length < 2 ? (
            <EmptyState
              icon={<Scale className="h-5 w-5" aria-hidden />}
              title="Need at least two dataset versions"
              description="Import at least two versions before reconciling."
              action={
                <Button asChild size="sm">
                  <Link to="/datasets">Go to Datasets</Link>
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Version A</Label>
                  <Select value={leftId} onValueChange={setLeftId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Pick a version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Version B</Label>
                  <Select value={rightId} onValueChange={setRightId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Pick a version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Key field</Label>
                  <Select value={keyField} onValueChange={setKeyField} disabled={availableKeys.length === 0}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={availableKeys.length === 0 ? "Pick both versions first" : "Pick a key"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableKeys.map((k) => (
                        <SelectItem key={k} value={k}>
                          {fieldLabel(k)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Amount tolerance (±)</Label>
                  <Input
                    className="mt-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountTolerance}
                    onChange={(e) => setAmountTolerance(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Date tolerance (± days)</Label>
                  <Input
                    className="mt-2"
                    type="number"
                    min="0"
                    step="1"
                    value={dateToleranceDays}
                    onChange={(e) => setDateToleranceDays(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={run} disabled={busy || !leftId || !rightId || !keyField}>
                {busy ? "Running…" : "Run reconciliation"}
              </Button>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

const STATE_VARIANT = {
  proposed: "outline",
  unmatched: "secondary",
  ambiguous: "warning",
  matched: "default",
  excluded: "destructive",
} as const;

function ReviewQueue({ workspaceId, runId, onBack }: { workspaceId: string; runId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState<string>("proposed");
  const [overriding, setOverriding] = useState<ReconciliationItemRow | null>(null);

  const query = useQuery({
    queryKey: ["reconciliation-items", runId],
    queryFn: () => listReconciliationItems(runId),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["reconciliation-items", runId] });

  const decide = async (item: ReconciliationItemRow, decision: "matched" | "excluded", note: string | null, isOverride: boolean) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    try {
      await decideItem({ workspaceId, itemId: item.id, decision, isOverride, note, userId: userData.user.id });
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save decision");
    }
  };

  const items = (query.data ?? []).filter((i) => stateFilter === "all" || i.state === stateFilter);
  const counts = (query.data ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.state] = (acc[i.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← New run
        </Button>
        <div className="flex gap-2">
          {(["proposed", "unmatched", "ambiguous", "matched", "excluded", "all"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={stateFilter === s ? "default" : "outline"}
              onClick={() => setStateFilter(s)}
            >
              {s} {s !== "all" ? `(${counts[s] ?? 0})` : ""}
            </Button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState label="Loading items" />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here" description="No items match this filter." />
      ) : (
        <div className="panel overflow-x-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>A</TableHead>
                <TableHead>B</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const explanation = (item.explanation ?? {}) as {
                  fieldMatches?: { field: string; matched: boolean; leftValue: string; rightValue: string; detail?: string }[];
                };
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={STATE_VARIANT[item.state as keyof typeof STATE_VARIANT] ?? "outline"}>
                        {item.state}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.state === "proposed" ? `${item.score}%` : "—"}</TableCell>
                    <TableCell className="max-w-56 text-xs">
                      {(explanation.fieldMatches ?? []).map((m) => (
                        <div key={m.field} className={m.matched ? "text-muted-foreground" : "text-destructive"}>
                          {m.field}: {m.leftValue || "∅"} / {m.rightValue || "∅"} {m.detail ? `(${m.detail})` : ""}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="max-w-32 truncate text-xs">
                      {JSON.stringify(item.left_row ?? {})}
                    </TableCell>
                    <TableCell className="max-w-32 truncate text-xs">
                      {JSON.stringify(item.right_row ?? {})}
                    </TableCell>
                    <TableCell>
                      {item.state === "proposed" || item.state === "ambiguous" ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => decide(item, "matched", null, false)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => decide(item, "excluded", null, false)}>
                            Reject
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setOverriding(item)}>
                            Override
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{item.note}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {overriding && (
        <OverrideDialog
          onCancel={() => setOverriding(null)}
          onConfirm={async (decision, note) => {
            await decide(overriding, decision, note, true);
            setOverriding(null);
          }}
        />
      )}
    </div>
  );
}

function OverrideDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (decision: "matched" | "excluded", note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="panel w-full max-w-sm space-y-4 bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Override decision</h2>
        <Input placeholder="Note (recommended)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2">
          <Button onClick={() => onConfirm("matched", note)}>Force match</Button>
          <Button variant="outline" onClick={() => onConfirm("excluded", note)}>
            Force exclude
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
