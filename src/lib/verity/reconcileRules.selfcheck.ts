// Run: node --experimental-strip-types src/lib/verity/reconcileRules.selfcheck.ts
import assert from 'node:assert'
import { reconcileIndexes, compareField, type ToleranceConfig } from './reconcileRules.ts'
import type { SideIndex } from './compareRules.ts'

function idx(entries: [string, Record<string, string>[]][]): SideIndex {
  return new Map(entries.map(([key, records]) => [key, records.map((record) => ({ record }))]))
}

const tolerance: ToleranceConfig = { amountTolerance: 0.5, dateToleranceDays: 1 }

// amount within tolerance -> matched despite differing exactly
const m1 = compareField('amount', '100.00', '100.40', tolerance)
assert.strictEqual(m1.matched, true)
const m2 = compareField('amount', '100.00', '105.00', tolerance)
assert.strictEqual(m2.matched, false)

// date within 1 day -> matched
const d1 = compareField('transaction_date', '2026-01-01', '2026-01-02', tolerance)
assert.strictEqual(d1.matched, true)
const d2 = compareField('transaction_date', '2026-01-01', '2026-01-05', tolerance)
assert.strictEqual(d2.matched, false)

// non-tolerant field: exact match only
const s1 = compareField('status', 'delivered', 'Delivered', tolerance)
assert.strictEqual(s1.matched, false)

const left = idx([
  ['k1', [{ amount: '100.00', status: 'ok' }]],
  ['k2', [{ amount: '50.00', status: 'ok' }]],
  ['only-left', [{ amount: '1', status: 'ok' }]],
])
const right = idx([
  ['k1', [{ amount: '100.20', status: 'ok' }]], // within amount tolerance, status exact -> score 100
  ['k2', [{ amount: '999', status: 'ok' }]], // amount way off -> score 50 (1 of 2 fields)
  ['only-right', [{ amount: '2', status: 'ok' }]],
])

const items = reconcileIndexes(left, right, ['amount', 'status'], tolerance)
const byKey = new Map(items.map((i) => [i.key, i]))

assert.strictEqual(byKey.get('k1')?.state, 'proposed')
assert.strictEqual(byKey.get('k1')?.score, 100)
assert.strictEqual(byKey.get('k2')?.score, 50)
assert.strictEqual(byKey.get('only-left')?.state, 'unmatched')
assert.strictEqual(byKey.get('only-left')?.side, 'left')
assert.strictEqual(byKey.get('only-right')?.side, 'right')

console.log('reconcileRules.ts self-check passed')
