// Run: node --experimental-strip-types src/lib/verity/masterRules.selfcheck.ts
import assert from 'node:assert'
import { mergeSources, type Source } from './masterRules.ts'

function idx(entries: [string, Record<string, string>][]): Source['index'] {
  return new Map(entries.map(([key, record], i) => [key, [{ record, rowIndex: i }]]))
}

const sourceA: Source = {
  versionId: 'v1',
  index: idx([
    ['k1', { amount: '10', status: 'pending' }],
    ['k2', { amount: '20', status: '' }], // blank status
  ]),
}
const sourceB: Source = {
  versionId: 'v2', // later precedence -- wins on non-blank fields
  index: idx([
    ['k1', { amount: '15', status: '' }], // blank status -> v1's status survives
    ['k3', { amount: '30', status: 'done' }],
  ]),
}

const rows = mergeSources([sourceA, sourceB], ['amount', 'status'])
const byKey = new Map(rows.map((r) => [r.key, r]))

// k1: amount overwritten by v2 (non-blank), status kept from v1 (v2 blank)
assert.strictEqual(byKey.get('k1')?.data['amount'], '15')
assert.strictEqual(byKey.get('k1')?.data['status'], 'pending')
assert.strictEqual(byKey.get('k1')?.lineage.length, 2)

// k2: only in v1
assert.strictEqual(byKey.get('k2')?.data['amount'], '20')
assert.strictEqual(byKey.get('k2')?.lineage.length, 1)

// k3: only in v2
assert.strictEqual(byKey.get('k3')?.data['status'], 'done')

assert.strictEqual(rows.length, 3)

console.log('masterRules.ts self-check passed')
