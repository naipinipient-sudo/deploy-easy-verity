// Run: node --experimental-strip-types src/lib/verity/exploreRules.selfcheck.ts
import assert from 'node:assert'
import { applyFilters, sortRows, aggregate, pivot, toNumber, type Row } from './exploreRules.ts'

const rows: Row[] = [
  { rider_id: 'r1', status: 'completed', amount: '10' },
  { rider_id: 'r1', status: 'cancelled', amount: '5' },
  { rider_id: 'r2', status: 'completed', amount: '20.50' },
  { rider_id: 'r2', status: 'completed', amount: '' }, // blank amount ignored by numeric agg
]

// filters
assert.strictEqual(applyFilters(rows, [{ field: 'status', op: 'eq', value: 'completed' }]).length, 3)
assert.strictEqual(applyFilters(rows, [{ field: 'amount', op: 'gt', value: '10' }]).length, 1)
assert.strictEqual(applyFilters(rows, [{ field: 'amount', op: 'blank' }]).length, 1)

// sort
const sorted = sortRows(rows, 'amount', 'desc')
assert.strictEqual(sorted[0]?.['amount'], '20.50')

// aggregate
assert.strictEqual(aggregate(['10', '5', ''], 'sum'), 15)
assert.strictEqual(aggregate(['10', '5'], 'avg'), 7.5)
assert.strictEqual(aggregate(['a', 'a', 'b'], 'count_distinct'), 2)
assert.strictEqual(toNumber('1,200'), 1200)
assert.strictEqual(toNumber(''), null)

// pivot: sum(amount) by rider_id
const buckets = pivot(rows, 'rider_id', 'amount', 'sum')
const byKey = new Map(buckets.map((b) => [b.key, b]))
assert.strictEqual(byKey.get('r1')?.value, 15)
assert.strictEqual(byKey.get('r1')?.rowCount, 2)
assert.strictEqual(byKey.get('r2')?.value, 20.5)

// pivot: count by rider_id (no measure field)
const counts = pivot(rows, 'rider_id', null, 'count')
assert.strictEqual(new Map(counts.map((b) => [b.key, b.value])).get('r1'), 2)

console.log('exploreRules.ts self-check passed')
