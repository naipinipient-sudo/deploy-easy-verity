// Run: node --experimental-strip-types src/lib/verity/compareRules.selfcheck.ts
import assert from 'node:assert'
import { diffIndexes, type SideIndex } from './compareRules.ts'

function idx(entries: [string, Record<string, string>[]][]): SideIndex {
  return new Map(entries.map(([key, records]) => [key, records.map((record) => ({ record }))]))
}

const left = idx([
  ['a1', [{ amount: '10' }]],           // matches right exactly
  ['a2', [{ amount: '20' }]],           // changed-field vs right
  ['a3', [{ amount: '30' }]],           // only in left
  ['dup1', [{ amount: '1' }, { amount: '2' }]], // duplicate in left only -> onlyLeft (right has none)
  ['both-dup', [{ amount: '5' }, { amount: '6' }]], // duplicate on left, present on right -> ambiguous
])
const right = idx([
  ['a1', [{ amount: '10' }]],
  ['a2', [{ amount: '99' }]],
  ['a4', [{ amount: '40' }]],           // only in right
  ['both-dup', [{ amount: '5' }]],
])

const { summary, results } = diffIndexes(left, right, ['amount'])

assert.strictEqual(summary.matched, 1) // a1
assert.strictEqual(summary.changedField, 1) // a2
assert.strictEqual(summary.onlyLeft, 2) // a3, dup1
assert.strictEqual(summary.onlyRight, 1) // a4
assert.strictEqual(summary.ambiguous, 1) // both-dup
assert.strictEqual(summary.duplicateKeyLeft, 2) // dup1 (+1) and both-dup (+1)
assert.strictEqual(summary.duplicateKeyRight, 0)

assert.strictEqual(results.changed[0]?.diffFields[0], 'amount')
assert.strictEqual(results.ambiguous[0]?.leftCount, 2)

console.log('compareRules.ts self-check passed')
