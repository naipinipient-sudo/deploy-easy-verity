// ponytail: static default set, not workspace-configurable yet.
// PRD 8.3 wants custom/saved canonical fields per workspace — add a
// canonical_fields table + editor UI when a workspace needs to diverge
// from this default set.
export const CANONICAL_FIELDS = [
  { key: 'record_id', label: 'Record ID', required: false },
  { key: 'transaction_date', label: 'Transaction date', required: false },
  { key: 'rider_id', label: 'Rider ID', required: false },
  { key: 'rider_name', label: 'Rider name', required: false },
  { key: 'order_id', label: 'Order ID', required: false },
  { key: 'amount', label: 'Amount', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'location', label: 'Location', required: false },
  { key: 'vendor', label: 'Vendor / source', required: false },
  { key: 'period', label: 'Period', required: false },
] as const

export type CanonicalKey = (typeof CANONICAL_FIELDS)[number]['key']
