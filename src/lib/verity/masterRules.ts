export type SourceRecord = { record: Record<string, string>; rowIndex: number };
export type SourceIndex = Map<string, SourceRecord[]>;

export type Source = {
  versionId: string;
  index: SourceIndex;
};

export type Lineage = { versionId: string; rowIndex: number };

export type MasterRow = {
  key: string;
  data: Record<string, string>;
  lineage: Lineage[];
};

/**
 * Coalesce-merge: sources are given in precedence order (last wins). For
 * each key, later sources overwrite a field only when they have a
 * non-empty value for it -- an earlier source's value survives if a later
 * source is blank for that field. Every contributing row is recorded in
 * lineage, in precedence order, even if it didn't "win" every field.
 */
export function mergeSources(sources: Source[], allFields: string[]): MasterRow[] {
  const allKeys = new Set<string>();
  for (const source of sources) {
    for (const key of source.index.keys()) allKeys.add(key);
  }

  const rows: MasterRow[] = [];
  for (const key of allKeys) {
    const data: Record<string, string> = {};
    const lineage: Lineage[] = [];

    for (const source of sources) {
      const bucket = source.index.get(key);
      const entry = bucket?.[0];
      if (!entry) continue;
      lineage.push({ versionId: source.versionId, rowIndex: entry.rowIndex });
      for (const field of allFields) {
        const value = entry.record[field];
        if (value) data[field] = value;
      }
    }

    if (lineage.length > 0) rows.push({ key, data, lineage });
  }

  return rows;
}
