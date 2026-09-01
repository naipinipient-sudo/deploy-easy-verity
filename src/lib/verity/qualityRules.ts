import type { Json } from "@/integrations/supabase/types";
import type { ColumnProfile } from "@/lib/verity/fileProfile";
import type { CanonicalKey } from "@/lib/verity/canonical";

const IDENTIFIER_FIELDS: CanonicalKey[] = ["record_id", "order_id", "rider_id"];

// ponytail: expected "type family" per canonical field is a hardcoded map,
// not configurable. Extend CANONICAL_FIELDS with an `expectedTypes` entry
// if that ever needs to vary per workspace.
const EXPECTED_TYPES: Partial<Record<CanonicalKey, ColumnProfile["type"][]>> = {
  amount: ["number", "currency"],
  transaction_date: ["date"],
  period: ["date", "category", "text"],
  record_id: ["identifier", "text"],
  order_id: ["identifier", "text"],
  rider_id: ["identifier", "text"],
};

export type NewFinding = {
  rule: string;
  severity: "low" | "medium" | "high";
  field: string;
  message: string;
  impacted_rows: number;
  evidence: Json;
};

/**
 * Derives quality findings purely from the schema profile + mapping already
 * computed at upload time — no extra row scan needed for the MVP checks.
 */
export function computeQualityFindings(
  columns: ColumnProfile[],
  mapping: Record<string, string>,
  rowCount: number,
): NewFinding[] {
  const findings: NewFinding[] = [];

  for (const col of columns) {
    const canonicalKey = mapping[col.name] as CanonicalKey | undefined;
    if (!canonicalKey) continue;

    if (col.nullRate > 0) {
      const impacted = Math.round(col.nullRate * rowCount);
      findings.push({
        rule: "missing_values",
        severity: col.nullRate > 0.5 ? "high" : col.nullRate > 0.1 ? "medium" : "low",
        field: col.name,
        message: `${Math.round(col.nullRate * 100)}% of "${col.name}" values are empty.`,
        impacted_rows: impacted,
        evidence: { nullRate: col.nullRate, sampleValues: col.sampleValues } as Json,
      });
    }

    if (IDENTIFIER_FIELDS.includes(canonicalKey)) {
      const nonNullCount = Math.round((1 - col.nullRate) * rowCount);
      const duplicateCount = nonNullCount - col.distinctCount;
      if (duplicateCount > 0) {
        findings.push({
          rule: "duplicate_identifier",
          severity: duplicateCount / Math.max(nonNullCount, 1) > 0.05 ? "high" : "medium",
          field: col.name,
          message: `"${col.name}" is mapped to an identifier field but has ~${duplicateCount} duplicate value(s).`,
          impacted_rows: duplicateCount,
          evidence: { distinctCount: col.distinctCount, nonNullCount } as Json,
        });
      }
    }

    if (col.type === "category" && col.distinctCount > 20) {
      findings.push({
        rule: "high_cardinality_category",
        severity: "low",
        field: col.name,
        message: `"${col.name}" has ${col.distinctCount} distinct values for a category field — check for inconsistent entries.`,
        impacted_rows: 0,
        evidence: { distinctCount: col.distinctCount, sampleValues: col.sampleValues } as Json,
      });
    }

    const expected = EXPECTED_TYPES[canonicalKey];
    if (expected && !expected.includes(col.type)) {
      findings.push({
        rule: "unexpected_type",
        severity: "medium",
        field: col.name,
        message: `"${col.name}" is mapped to a field expecting ${expected.join("/")}, but looks like "${col.type}".`,
        impacted_rows: 0,
        evidence: { detectedType: col.type, expected, sampleValues: col.sampleValues } as Json,
      });
    }
  }

  return findings;
}
