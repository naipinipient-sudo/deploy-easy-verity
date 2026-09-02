// PRD 8.10: rider-centric KPIs computed from canonical rows. Pure logic --
// see riderRules.selfcheck.ts.
import { toNumber, type Row } from "./exploreRules.ts"

export type RiderFields = {
  riderId: string
  riderName?: string | undefined
  status?: string | undefined
  amount?: string | undefined
  date?: string | undefined
}

export type RiderKpi = {
  riderId: string
  riderName: string
  jobs: number
  completedRate: number | null
  cancelledRate: number | null
  totalAmount: number
  activeDays: number
}

// ponytail: naive substring match on free-text status ("completed",
// "delivered", "cancelled", "cancel" ...) -- add a workspace-configurable
// status-category dictionary (mirrors canonical.ts's static field list) if
// source systems use less obvious wording.
function isCompleted(status: string): boolean {
  const s = status.toLowerCase()
  return s.includes("complet") || s.includes("deliver") || s.includes("success") || s === "done"
}
function isCancelled(status: string): boolean {
  const s = status.toLowerCase()
  return s.includes("cancel") || s.includes("fail") || s.includes("reject")
}

export function computeRiderKpis(rows: Row[], fields: RiderFields): RiderKpi[] {
  const byRider = new Map<string, Row[]>()
  for (const row of rows) {
    const id = (row[fields.riderId] ?? "").trim()
    if (!id) continue
    const bucket = byRider.get(id) ?? []
    bucket.push(row)
    byRider.set(id, bucket)
  }

  const kpis: RiderKpi[] = []
  for (const [riderId, riderRows] of byRider) {
    const statuses = fields.status ? riderRows.map((r) => r[fields.status!] ?? "") : [];
    const completed = statuses.filter(isCompleted).length
    const cancelled = statuses.filter(isCancelled).length
    const amounts = fields.amount ? riderRows.map((r) => toNumber(r[fields.amount!])).filter((n): n is number => n !== null) : []
    const days = fields.date
      ? new Set(riderRows.map((r) => (r[fields.date!] ?? "").trim().slice(0, 10)).filter(Boolean))
      : new Set<string>()
    const name = fields.riderName ? (riderRows.find((r) => r[fields.riderName!])?.[fields.riderName!] ?? riderId) : riderId

    kpis.push({
      riderId,
      riderName: name,
      jobs: riderRows.length,
      completedRate: fields.status ? completed / riderRows.length : null,
      cancelledRate: fields.status ? cancelled / riderRows.length : null,
      totalAmount: amounts.reduce((a, b) => a + b, 0),
      activeDays: days.size,
    })
  }
  return kpis.sort((a, b) => b.jobs - a.jobs)
}
