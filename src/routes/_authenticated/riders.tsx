import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/verity/AppShell";
import { Button } from "@/components/ui/button";
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
import { describeError } from "@/lib/verity/errors";
import { listExploreSources, loadExploreSource, type ExploreSourceOption } from "@/lib/verity/explore";
import { applyFilters, type Filter } from "@/lib/verity/exploreRules";
import { computeRiderKpis, type RiderKpi } from "@/lib/verity/riderRules";

export const Route = createFileRoute("/_authenticated/riders")({
  component: RidersPage,
});

type SortKey = keyof Pick<RiderKpi, "jobs" | "completedRate" | "cancelledRate" | "totalAmount" | "activeDays">;
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "jobs", label: "Jobs" },
  { value: "completedRate", label: "Completed rate" },
  { value: "cancelledRate", label: "Cancellation rate" },
  { value: "totalAmount", label: "Total amount" },
  { value: "activeDays", label: "Active days" },
];

function RidersPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title="Rider performance">
        <LoadingState label="Loading workspace" />
      </AppShell>
    );
  }
  if (!activeWorkspace) {
    return (
      <AppShell title="Rider performance">
        <EmptyState
          icon={<Users className="h-5 w-5" aria-hidden />}
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
  return <RidersForWorkspace workspaceId={activeWorkspace.id} />;
}

function RidersForWorkspace({ workspaceId }: { workspaceId: string }) {
  const [source, setSource] = useState<ExploreSourceOption | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("jobs");
  const [period, setPeriod] = useState<string>("");
  const [selectedRider, setSelectedRider] = useState<string | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ["explore-sources", workspaceId],
    queryFn: () => listExploreSources(workspaceId),
  });

  const dataQuery = useQuery({
    queryKey: ["explore-data", source?.type, source?.id],
    queryFn: () => loadExploreSource(source!),
    enabled: !!source,
  });

  const hasRiderField = dataQuery.data?.fields.includes("rider_id") ?? false;
  const hasPeriodField = dataQuery.data?.fields.includes("transaction_date") || dataQuery.data?.fields.includes("period");
  const periodField = dataQuery.data?.fields.includes("period") ? "period" : "transaction_date";

  const filteredRows = useMemo(() => {
    if (!dataQuery.data) return [];
    const filters: Filter[] = period ? [{ field: periodField, op: "contains", value: period }] : [];
    return applyFilters(dataQuery.data.rows, filters);
  }, [dataQuery.data, period, periodField]);

  const kpis = useMemo(() => {
    if (!dataQuery.data || !hasRiderField) return [];
    const fields = dataQuery.data.fields;
    const list = computeRiderKpis(filteredRows, {
      riderId: "rider_id",
      riderName: fields.includes("rider_name") ? "rider_name" : undefined,
      status: fields.includes("status") ? "status" : undefined,
      amount: fields.includes("amount") ? "amount" : undefined,
      date: fields.includes("transaction_date") ? "transaction_date" : undefined,
    });
    return [...list].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  }, [dataQuery.data, filteredRows, hasRiderField, sortKey]);

  const drilldownRows = useMemo(() => {
    if (!selectedRider) return [];
    return filteredRows.filter((r) => r["rider_id"] === selectedRider);
  }, [filteredRows, selectedRider]);

  return (
    <AppShell
      title="Rider performance"
      description="Rider KPIs are informational only — never use them for employment, compensation, disciplinary, or eligibility decisions."
    >
      <div className="space-y-6">
        <div className="panel flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-64 space-y-2">
            <Label>Source</Label>
            <Select
              value={source ? `${source.type}:${source.id}` : ""}
              onValueChange={(v) => {
                const found = (sourcesQuery.data ?? []).find((s) => `${s.type}:${s.id}` === v) ?? null;
                setSource(found);
                setSelectedRider(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a dataset or master version" />
              </SelectTrigger>
              <SelectContent>
                {(sourcesQuery.data ?? []).map((s) => (
                  <SelectItem key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>
                    {s.label} ({s.rowCount} rows)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasPeriodField && (
            <div className="min-w-40 space-y-2">
              <Label>Period contains</Label>
              <input
                className="flex h-9 w-full border-2 border-input bg-card px-3 py-2 text-sm"
                placeholder="e.g. 2026-01"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
          )}
          {kpis.length > 0 && (
            <div className="min-w-44 space-y-2">
              <Label>Rank by</Label>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {!source ? (
          <EmptyState icon={<Users className="h-5 w-5" aria-hidden />} title="Pick a source" description="Choose a dataset or master version above." />
        ) : dataQuery.isLoading ? (
          <LoadingState label="Loading rows" />
        ) : dataQuery.isError ? (
          <ErrorState message={describeError(dataQuery.error, "Could not load rows")} />
        ) : !hasRiderField ? (
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
            title="No rider field mapped"
            description={`"${source.label}" has no column mapped to Rider ID. Map one in the dataset's mapping editor to see rider performance.`}
          />
        ) : (
          <>
            <div className="panel overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rider</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Completed rate</TableHead>
                    <TableHead className="text-right">Cancellation rate</TableHead>
                    <TableHead className="text-right">Total amount</TableHead>
                    <TableHead className="text-right">Active days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.map((k, i) => (
                    <TableRow
                      key={k.riderId}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setSelectedRider(k.riderId === selectedRider ? null : k.riderId)}
                    >
                      <TableCell className="font-medium">
                        #{i + 1} {k.riderName}
                      </TableCell>
                      <TableCell className="text-right">{k.jobs}</TableCell>
                      <TableCell className="text-right">{k.completedRate !== null ? `${(k.completedRate * 100).toFixed(0)}%` : "—"}</TableCell>
                      <TableCell className="text-right">{k.cancelledRate !== null ? `${(k.cancelledRate * 100).toFixed(0)}%` : "—"}</TableCell>
                      <TableCell className="text-right">{k.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{k.activeDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {kpis.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No rows match this period.</p>}
            </div>

            {selectedRider && (
              <div className="panel space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Label>Source rows for {kpis.find((k) => k.riderId === selectedRider)?.riderName ?? selectedRider}</Label>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedRider(null)}>
                    Close
                  </Button>
                </div>
                <div className="max-h-96 overflow-auto border-2 border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {dataQuery.data!.fields.map((f) => (
                          <TableHead key={f} className="whitespace-nowrap">{f}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldownRows.slice(0, 100).map((row, i) => (
                        <TableRow key={i}>
                          {dataQuery.data!.fields.map((f) => (
                            <TableCell key={f} className="whitespace-nowrap">
                              {row[f] || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  {drilldownRows.length} underlying rows — evidence for the KPIs above.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
