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
import { useLang } from "@/lib/i18n";
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

function label(field: string, t: (key: string) => string) {
  return t(`canonical.${field}`);
}

const FILTER_OPS: { value: FilterOp; labelKey: string; needsValue: boolean }[] = [
  { value: "eq", labelKey: "opEquals", needsValue: true },
  { value: "neq", labelKey: "opNotEquals", needsValue: true },
  { value: "contains", labelKey: "opContains", needsValue: true },
  { value: "gt", labelKey: "opGreaterThan", needsValue: true },
  { value: "gte", labelKey: "opGreaterEquals", needsValue: true },
  { value: "lt", labelKey: "opLessThan", needsValue: true },
  { value: "lte", labelKey: "opLessEquals", needsValue: true },
  { value: "blank", labelKey: "opBlank", needsValue: false },
  { value: "not_blank", labelKey: "opNotBlank", needsValue: false },
];

const AGG_TYPES: { value: AggType; labelKey: string }[] = [
  { value: "sum", labelKey: "aggSum" },
  { value: "avg", labelKey: "aggAvg" },
  { value: "count", labelKey: "aggCount" },
  { value: "count_distinct", labelKey: "aggCountDistinct" },
  { value: "min", labelKey: "aggMin" },
  { value: "max", labelKey: "aggMax" },
];

type ChartType = "table" | "bar" | "line" | "area" | "kpi";

function ExplorePage() {
  const { t } = useLang();
  const { activeWorkspace, isLoading: workspaceLoading } = useActiveWorkspace();

  if (workspaceLoading) {
    return (
      <AppShell title={t("explore.title")}>
        <LoadingState label={t("common.loadingWorkspace")} />
      </AppShell>
    );
  }
  if (!activeWorkspace) {
    return (
      <AppShell title={t("explore.title")}>
        <EmptyState
          icon={<Compass className="h-5 w-5" aria-hidden />}
          title={t("common.noWorkspaceSelected")}
          description={t("common.pickWorkspaceFirst")}
          action={
            <Button asChild size="sm">
              <Link to="/workspaces/new">{t("workspaces.createWorkspace")}</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }
  return <ExploreForWorkspace workspaceId={activeWorkspace.id} />;
}

function ExploreForWorkspace({ workspaceId }: { workspaceId: string }) {
  const { t } = useLang();
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
      toast.success(t("explore.viewSaved"));
    } catch (error) {
      toast.error(describeError(error, t("explore.couldNotSaveView")));
    }
  };

  return (
    <AppShell
      title={t("explore.title")}
      description={t("explore.description")}
    >
      <div className="space-y-6">
        <div className="panel flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-64 space-y-2">
            <Label>{t("explore.sourceLabel")}</Label>
            {sourcesQuery.isLoading ? (
              <LoadingState label={t("explore.loadingSources")} rows={1} />
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
                  <SelectValue placeholder={t("explore.sourcePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(sourcesQuery.data ?? []).map((s) => (
                    <SelectItem key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>
                      {t("explore.sourceOption", { label: s.label, count: s.rowCount })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {savedViewsQuery.data && savedViewsQuery.data.length > 0 && (
            <div className="min-w-56 space-y-2">
              <Label>{t("explore.savedViewsLabel")}</Label>
              <Select
                onValueChange={(id) => {
                  const view = savedViewsQuery.data!.find((v) => v.id === id);
                  if (view) applyViewConfig(view.config as unknown as SavedViewConfig);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("explore.savedViewPlaceholder")} />
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
            title={t("explore.pickSourceTitle")}
            description={t("explore.pickSourceDescription")}
          />
        ) : dataQuery.isLoading ? (
          <LoadingState label={t("explore.loadingRows")} />
        ) : dataQuery.isError ? (
          <ErrorState message={describeError(dataQuery.error, t("explore.couldNotLoadRows"))} />
        ) : (
          <>
            <div className="panel space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Label>{t("explore.filtersLabel")}</Label>
                <Button size="sm" variant="outline" onClick={addFilter}>
                  {t("explore.addFilter")}
                </Button>
              </div>
              {filters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("explore.noFilters", { count: processedRows.length })}
                </p>
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
                                {label(field, t)}
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
                                {t(`explore.${o.labelKey}`)}
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
                  <p className="text-xs text-muted-foreground">
                    {t("explore.filtersMatch", { matched: processedRows.length, total: dataQuery.data!.rows.length })}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2 border-t-2 border-border pt-3">
                <Input
                  placeholder={t("explore.viewNamePlaceholder")}
                  className="w-48"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                />
                <Button size="sm" onClick={saveView} disabled={!viewName.trim()}>
                  {t("explore.saveView")}
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
                    title={t("explore.deleteView", { name: v.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> {v.name}
                  </Button>
                ))}
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportRows(processedRows, fields, source.label, "csv")}>
                    <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> {t("explore.exportCsv")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportRows(processedRows, fields, source.label, "xlsx")}>
                    <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> {t("explore.exportXlsx")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="panel space-y-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>{t("explore.viewAsLabel")}</Label>
                  <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">{t("explore.chartTable")}</SelectItem>
                      <SelectItem value="bar">{t("explore.chartBar")}</SelectItem>
                      <SelectItem value="line">{t("explore.chartLine")}</SelectItem>
                      <SelectItem value="area">{t("explore.chartArea")}</SelectItem>
                      <SelectItem value="kpi">{t("explore.chartKpi")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {chartType !== "table" && (
                  <>
                    {chartType !== "kpi" && (
                      <div className="space-y-2">
                        <Label>{t("explore.groupByLabel")}</Label>
                        <Select value={dimensionField ?? ""} onValueChange={setDimensionField}>
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder={t("explore.fieldPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((f) => (
                              <SelectItem key={f} value={f}>
                                {label(f, t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{t("explore.measureLabel")}</Label>
                      <Select value={measureField ?? "__count__"} onValueChange={(v) => setMeasureField(v === "__count__" ? null : v)}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__count__">{t("explore.rowCountOption")}</SelectItem>
                          {fields.map((f) => (
                            <SelectItem key={f} value={f}>
                              {label(f, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("explore.aggregationLabel")}</Label>
                      <Select value={aggType} onValueChange={(v) => setAggType(v as AggType)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGG_TYPES.map((a) => (
                            <SelectItem key={a.value} value={a.value}>
                              {t(`explore.${a.labelKey}`)}
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
                    {t("explore.kpiOf", {
                      agg: t(`explore.${AGG_TYPES.find((a) => a.value === aggType)!.labelKey}`),
                      field: measureField ? label(measureField, t) : t("explore.rowsFallback"),
                    })}
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
                  <p className="text-sm text-muted-foreground">{t("explore.pickDimension")}</p>
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
  const { t } = useLang();
  const shown = rows.slice(0, 200);
  return (
    <div className="max-h-[32rem] overflow-auto border-2 border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {fields.map((f) => (
              <TableHead key={f} className="cursor-pointer select-none whitespace-nowrap" onClick={() => onSort(f)}>
                {label(f, t)} {sortField === f ? (sortDir === "asc" ? "↑" : "↓") : ""}
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
          {t("explore.showingFirst", { rows: rows.length })}
        </p>
      )}
      {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{t("explore.noRowsMatch")}</p>}
    </div>
  );
}
