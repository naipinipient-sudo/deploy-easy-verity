import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompare } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  commonMappedFields,
  listVersionOptions,
  runCompare,
  type CompareSummary,
  type CompareResults,
} from "@/lib/verity/compare";

export const Route = createFileRoute("/_authenticated/compare")({
  component: ComparePage,
});

function ComparePage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title="Compare">
        <LoadingState label="Loading workspace" />
      </AppShell>
    );
  }

  if (!activeWorkspace) {
    return (
      <AppShell title="Compare">
        <EmptyState
          icon={<GitCompare className="h-5 w-5" aria-hidden />}
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

  return <CompareForWorkspace workspaceId={activeWorkspace.id} />;
}

function CompareForWorkspace({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    queryKey: ["dataset-versions-options", workspaceId],
    queryFn: () => listVersionOptions(workspaceId),
  });

  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [keyField, setKeyField] = useState("");
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ summary: CompareSummary; runId: string } | null>(null);
  const [results, setResults] = useState<CompareResults | null>(null);

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
    setResults(null);
    try {
      const outcome = await runCompare({
        workspaceId,
        leftVersionId: leftId,
        rightVersionId: rightId,
        keyField: keyField as never,
        userId: userData.user.id,
      });
      setOutcome(outcome);
      const { data } = await supabase.from("compare_runs").select("results").eq("id", outcome.runId).single();
      setResults((data?.results ?? null) as CompareResults | null);
      queryClient.invalidateQueries({ queryKey: ["audit-events", workspaceId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Compare failed");
    } finally {
      setBusy(false);
    }
  };

  if (versionsQuery.isLoading) {
    return (
      <AppShell title="Compare">
        <LoadingState label="Loading datasets" />
      </AppShell>
    );
  }
  if (versionsQuery.error) {
    return (
      <AppShell title="Compare">
        <ErrorState message={versionsQuery.error.message} onRetry={() => versionsQuery.refetch()} />
      </AppShell>
    );
  }

  const versions = versionsQuery.data ?? [];
  if (versions.length < 2) {
    return (
      <AppShell title="Compare" description="Compare two dataset versions by a shared key field.">
        <EmptyState
          icon={<GitCompare className="h-5 w-5" aria-hidden />}
          title="Need at least two dataset versions"
          description="Import at least two versions (or two datasets) before comparing."
          action={
            <Button asChild size="sm">
              <Link to="/datasets">Go to Datasets</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const fieldLabel = (key: string) => CANONICAL_FIELDS.find((f) => f.key === key)?.label ?? key;

  return (
    <AppShell title="Compare" description="Compare two dataset versions by a shared key field.">
      <div className="panel space-y-4 p-6">
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
        <Button onClick={run} disabled={busy || !leftId || !rightId || !keyField}>
          {busy ? "Comparing…" : "Run compare"}
        </Button>
      </div>

      {outcome && results && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Matched" value={outcome.summary.matched} />
            <StatCard label="Changed" value={outcome.summary.changedField} />
            <StatCard label="Only A" value={outcome.summary.onlyLeft} />
            <StatCard label="Only B" value={outcome.summary.onlyRight} />
            <StatCard label="Dup keys (A/B)" value={`${outcome.summary.duplicateKeyLeft}/${outcome.summary.duplicateKeyRight}`} />
            <StatCard label="Ambiguous" value={outcome.summary.ambiguous} />
          </div>

          <ResultTable
            title="Changed field"
            rows={results.changed}
            headers={["Key", "Fields", "A value", "B value"]}
            renderRow={(row) => (
              <>
                <TableCell className="font-mono text-xs">{row.key}</TableCell>
                <TableCell className="text-xs">{row.diffFields.join(", ")}</TableCell>
                <TableCell className="max-w-40 truncate text-xs">
                  {row.diffFields.map((f: string) => row.left[f]).join(", ")}
                </TableCell>
                <TableCell className="max-w-40 truncate text-xs">
                  {row.diffFields.map((f: string) => row.right[f]).join(", ")}
                </TableCell>
              </>
            )}
          />

          <ResultTable
            title="Only in A"
            rows={results.onlyLeft}
            headers={["Key"]}
            renderRow={(row) => <TableCell className="font-mono text-xs">{row.key}</TableCell>}
          />

          <ResultTable
            title="Only in B"
            rows={results.onlyRight}
            headers={["Key"]}
            renderRow={(row) => <TableCell className="font-mono text-xs">{row.key}</TableCell>}
          />

          <ResultTable
            title="Ambiguous keys"
            rows={results.ambiguous}
            headers={["Key", "Occurrences"]}
            renderRow={(row) => (
              <>
                <TableCell className="font-mono text-xs">{row.key}</TableCell>
                <TableCell className="text-xs">{row.leftCount} in A, {row.rightCount} in B</TableCell>
              </>
            )}
          />
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ResultTable<T>({
  title,
  rows,
  headers,
  renderRow,
}: {
  title: string;
  rows: T[];
  headers: string[];
  renderRow: (row: T) => React.ReactNode;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <Badge variant="secondary">{rows.length} shown</Badge>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>{renderRow(row)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
