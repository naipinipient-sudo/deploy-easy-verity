// Run: node --experimental-strip-types src/lib/verity/quality.selfcheck.ts
import assert from 'node:assert'
import { computeQualityFindings } from './qualityRules.ts'
import type { ColumnProfile } from './fileProfile.ts'

const columns: ColumnProfile[] = [
  { name: 'order_ref', type: 'identifier', nullRate: 0.1, distinctCount: 85, sampleValues: ['A1', 'A2'] },
  { name: 'amount_usd', type: 'text', nullRate: 0, distinctCount: 40, sampleValues: ['n/a'] },
  { name: 'status_raw', type: 'category', nullRate: 0, distinctCount: 25, sampleValues: ['ok'] },
  { name: 'note', type: 'text', nullRate: 0, distinctCount: 5, sampleValues: ['hi'] },
]
const mapping = { order_ref: 'order_id', amount_usd: 'amount', status_raw: 'status' }
const rowCount = 100

const findings = computeQualityFindings(columns, mapping, rowCount)
const byField = new Map(findings.map((f) => [`${f.field}:${f.rule}`, f]))

// order_ref: 10% null -> missing_values; nonNull=90, distinct=85 -> 5 dup -> duplicate_identifier
assert.ok(byField.has('order_ref:missing_values'))
assert.strictEqual(byField.get('order_ref:duplicate_identifier')?.impacted_rows, 5)

// amount_usd mapped to 'amount' but profiled as text -> unexpected_type
assert.ok(byField.has('amount_usd:unexpected_type'))

// status_raw: category with 25 distinct values -> high_cardinality_category
assert.ok(byField.has('status_raw:high_cardinality_category'))

// note: unmapped column -> no findings at all
assert.ok(![...byField.keys()].some((k) => k.startsWith('note:')))

console.log('quality.ts self-check passed')
