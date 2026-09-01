// ponytail: caps how many example rows we store/display per bucket so a
// huge diff doesn't blow up the compare_runs.results jsonb. Counts in
// `summary` are always exact; only the example lists are capped.
export const MAX_COMPARE_EXAMPLES = 200;

export type IndexedRecord = { record: Record<string, string> };
export type SideIndex = Map<string, IndexedRecord[]>;

export type CompareSummary = {
  matched: number;
  changedField: number;
  onlyLeft: number;
  onlyRight: number;
  duplicateKeyLeft: number;
  duplicateKeyRight: number;
  ambiguous: number;
};

export type CompareResults = {
  onlyLeft: { key: string; row: Record<string, string> }[];
  onlyRight: { key: string; row: Record<string, string> }[];
  changed: { key: string; left: Record<string, string>; right: Record<string, string>; diffFields: string[] }[];
  ambiguous: { key: string; leftCount: number; rightCount: number }[];
};

/**
 * Pure diff: only-in-left, only-in-right, matching, changed-field,
 * duplicate-key (repeated within one side), ambiguous-key (present on both
 * sides but not 1:1, so no reliable pairing) -- the six categories PRD 8.6
 * asks for.
 */
export function diffIndexes(
  leftIndex: SideIndex,
  rightIndex: SideIndex,
  compareFields: string[],
  maxExamples = MAX_COMPARE_EXAMPLES,
): { summary: CompareSummary; results: CompareResults } {
  const summary: CompareSummary = {
    matched: 0,
    changedField: 0,
    onlyLeft: 0,
    onlyRight: 0,
    duplicateKeyLeft: 0,
    duplicateKeyRight: 0,
    ambiguous: 0,
  };
  const results: CompareResults = { onlyLeft: [], onlyRight: [], changed: [], ambiguous: [] };

  for (const bucket of leftIndex.values()) {
    if (bucket.length > 1) summary.duplicateKeyLeft += bucket.length - 1;
  }
  for (const bucket of rightIndex.values()) {
    if (bucket.length > 1) summary.duplicateKeyRight += bucket.length - 1;
  }

  const allKeys = new Set([...leftIndex.keys(), ...rightIndex.keys()]);
  for (const key of allKeys) {
    const leftBucket = leftIndex.get(key) ?? [];
    const rightBucket = rightIndex.get(key) ?? [];

    const firstLeft = leftBucket[0];
    const firstRight = rightBucket[0];

    if (firstLeft && !firstRight) {
      summary.onlyLeft++;
      if (results.onlyLeft.length < maxExamples) results.onlyLeft.push({ key, row: firstLeft.record });
      continue;
    }
    if (!firstLeft && firstRight) {
      summary.onlyRight++;
      if (results.onlyRight.length < maxExamples) results.onlyRight.push({ key, row: firstRight.record });
      continue;
    }
    if (!firstLeft || !firstRight) continue; // unreachable: key came from one of the two indexes

    if (leftBucket.length > 1 || rightBucket.length > 1) {
      summary.ambiguous++;
      if (results.ambiguous.length < maxExamples) {
        results.ambiguous.push({ key, leftCount: leftBucket.length, rightCount: rightBucket.length });
      }
      continue;
    }

    const leftEntry = firstLeft;
    const rightEntry = firstRight;
    const diffFields = compareFields.filter((f) => leftEntry.record[f] !== rightEntry.record[f]);
    if (diffFields.length > 0) {
      summary.changedField++;
      if (results.changed.length < maxExamples) {
        results.changed.push({ key, left: leftEntry.record, right: rightEntry.record, diffFields });
      }
    } else {
      summary.matched++;
    }
  }

  return { summary, results };
}
