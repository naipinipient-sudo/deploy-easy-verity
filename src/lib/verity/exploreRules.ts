// Pure row-filtering, sorting, and pivot/aggregate logic shared by Explore
// (PRD 8.9) and Rider performance (PRD 8.10) -- both are "group rows by a
// field and aggregate a measure" underneath.

export type Row = Record<string, string>

export type FilterOp = "eq" | "neq" | "contains" | "gt" | "gte" | "lt" | "lte" | "blank" | "not_blank"
export type Filter = { field: string; op: FilterOp; value?: string }

export type AggType = "sum" | "avg" | "count" | "count_distinct" | "min" | "max"

// ponytail: strips currency symbols/commas/whitespace only -- no locale-aware
// parsing. Add Intl.NumberFormat-based parsing if a workspace needs it.
export function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null
  const cleaned = value.replace(/[,$\s]/g, "")
  if (cleaned === "") return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function matches(row: Row, filter: Filter): boolean {
  const raw = row[filter.field] ?? ""
  switch (filter.op) {
    case "blank":
      return raw.trim() === ""
    case "not_blank":
      return raw.trim() !== ""
    case "eq":
      return raw.trim().toLowerCase() === (filter.value ?? "").trim().toLowerCase()
    case "neq":
      return raw.trim().toLowerCase() !== (filter.value ?? "").trim().toLowerCase()
    case "contains":
      return raw.toLowerCase().includes((filter.value ?? "").toLowerCase())
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = toNumber(raw)
      const b = toNumber(filter.value)
      if (a === null || b === null) return false
      if (filter.op === "gt") return a > b
      if (filter.op === "gte") return a >= b
      if (filter.op === "lt") return a < b
      return a <= b
    }
  }
}

export function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  if (filters.length === 0) return rows
  return rows.filter((row) => filters.every((f) => matches(row, f)))
}

export function sortRows(rows: Row[], field: string | null, dir: "asc" | "desc"): Row[] {
  if (!field) return rows
  const sorted = [...rows].sort((a, b) => {
    const av = a[field] ?? ""
    const bv = b[field] ?? ""
    const an = toNumber(av)
    const bn = toNumber(bv)
    const cmp = an !== null && bn !== null ? an - bn : av.localeCompare(bv)
    return dir === "asc" ? cmp : -cmp
  })
  return sorted
}

export function aggregate(values: string[], type: AggType): number {
  if (type === "count") return values.length
  if (type === "count_distinct") return new Set(values.map((v) => v.trim().toLowerCase())).size
  const nums = values.map(toNumber).filter((n): n is number => n !== null)
  if (nums.length === 0) return 0
  if (type === "sum") return nums.reduce((a, b) => a + b, 0)
  if (type === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length
  if (type === "min") return Math.min(...nums)
  return Math.max(...nums)
}

export type PivotBucket = { key: string; value: number; rowCount: number }

export function pivot(rows: Row[], dimensionField: string, measureField: string | null, aggType: AggType): PivotBucket[] {
  const buckets = new Map<string, string[]>()
  for (const row of rows) {
    const key = (row[dimensionField] ?? "").trim() || "(blank)"
    const bucket = buckets.get(key) ?? []
    bucket.push(measureField ? (row[measureField] ?? "") : "")
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .map(([key, values]) => ({ key, value: aggregate(values, aggType), rowCount: values.length }))
    .sort((a, b) => b.value - a.value)
}
