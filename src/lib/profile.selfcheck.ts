// Run: node --experimental-strip-types src/lib/profile.selfcheck.ts
import assert from 'node:assert'
import { profileColumns } from './profile.ts'

const headers = ['id', 'amount', 'joined_at', 'status', '']
const rows = [
  ['a1b2c3', '$1,200.50', '2024-01-05', 'active', ''],
  ['d4e5f6', '$300.00', '2024-01-06', 'active', ''],
  ['g7h8i9', '$50.00', '2024-01-07', 'active', ''],
  ['j1k2l3', '', '2024-01-08', 'inactive', ''],
  ['m4n5o6', '$75.00', '2024-01-09', 'active', ''],
]

const { columns } = profileColumns(headers, rows)
const byName = Object.fromEntries(columns.map((c) => [c.name, c]))

assert.strictEqual(byName.id.type, 'identifier')
assert.strictEqual(byName.amount.type, 'currency')
assert.strictEqual(byName.amount.nullRate, 0.2)
assert.strictEqual(byName.joined_at.type, 'date')
assert.strictEqual(byName.status.type, 'category')

console.log('profile.ts self-check passed')
