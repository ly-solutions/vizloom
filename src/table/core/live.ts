import type { CellValue, ColumnDef } from './types';
import { toNumber, toTime } from './values';

export const CHANGE_DIRECTION = { up: 'up', down: 'down', changed: 'changed' } as const;
export type ChangeDirection = (typeof CHANGE_DIRECTION)[keyof typeof CHANGE_DIRECTION];

export interface CellChange {
  rowKey: string;
  columnId: string;
  direction: ChangeDirection;
  /** Numeric difference, for the "+N" chip; null for non-numeric changes. */
  delta: number | null;
}

function sameValue(a: CellValue, b: CellValue): boolean {
  if (a instanceof Date || b instanceof Date) return toTime(a) === toTime(b);
  return Object.is(a, b);
}

/**
 * Cells whose value differs between two snapshots of the same rows. Rows that appeared or
 * left are not changes of a cell and are ignored; the caller animates them separately.
 */
export function diffRows<Row>(
  previous: ReadonlyMap<string, Row>,
  next: readonly Row[],
  columns: readonly ColumnDef<Row>[],
  rowKey: (row: Row) => string,
): CellChange[] {
  const changes: CellChange[] = [];
  for (const row of next) {
    const key = rowKey(row);
    const before = previous.get(key);
    if (before === undefined || before === row) continue;
    for (const column of columns) {
      const oldValue = column.value(before);
      const newValue = column.value(row);
      if (sameValue(oldValue, newValue)) continue;
      const oldNumber = toNumber(oldValue);
      const newNumber = toNumber(newValue);
      if (oldNumber !== null && newNumber !== null) {
        changes.push({
          rowKey: key,
          columnId: column.id,
          direction: newNumber > oldNumber ? CHANGE_DIRECTION.up : CHANGE_DIRECTION.down,
          delta: newNumber - oldNumber,
        });
      } else {
        changes.push({ rowKey: key, columnId: column.id, direction: CHANGE_DIRECTION.changed, delta: null });
      }
    }
  }
  return changes;
}

export function indexRows<Row>(rows: readonly Row[], rowKey: (row: Row) => string): Map<string, Row> {
  return new Map(rows.map((row) => [rowKey(row), row]));
}
