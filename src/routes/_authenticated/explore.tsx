import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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
import { useAuth } from "@/hooks/useAuth";
import { describeError } from "@/lib/verity/errors";
import { CANONICAL_FIELDS } from "@/lib/verity/canonical";
import {
  listExploreSources,
  loadExploreSource,
  listSavedViews,
  createSavedView,
  deleteSavedView,
  exportRows,
  type ExploreSourceOption,
  type SavedViewConfig,
} from "@/lib/verity/explore";
import { applyFilters, sortRows, pivot, type Filter, type FilterOp, type AggType } from "@/lib/verity/exploreRules";

export const Route = createFileRoute("/_authenticated/explore")({
  component: ExplorePage,
});

const FIELD_LABEL = new Map(CANONICAL_FIELDS.map((f) => [f.key, f.label]));
function label(field: string) {
  return FIELD_LABEL.get(field as never) ?? field;
}

const FILTER_OPS: { value: FilterOp; label: string; needsValue: boolean }[] = [
  { value: "eq", label: "=", needsValue: true },
  { value: "neq", label: "≠", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "gt", label: ">", needsValue: true },
  { value: "gte", label: "≥", needsValue: true },
  { value: "lt", label: "<", needsValue: true },
  { value: "lte", label: "≤", needsValue: true },
  { value: "blank", label: "is blank", needsValue: false },
  { value: "not_blank", label: "is not blank", needsValue: false },
];

const AGG_TYPES: { value: AggType; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count" },
  { value: "count_distinct", label: "Count distinct" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

type ChartType = "table" | "bar" | "line" | "area" | "kpi";

function ExplorePage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title="Explore">
        <LoadingState label="Loading workspace" />
      </AppShell>
    );
  }
  if (!activeWorkspace) {
    return (
      <AppShell title="Explore">
        <EmptyState
          icon={<Compass className="h-5 w-5" aria-hidden />}
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
  return <ExploreForWorkspace workspaceId={activeWorkspace.id} />;
}

function ExploreForWorkspace({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [source, setSource] = useState<ExploreSourceOption | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [dimensionField, setDimensionField] = useState<string | null>(null);
  const [measureField, setMeasureField] = useState<string | null>(null);
  const [aggType, setAggType] = useState<AggType>("sum");
  const [chartType, setChartType] = useState<ChartType>("table");
  const [viewName, setViewName] = useState("");

  const sourcesQuery = useQuery({
    queryKey: ["explore-sources", workspaceId],
    queryFn: () => listExploreSources(workspaceId),
  });

  const dataQuery = useQuery({
    queryKey: ["explore-data", source?.type, source?.id],
    queryFn: () => loadExploreSource(source!),
    enabled: !!source,
  });

  const savedViewsQuery = useQuery({
    queryKey: ["saved-views", source?.type, source?.id],
    queryFn: () => listSavedViews(workspaceId, source!.type, source!.id),
    enabled: !!source,
  });

  const fields = dataQuery.data?.fields ?? [];
  const processedRows = useMemo(() => {
    if (!dataQuery.data) return [];
    const filtered = applyFilters(dataQuery.data.rows, filters);
    return sortRows(filtered, sortField, sortDir);
  }, [dataQuery.data, filters, sortField, sortDir]);

  const pivotBuckets = useMemo(() => {
    if (!dimensionField) return [];
    return pivot(processedRows, dimensionField, measureField, aggType).slice(0, 50);
  }, [processedRows, dimensionField, measureField, aggType]);

  const kpiValue = useMemo(() => {
    if (chartType !== "kpi" || !measureField) return null;
    return pivot(processedRows, "__all__", measureField, aggType)[0]?.value ?? 0;
  }, [processedRows, measureField, aggType, chartType]);

  const addFilter = () => {
    if (fields.length === 0) return;
    setFilters((f) => [...f, { field: fields[0]!, op: "eq", value: "" }]);
  };
  const updateFilter = (i: number, patch: Partial<Filter>) =>
    setFilters((f) => f.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeFilter = (i: number) => setFilters((f) => f.filter((_, idx) => idx !== i));

  const applyViewConfig = (config: SavedViewConfig) => {
    setFilters((config.filters as Filter[]) ?? []);
    setSortField(config.sortField);
    setSortDir(config.sortDir);
  };

  const saveView = async () => {
    if (!source || !user || !viewName.trim()) return;
    try {
      await createSavedView({
        workspaceId,
        sourceType: source.type,
        sourceId: source.id,
        name: viewName.trim(),
        config: { filters, sortField, sortDir, visibleFields: fields },
        userId: user.id,
      });
      setViewName("");
      await queryClient.invalidateQueries({ queryKey: ["saved-views", source.type, source.id] });
      toast.success("View saved");
    } catch (error) {
      toast.error(describeError(error, "Could not save view"));
    }
  };

  return (
    <AppShell
      title="Explore"
      description="Browse, filter, pivot, and chart a dataset or master version. Nothing here writes back to a source."
    >
      <div className="space-y-6">
        <div className="panel flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-64 space-y-2">
            <Label>Source</Label>
            {sourcesQuery.isLoading ? (
              <LoadingState label="Loading sources" rows={1} />
            ) : (
              <Select
                value={source ? `${source.type}:${source.id}` : ""}
                onValueChange={(v) => {
                  const found = (sourcesQuery.data ?? []).find((s) => `${s.type}:${s.id}` === v) ?? null;
                  setSource(found);
                  setFilters([]);
                  setDimensionField(null);
                  setMeasureField(null);
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
            )}
          </div>

          {savedViewsQuery.data && savedViewsQuery.data.length > 0 && (
            <div className="min-w-56 space-y-2">
              <Label>Saved views</Label>
              <Select
                onValueChange={(id) => {
                  const view = savedViewsQuery.data!.find((v) => v.id === id);
                  if (view) applyViewConfig(view.config as unknown as SavedViewConfig);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Apply a saved view" />
                </SelectTrigger>
                <SelectContent>
                  {savedViewsQuery.data.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {!source ? (
          <EmptyState
            icon={<Compass className="h-5 w-5" aria-hidden />}
            title="Pick a source to explore"
            description="Choose a dataset version or a published master version above."
          />
        ) : dataQuery.isLoading ? (
          <LoadingState label="Loading rows" />
        ) : dataQuery.isError ? (
          <ErrorState message={describeError(dataQuery.error, "Could not load rows")} />
        ) : (
          <>
            <div className="panel space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Label>Filters</Label>
                <Button size="sm" variant="outline" onClick={addFilter}>
                  Add filter
                </Button>
              </div>
              {filters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No filters — showing all {processedRows.length} rows.</p>
              ) : (
                <div className="space-y-2">
                  {filters.map((f, i) => {
                    const opDef = FILTER_OPS.find((o) => o.value === f.op)!;
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <Select value={f.field} onValueChange={(v) => updateFilter(i, { field: v })}>
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((field) => (
                              <SelectItem key={field} value={field}>
                                {label(field)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={f.op} onValueChange={(v) => updateFilter(i, { op: v as FilterOp })}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {opDef.needsValue && (
                          <Input
                            className="w-40"
                            value={f.value ?? ""}
                            onChange={(e) => updateFilter(i, { value: e.target.value })}
                          />
                        )}
                        <Button size="icon" variant="ghost" onClick={() => removeFilter(i)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">{processedRows.length} of {dataQuery.data!.rows.length} rows match.</p>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2 border-t-2 border-border pt-3">
                <Input
                  placeholder="View name"
                  className="w-48"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                />
                <Button size="sm" onClick={saveView} disabled={!viewName.trim()}>
                  Save view
                </Button>
                {savedViewsQuery.data?.map((v) => (
                  <Button
                    key={v.id}
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await deleteSavedView(v.id);
                      await queryClient.invalidateQueries({ queryKey: ["saved-views", source.type, source.id] });
                    }}
                    title={`Delete "${v.name}"`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> {v.name}
                  </Button>
                ))}
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportRows(processedRows, fields, source.label, "csv")}>
                    <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportRows(processedRows, fields, source.label, "xlsx")}>
                    <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> XLSX
                  </Button>
                </div>
              </div>
            </div>

            <div className="panel space-y-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>View as</Label>
                  <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                      <SelectItem value="kpi">KPI card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {chartType !== "table" && (
                  <>
                    {chartType !== "kpi" && (
                      <div className="space-y-2">
                        <Label>Group by (dimension)</Label>
                        <Select value={dimensionField ?? ""} onValueChange={setDimensionField}>
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="Pick a field" />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((f) => (
                              <SelectItem key={f} value={f}>
                                {label(f)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Measure</Label>
                      <Select value={measureField ?? "__count__"} onValueChange={(v) => setMeasureField(v === "__count__" ? null : v)}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__count__">Row count</SelectItem>
                          {fields.map((f) => (
                            <SelectItem key={f} value={f}>
                              {label(f)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Aggregation</Label>
                      <Select value={aggType} onValueChange={(v) => setAggType(v as AggType)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGG_TYPES.map((a) => (
                            <SelectItem key={a.value} value={a.value}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {chartType === "table" && <RowTable fields={fields} rows={processedRows} sortField={sortField} sortDir={sortDir} onSort={(f) => {
                if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                else { setSortField(f); setSortDir("asc"); }
              }} />}

              {chartType === "kpi" && (
                <div className="border-2 border-border bg-secondary p-8 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {AGG_TYPES.find((a) => a.value === aggType)?.label} of {measureField ? label(measureField) : "rows"}
                  </p>
                  <p className="mt-2 text-4xl font-bold">{kpiValue !== null ? formatNumber(kpiValue) : processedRows.length}</p>
                </div>
              )}

              {(chartType === "bar" || chartType === "line" || chartType === "area") && (
                dimensionField ? (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart data={pivotBuckets}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="key" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--primary))" />
                        </BarChart>
                      ) : chartType === "line" ? (
                        <LineChart data={pivotBuckets}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="key" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip />
                          <Line dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                        </LineChart>
                      ) : (
                        <AreaChart data={pivotBuckets}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="key" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip />
                          <Area dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Pick a dimension to group by.</p>
                )
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function RowTable({
  fields,
  rows,
  sortField,
  sortDir,
  onSort,
}: {
  fields: string[];
  rows: Record<string, string>[];
  sortField: string | null;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const shown = rows.slice(0, 200);
  return (
    <div className="max-h-[32rem] overflow-auto border-2 border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {fields.map((f) => (
              <TableHead key={f} className="cursor-pointer select-none whitespace-nowrap" onClick={() => onSort(f)}>
                {label(f)} {sortField === f ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row, i) => (
            <TableRow key={i}>
              {fields.map((f) => (
                <TableCell key={f} className="whitespace-nowrap">
                  {row[f] || <span className="text-muted-foreground">—</span>}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 200 && (
        <p className="border-t-2 border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Showing first 200 of {rows.length} rows. Export for the full set.
        </p>
      )}
      {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No rows match.</p>}
    </div>
  );
}
