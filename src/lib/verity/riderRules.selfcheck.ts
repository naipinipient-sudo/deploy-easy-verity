// Run: node --experimental-strip-types src/lib/verity/riderRules.selfcheck.ts
import assert from 'node:assert'
import { computeRiderKpis } from './riderRules.ts'
import type { Row } from './exploreRules.ts'

const rows: Row[] = [
  { rider: 'r1', name: 'Alice', status: 'Completed', amount: '10', date: '2026-01-01T00:00:00Z' },
  { rider: 'r1', name: 'Alice', status: 'Cancelled', amount: '0', date: '2026-01-01T08:00:00Z' }, // same day
  { rider: 'r1', name: 'Alice', status: 'Delivered', amount: '15', date: '2026-01-02T00:00:00Z' },
  { rider: 'r2', name: 'Bob', status: 'completed', amount: '5', date: '2026-01-01T00:00:00Z' },
]

const kpis = computeRiderKpis(rows, { riderId: 'rider', riderName: 'name', status: 'status', amount: 'amount', date: 'date' })
const byId = new Map(kpis.map((k) => [k.riderId, k]))

const r1 = byId.get('r1')!
assert.strictEqual(r1.jobs, 3)
assert.strictEqual(r1.riderName, 'Alice')
assert.strictEqual(r1.completedRate, 2 / 3) // "Completed" + "Delivered"
assert.strictEqual(r1.cancelledRate, 1 / 3)
assert.strictEqual(r1.totalAmount, 25)
assert.strictEqual(r1.activeDays, 2) // two distinct calendar days despite 3 rows

const r2 = byId.get('r2')!
assert.strictEqual(r2.jobs, 1)
assert.strictEqual(r2.completedRate, 1)

// ranked by jobs desc
assert.strictEqual(kpis[0]?.riderId, 'r1')

console.log('riderRules.ts self-check passed')
