import { alignOf, cardRoleOf, minWidthOf } from '../core/columns';
import { PIN, type Align, type CardRole, type ColumnDef, type Pin } from '../core/types';
import type { DataTableInstance } from './use-data-table';

/** Width of the checkbox, expand and menu columns. */
export const SERVICE_WIDTH = 48;
/** On a narrow container a pinned first column takes at most this share of the width. */
export const NARROW_PIN_SHARE = 0.45;

export interface ColumnLayout<Row> {
  column: ColumnDef<Row>;
  pin: Pin | null;
  /** Index among columns pinned to the same side, counted from that edge (service columns included). */
  pinIndex: number;
  align: Align;
  width: number;
  minWidth: number;
  grow: boolean;
  cardRole: CardRole;
}

export interface TableLayout<Row> {
  columns: ColumnLayout<Row>[];
  /** Sum of widths: the table never shrinks below it and scrolls instead. */
  minWidth: number;
}

export interface LayoutOptions {
  narrow: boolean;
  containerWidth: number | null;
  /** Service columns at the start: selection checkbox, expand toggle. */
  startService: number;
  /** Service columns at the end: row menu. */
  endService: number;
}

/**
 * On a narrow container only the first start-pinned column stays pinned (and is capped to
 * 45% of the width): more pinned columns would leave no room to scroll.
 */
function effectivePin(pin: Pin | null, narrow: boolean, startPinnedBefore: number): Pin | null {
  if (!narrow) return pin;
  if (pin === PIN.end) return null;
  if (pin === PIN.start && startPinnedBefore > 0) return null;
  return pin;
}

export function computeLayout<Row>(table: DataTableInstance<Row>, options: LayoutOptions): TableLayout<Row> {
  const { narrow, containerWidth, startService, endService } = options;
  let startIndex = startService;
  let startPinned = 0;
  const columns = table.visible.map((column, index): ColumnLayout<Row> => {
    const pin = effectivePin(table.pinOf(column), narrow, startPinned);
    const pinIndex = pin === PIN.start ? startIndex : 0;
    if (pin === PIN.start) {
      startIndex += 1;
      startPinned += 1;
    }
    const minWidth = minWidthOf(column);
    let width = table.widthOf(column);
    if (narrow && pin === PIN.start && containerWidth !== null) {
      width = Math.max(minWidth, Math.min(width, Math.round(containerWidth * NARROW_PIN_SHARE)));
    }
    return {
      column,
      pin,
      pinIndex,
      align: alignOf(column),
      width,
      minWidth,
      grow: !narrow && column.id === table.growId && pin === null,
      cardRole: cardRoleOf(column, index),
    };
  });
  // End pins count from the end edge.
  let endIndex = endService;
  for (let i = columns.length - 1; i >= 0; i -= 1) {
    const layout = columns[i];
    if (layout === undefined || layout.pin !== PIN.end) continue;
    columns[i] = { ...layout, pinIndex: endIndex };
    endIndex += 1;
  }
  let minWidth = (startService + endService) * SERVICE_WIDTH;
  for (const layout of columns) {
    const resized = Object.hasOwn(table.state.widths, layout.column.id);
    minWidth += layout.grow && !resized ? layout.minWidth : layout.width;
  }
  return { columns, minWidth };
}
