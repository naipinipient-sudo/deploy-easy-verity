import type { SideIndex } from "@/lib/verity/compareRules";

export const MAX_RECONCILE_ITEMS = 500;

const AMOUNT_FIELDS = new Set(["amount"]);
const DATE_FIELDS = new Set(["transaction_date", "period"]);

export type ToleranceConfig = {
  amountTolerance: number; // absolute difference allowed
  dateToleranceDays: number;
};

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDateMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export type FieldMatch = { field: string; matched: boolean; leftValue: string; rightValue: string; detail?: string };

/** Compares one field between two sides, tolerance-aware for amount/date fields. */
export function compareField(field: string, leftValue: string, rightValue: string, tolerance: ToleranceConfig): FieldMatch {
  if (AMOUNT_FIELDS.has(field)) {
    const l = parseAmount(leftValue);
    const r = parseAmount(rightValue);
    if (l !== null && r !== null) {
      const diff = Math.abs(l - r);
      return { field, matched: diff <= tolerance.amountTolerance, leftValue, rightValue, detail: `diff ${diff.toFixed(2)}` };
    }
  }
  if (DATE_FIELDS.has(field)) {
    const l = parseDateMs(leftValue);
    const r = parseDateMs(rightValue);
    if (l !== null && r !== null) {
      const diffDays = Math.abs(l - r) / 86_400_000;
      return { field, matched: diffDays <= tolerance.dateToleranceDays, leftValue, rightValue, detail: `${diffDays.toFixed(1)}d apart` };
    }
  }
  return { field, matched: leftValue.trim() === rightValue.trim(), leftValue, rightValue };
}

export type ReconciliationItem = {
  key: string;
  state: "proposed" | "unmatched" | "ambiguous";
  side: "left" | "right" | "both"; // which side(s) contributed a row
  score: number; // 0-100, only meaningful for "proposed"
  fieldMatches: FieldMatch[];
  leftRow: Record<string, string> | null;
  rightRow: Record<string, string> | null;
};

/**
 * Scored pairing, tolerance-aware. Same key-based pairing as Compare, but
 * produces a 0-100 score per pair (instead of a binary matched/changed
 * verdict) plus the per-field evidence behind it.
 */
export function reconcileIndexes(
  leftIndex: SideIndex,
  rightIndex: SideIndex,
  compareFields: string[],
  tolerance: ToleranceConfig,
  maxItems = MAX_RECONCILE_ITEMS,
): ReconciliationItem[] {
  const items: ReconciliationItem[] = [];
  const allKeys = new Set([...leftIndex.keys(), ...rightIndex.keys()]);

  for (const key of allKeys) {
    if (items.length >= maxItems) break;
    const leftBucket = leftIndex.get(key) ?? [];
    const rightBucket = rightIndex.get(key) ?? [];
    const firstLeft = leftBucket[0];
    const firstRight = rightBucket[0];

    if (firstLeft && !firstRight) {
      items.push({ key, state: "unmatched", side: "left", score: 0, fieldMatches: [], leftRow: firstLeft.record, rightRow: null });
      continue;
    }
    if (!firstLeft && firstRight) {
      items.push({ key, state: "unmatched", side: "right", score: 0, fieldMatches: [], leftRow: null, rightRow: firstRight.record });
      continue;
    }
    if (!firstLeft || !firstRight) continue;

    if (leftBucket.length > 1 || rightBucket.length > 1) {
      items.push({ key, state: "ambiguous", side: "both", score: 0, fieldMatches: [], leftRow: firstLeft.record, rightRow: firstRight.record });
      continue;
    }

    const fieldMatches = compareFields.map((f) => compareField(f, firstLeft.record[f] ?? "", firstRight.record[f] ?? "", tolerance));
    const matchedCount = fieldMatches.filter((m) => m.matched).length;
    const score = fieldMatches.length === 0 ? 100 : Math.round((matchedCount / fieldMatches.length) * 100);
    items.push({ key, state: "proposed", side: "both", score, fieldMatches, leftRow: firstLeft.record, rightRow: firstRight.record });
  }

  return items;
}
