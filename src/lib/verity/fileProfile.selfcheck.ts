// Run: node --experimental-strip-types src/lib/verity/fileProfile.selfcheck.ts
import assert from 'node:assert'
import { profileColumns } from './fileProfile.ts'

const headers = ['id', 'amount', 'joined_at', 'status', '']
const rows = [
  ['a1b2c3', '$1,200.50', '2024-01-05', 'active', ''],
  ['d4e5f6', '$300.00', '2024-01-06', 'active', ''],
  ['g7h8i9', '$50.00', '2024-01-07', 'active', ''],
  ['j1k2l3', '', '2024-01-08', 'inactive', ''],
  ['m4n5o6', '$75.00', '2024-01-09', 'active', ''],
]

const { columns } = profileColumns(headers, rows)
const byName = new Map(columns.map((c) => [c.name, c]))
const get = (name: string) => {
  const col = byName.get(name)
  if (!col) throw new Error(`missing column ${name}`)
  return col
}

assert.strictEqual(get('id').type, 'identifier')
assert.strictEqual(get('amount').type, 'currency')
assert.strictEqual(get('amount').nullRate, 0.2)
assert.strictEqual(get('joined_at').type, 'date')
assert.strictEqual(get('status').type, 'category')

console.log('profile.ts self-check passed')
