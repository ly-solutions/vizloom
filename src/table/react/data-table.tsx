import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

import type { BlockState } from '../../core/contracts/state';
import { useLocale } from '../../core/theme/provider';
import { cx } from '../../core/ui/cx';
import { filterKindOf, isSortable, skeletonChOf } from '../core/columns';
import { formatCell, formatCount, formatTotal } from '../core/format';
import { diffRows, indexRows, type ChangeDirection } from '../core/live';
import { isBest, isFilterActive, shareOf } from '../core/pipeline';
import { tableStringsFor, type TableStrings } from '../core/strings';
import {
  COLUMN_TYPE,
  DENSITY,
  PAGINATION,
  PIN,
  type CellContext,
  type ColumnDef,
  type GroupItem,
  type Pin,
  type RowItem,
  type TotalValue,
} from '../core/types';
import { BarCell, StatusCell, UnknownCell, safeHref } from './cells';
import {
  cssVars,
  measureColumn,
  useColumnResize,
  useIsomorphicLayoutEffect,
  useElementWidth,
  useInfiniteLoad,
  useReducedMotion,
  useScrollEdges,
  useVirtualRows,
} from './dom-hooks';
import { computeLayout, type ColumnLayout, type TableLayout } from './layout';
import {
  AlertIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  Checkbox,
  ChevronDownIcon,
  ChevronRightIcon,
  DotsIcon,
  EyeOffIcon,
  FilterIcon,
  InboxIcon,
  InfoIcon,
  LockIcon,
  Menu,
  PinIcon,
  Popover,
  SearchOffIcon,
  SortIdleIcon,
  type MenuEntry,
} from './overlay';
import { ColumnFilterPanel, FilterChips } from './panels';
import type { DataTableInstance } from './use-data-table';

export const NARROW_LAYOUT = { scroll: 'scroll', cards: 'cards' } as const;
export type NarrowLayout = (typeof NARROW_LAYOUT)[keyof typeof NARROW_LAYOUT];

export interface TableStateMessage {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  onRetry?: () => void;
  action?: { label: string; onClick: () => void };
}

export interface DataTableProps<Row> {
  table: DataTableInstance<Row>;
  /** Accessible name of the grid. */
  label: string;
  /** State of the block from the shared contract; explicit `loading`/`error`/`noAccess`/`empty` win. */
  state?: BlockState;
  /** Limit the height (`'32rem'`, `480`): the table scrolls inside, header and totals stay. */
  maxHeight?: string | number;
  /** Below `narrowBelow` px of container width: scroll sideways with the first column pinned, or cards. */
  mobileLayout?: NarrowLayout;
  /** Container width (px) under which the phone layout applies. Default 640. */
  mobileBelow?: number;
  loading?: boolean;
  /** Load failed and there are no rows: an overlay with "Retry". */
  error?: TableStateMessage | null;
  /** A refresh failed but older rows are still shown: a banner above. */
  refreshError?: TableStateMessage | null;
  /** The viewer may not see this data. */
  noAccess?: TableStateMessage | boolean;
  empty?: TableStateMessage;
  /** Makes rows links (the first cell carries the real `<a>`). Ctrl/⌘-click opens a new tab. */
  rowHref?: (row: Row) => string | undefined;
  onRowNavigate?: (href: string, event: ReactMouseEvent<HTMLAnchorElement>) => void;
  /** Click or Enter on a row. */
  onRowClick?: (row: Row) => void;
  /** Row shown as active (an open side panel). */
  activeRowKey?: string | null;
  /** Items of the row's "⋯" menu. */
  rowMenu?: (row: Row) => readonly MenuEntry[];
  /** Content of an expanded row. Enables the expand toggle column. */
  renderExpanded?: (row: Row) => ReactNode;
  /** On a narrow container, a tap opens all columns of the row in a bottom sheet. */
  rowDetails?: boolean;
  /** Actions of the selection bar. */
  bulkActions?: (rows: Row[]) => ReactNode;
  /** Rows outside sorting and filters: "All", "No link". */
  pinnedRows?: { top?: readonly Row[]; bottom?: readonly Row[] };
  /** Flash changed cells (direction colour, "+N" chip) when rows update. */
  pulseChanges?: boolean;
  /** Server mode "show more" / infinite scroll. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  totalsLabel?: string;
  strings?: Partial<TableStrings>;
  className?: string;
}

const ROW_HEIGHT = { [DENSITY.regular]: 48, [DENSITY.compact]: 40 } as const;
const HEAD_HEIGHT = 40;
/** Virtualize from this many items, only with an own scroll area. */
const VIRTUAL_FROM = 120;
const SKELETON_ROWS = 6;
const MORE_SKELETON_ROWS = 3;
const LIVE_MS = 1600;
const LIVE_MAX = 14;
const PAGE_JUMP = 10;
const INTERACTIVE =
  'a, button, input, label, select, textarea, [role="checkbox"], [role="menuitem"], [role="separator"], [data-no-row-click]';

/** Offset of a pinned cell: CSS reads `--vt-ps-N` / `--vt-pe-N` by this index. */
function pinAttrs(pin: Pin | null, index: number): { 'data-pin-index'?: number } {
  return pin === null ? {} : { 'data-pin-index': index };
}

function cellContext<Row>(table: DataTableInstance<Row>, column: ColumnDef<Row>, row: Row): CellContext {
  const value = column.value(row);
  const extent = table.model.extents[column.id];
  return { value, formatted: formatCell(column, value, table.format), share: shareOf(value, extent), best: isBest(column, value, extent) };
}

function CellContent<Row>({
  column,
  row,
  context,
  strings,
}: {
  column: ColumnDef<Row>;
  row: Row;
  context: CellContext;
  strings: TableStrings;
}) {
  if (column.render !== undefined) return <>{column.render(row, context)}</>;
  if (context.value === null) return <UnknownCell reason={column.unknownReason} label={strings.unknown} />;
  if (column.type === COLUMN_TYPE.status) {
    const option = column.options?.find((item) => item.value === String(context.value));
    return <StatusCell tone={option?.tone ?? 'neutral'}>{context.formatted}</StatusCell>;
  }
  if (column.bar === true && context.share !== null) {
    return (
      <BarCell share={context.share} best={context.best}>
        {context.formatted}
      </BarCell>
    );
  }
  return (
    <span
      className="vl-table__text"
      data-measure=""
      data-best={context.best || undefined}
      title={column.type === COLUMN_TYPE.text ? context.formatted : undefined}
    >
      {context.formatted}
    </span>
  );
}

function TotalContent<Row>({
  table,
  column,
  total,
  strings,
}: {
  table: DataTableInstance<Row>;
  column: ColumnDef<Row>;
  total: TotalValue | undefined;
  strings: TableStrings;
}) {
  if (total === undefined) return null;
  if (total.unknown) {
    const reason =
      column.unknownReason === undefined
        ? strings.totalUnknown
        : strings.totalUnknownBecause(column.unknownReason.charAt(0).toLowerCase() + column.unknownReason.slice(1));
    return <UnknownCell reason={reason} />;
  }
  return (
    <span className="vl-table__text" data-measure="">
      {formatTotal(column, total, table.format)}
    </span>
  );
}

// ---------- header ----------

interface HeaderCellProps<Row> {
  table: DataTableInstance<Row>;
  layout: ColumnLayout<Row>;
  colIndex: number;
  focusCol: number | null;
  resizable: boolean;
  tableRef: React.RefObject<HTMLTableElement | null>;
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  strings: TableStrings;
}

function HeaderCell<Row>({
  table,
  layout,
  colIndex,
  focusCol,
  resizable,
  tableRef,
  filterOpen,
  onFilterOpenChange,
  strings,
}: HeaderCellProps<Row>) {
  const { column } = layout;
  const cellRef = useRef<HTMLTableCellElement | null>(null);
  const menuAnchor = useRef<HTMLButtonElement | null>(null);
  const infoAnchor = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const sortIndex = table.state.sort.findIndex((key) => key.columnId === column.id);
  const sortKey = sortIndex === -1 ? undefined : table.state.sort[sortIndex];
  const sortable = isSortable(column);
  const filter = table.state.filters[column.id];
  const filtered = filter !== undefined && isFilterActive(filter);
  const multi = table.state.sort.length > 1;
  const resize = useColumnResize({
    width: layout.width,
    minWidth: layout.minWidth,
    onResize: (width) => table.setWidth(column.id, width),
    onAutoFit: () => {
      if (tableRef.current !== null) table.setWidth(column.id, Math.max(layout.minWidth, measureColumn(tableRef.current, column.id)));
    },
  });

  const pin = table.pinOf(column);
  const items: MenuEntry[] = [];
  if (sortable) {
    items.push(
      {
        id: 'asc',
        label: strings.sortAscending,
        icon: <ArrowUpIcon />,
        disabled: sortKey?.direction === 'asc' && !multi,
        onSelect: () => table.setSort([{ columnId: column.id, direction: 'asc' }]),
      },
      {
        id: 'desc',
        label: strings.sortDescending,
        icon: <ArrowDownIcon />,
        disabled: sortKey?.direction === 'desc' && !multi,
        onSelect: () => table.setSort([{ columnId: column.id, direction: 'desc' }]),
      },
    );
    if (sortKey !== undefined)
      items.push({
        id: 'none',
        label: strings.noSort,
        onSelect: () => table.setSort(table.state.sort.filter((key) => key.columnId !== column.id)),
      });
    items.push('separator');
  }
  if (filterKindOf(column) !== null)
    items.push({ id: 'filter', label: strings.filterAction, icon: <FilterIcon />, onSelect: () => onFilterOpenChange(true) }, 'separator');
  if (pin !== PIN.start)
    items.push({
      id: 'pin-start',
      label: `${strings.pinColumn(column.title)}: ${strings.pinStart}`,
      icon: <PinIcon />,
      onSelect: () => table.setPin(column.id, PIN.start),
    });
  if (pin !== PIN.end)
    items.push({
      id: 'pin-end',
      label: `${strings.pinColumn(column.title)}: ${strings.pinEnd}`,
      icon: <PinIcon />,
      onSelect: () => table.setPin(column.id, PIN.end),
    });
  if (pin !== null) items.push({ id: 'unpin', label: strings.unpin, onSelect: () => table.setPin(column.id, null) });
  if (column.hideable !== false)
    items.push('separator', {
      id: 'hide',
      label: strings.hideColumn,
      icon: <EyeOffIcon />,
      onSelect: () => table.setHidden(column.id, true),
    });

  const title = (
    <span className="vl-table__title" data-measure="">
      {column.title}
    </span>
  );
  return (
    <th
      ref={cellRef}
      scope="col"
      className="vl-table__th"
      data-col={column.id}
      data-align={layout.align}
      data-pin={layout.pin ?? undefined}
      data-sorted={sortKey?.direction}
      data-cell=""
      data-r={-1}
      data-c={colIndex}
      tabIndex={focusCol === colIndex ? 0 : -1}
      aria-sort={
        sortable
          ? sortIndex === 0 && sortKey !== undefined
            ? sortKey.direction === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
          : undefined
      }
      {...pinAttrs(layout.pin, layout.pinIndex)}
    >
      <div className="vl-table__head">
        {sortable ? (
          <button
            type="button"
            className="vl-table__sort"
            tabIndex={-1}
            onClick={(event) => table.toggleSort(column.id, event.shiftKey)}
            aria-label={sortKey === undefined ? strings.sortBy(column.title) : strings.sortedBy(column.title, sortKey.direction === 'desc')}
          >
            {title}
            {sortKey === undefined ? (
              <span className="vl-table__sort-icon" data-idle="">
                <SortIdleIcon />
              </span>
            ) : (
              <span className="vl-table__sort-icon">{sortKey.direction === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />}</span>
            )}
            {multi && sortKey !== undefined ? (
              <span className="vl-table__sort-order" aria-hidden="true">
                {sortIndex + 1}
              </span>
            ) : null}
          </button>
        ) : (
          title
        )}
        {column.description === undefined ? null : (
          <>
            <button
              ref={infoAnchor}
              type="button"
              tabIndex={-1}
              className="vl-table__info"
              aria-label={strings.whatIs(column.title)}
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen(!infoOpen)}
            >
              <InfoIcon />
            </button>
            <Popover
              open={infoOpen}
              onOpenChange={setInfoOpen}
              anchor={infoAnchor}
              label={column.title}
              sheetTitle={column.title}
              className="vl-table-hint"
            >
              <p className="vl-table-hint__text">{column.description}</p>
            </Popover>
          </>
        )}
        {filtered ? <span className="vl-table__filtered" role="img" aria-label={strings.columnFiltered} /> : null}
        <button
          ref={menuAnchor}
          type="button"
          tabIndex={-1}
          className="vl-table__menu-trigger vl-table-icon-button"
          aria-label={strings.columnActions(column.title)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <ChevronDownIcon />
        </button>
        <Menu open={menuOpen} onOpenChange={setMenuOpen} anchor={menuAnchor} label={strings.columnActions(column.title)} items={items} />
        <Popover
          open={filterOpen}
          onOpenChange={onFilterOpenChange}
          anchor={cellRef}
          align={layout.align === 'end' ? 'end' : 'start'}
          label={strings.filter(column.title)}
          sheetTitle={strings.filter(column.title)}
          className="vl-table-panel"
        >
          <ColumnFilterPanel table={table} column={column} strings={strings} onDone={() => onFilterOpenChange(false)} />
        </Popover>
      </div>
      {resizable ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={strings.columnWidth(column.title)}
          aria-valuenow={layout.width}
          aria-valuemin={layout.minWidth}
          tabIndex={0}
          className="vl-table__resizer"
          {...resize}
        />
      ) : null}
    </th>
  );
}

// ---------- rows ----------

interface RowContext<Row> {
  table: DataTableInstance<Row>;
  layout: TableLayout<Row>;
  strings: TableStrings;
  selected: ReadonlySet<string>;
  expandable: boolean;
  hasMenu: boolean;
  rowMenu?: (row: Row) => readonly MenuEntry[];
  rowHref?: (row: Row) => string | undefined;
  onRowNavigate?: (href: string, event: ReactMouseEvent<HTMLAnchorElement>) => void;
  onRowActivate?: (row: Row) => void;
  onOpenDetails?: (key: string) => void;
  activeRowKey?: string | null;
  focus: { r: number; c: number };
  changes: ReadonlyMap<string, LiveMark>;
  groupRows: ReadonlyMap<string, string[]>;
  renderExpanded?: (row: Row) => ReactNode;
  colCount: number;
}

interface LiveMark {
  direction: ChangeDirection;
  delta: string | null;
  stamp: number;
}

function liveKey(rowKey: string, columnId: string): string {
  return `${rowKey}\u0000${columnId}`;
}

function RowMenuButton<Row>({ row, items, label }: { row: Row; items: (row: Row) => readonly MenuEntry[]; label: string }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        tabIndex={-1}
        className="vl-table-icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <DotsIcon />
      </button>
      {open ? <Menu open={open} onOpenChange={setOpen} anchor={anchor} label={label} items={items(row)} /> : null}
    </>
  );
}

function ServiceCell({
  pin,
  index,
  role,
  colIndex,
  rowIndex,
  focused,
  children,
  header = false,
}: {
  pin: Pin;
  index: number;
  role: string;
  colIndex: number;
  rowIndex: number;
  focused: boolean;
  children?: ReactNode;
  header?: boolean;
}) {
  const Tag = header ? 'th' : 'td';
  return (
    <Tag
      className={cx(header ? 'vl-table__th' : 'vl-table__td', 'vl-table__service')}
      data-pin={pin}
      data-card={role}
      data-cell=""
      data-r={rowIndex}
      data-c={colIndex}
      tabIndex={focused ? 0 : -1}
      scope={header ? 'col' : undefined}
      {...pinAttrs(pin, index)}
    >
      {children}
    </Tag>
  );
}

function BodyRow<Row>({ context, item, rowIndex }: { context: RowContext<Row>; item: RowItem<Row>; rowIndex: number }) {
  const {
    table,
    layout,
    strings,
    selected,
    expandable,
    hasMenu,
    rowMenu,
    rowHref,
    onRowNavigate,
    onRowActivate,
    onOpenDetails,
    activeRowKey,
    focus,
    changes,
    renderExpanded,
    colCount,
  } = context;
  const { row, key, depth } = item;
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const rawHref = rowHref?.(row);
  const href = rawHref === undefined ? undefined : (safeHref(rawHref) ?? undefined);
  const isSelected = selected.has(key);
  const canExpand = expandable && table.isExpandable(row);
  const isExpanded = canExpand && table.state.expanded.includes(key);
  const clickable = href !== undefined || onRowActivate !== undefined || onOpenDetails !== undefined;
  let col = 0;
  const focusedHere = (c: number) => focus.r === rowIndex && focus.c === c;

  const activate = () => {
    if (onRowActivate !== undefined) onRowActivate(row);
    else onOpenDetails?.(key);
  };
  const onClick = (event: ReactMouseEvent<HTMLTableRowElement>) => {
    if (!clickable) return;
    const target = (event.target as Element).closest(INTERACTIVE);
    if (target !== null && event.currentTarget.contains(target)) return;
    if (href !== undefined) {
      if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener');
      else linkRef.current?.click();
      return;
    }
    activate();
  };

  const cells: ReactNode[] = [];
  if (table.selectable) {
    const c = col++;
    cells.push(
      <ServiceCell key="__select" pin={PIN.start} index={0} role="select" colIndex={c} rowIndex={rowIndex} focused={focusedHere(c)}>
        <Checkbox checked={isSelected} onChange={() => table.toggleRow(key)} aria-label={strings.selectRow} />
      </ServiceCell>,
    );
  }
  if (expandable) {
    const c = col++;
    cells.push(
      <ServiceCell
        key="__expand"
        pin={PIN.start}
        index={table.selectable ? 1 : 0}
        role="expand"
        colIndex={c}
        rowIndex={rowIndex}
        focused={focusedHere(c)}
      >
        {canExpand ? (
          <button
            type="button"
            tabIndex={-1}
            className="vl-table__expand vl-table-icon-button"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? strings.collapseRow : strings.expandRow}
            onClick={() => table.toggleExpanded(key)}
          >
            <ChevronRightIcon />
          </button>
        ) : null}
      </ServiceCell>,
    );
  }
  layout.columns.forEach((columnLayout, index) => {
    const c = col++;
    const { column } = columnLayout;
    const cellCtx = cellContext(table, column, row);
    const mark = changes.get(liveKey(key, column.id));
    const content = <CellContent column={column} row={row} context={cellCtx} strings={strings} />;
    cells.push(
      <td
        key={column.id}
        className="vl-table__td"
        data-col={column.id}
        data-align={columnLayout.align}
        data-pin={columnLayout.pin ?? undefined}
        data-card={columnLayout.cardRole}
        data-first={index === 0 || undefined}
        data-empty={cellCtx.value === null || undefined}
        data-change={mark?.direction}
        data-cell=""
        data-r={rowIndex}
        data-c={c}
        tabIndex={focusedHere(c) ? 0 : -1}
        {...pinAttrs(columnLayout.pin, columnLayout.pinIndex)}
      >
        {column.cardLabel === undefined ? null : <span className="vl-table__card-label">{column.cardLabel}</span>}
        {index === 0 && href !== undefined ? (
          <a ref={linkRef} href={href} tabIndex={-1} className="vl-table__link" onClick={(event) => onRowNavigate?.(href, event)}>
            {content}
          </a>
        ) : (
          content
        )}
        {mark === undefined ? null : (
          <span key={mark.stamp} className="vl-table__pulse" data-direction={mark.direction} aria-hidden="true">
            {mark.delta === null ? null : <span className="vl-table__pulse-chip">{mark.delta}</span>}
          </span>
        )}
      </td>,
    );
  });
  if (hasMenu) {
    const c = col++;
    cells.push(
      <ServiceCell key="__menu" pin={PIN.end} index={0} role="menu" colIndex={c} rowIndex={rowIndex} focused={focusedHere(c)}>
        {rowMenu === undefined ? null : <RowMenuButton row={row} items={rowMenu} label={strings.rowActions} />}
      </ServiceCell>,
    );
  }

  return (
    <>
      <tr
        className="vl-table__row"
        data-depth={depth}
        data-key={key}
        data-selected={isSelected || undefined}
        data-active={(activeRowKey !== undefined && activeRowKey !== null && activeRowKey === key) || undefined}
        data-clickable={clickable || undefined}
        data-expanded={isExpanded || undefined}
        aria-rowindex={rowIndex + 2}
        aria-selected={table.selectable ? isSelected : undefined}
        aria-expanded={canExpand ? isExpanded : undefined}
        onClick={onClick}
      >
        {cells}
      </tr>
      {isExpanded && renderExpanded !== undefined ? (
        <tr className="vl-table__expanded" data-key={key}>
          <td className="vl-table__expanded-cell" colSpan={colCount}>
            <div className="vl-table__expanded-body">{renderExpanded(row)}</div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function GroupRow<Row>({ context, item, rowIndex }: { context: RowContext<Row>; item: GroupItem; rowIndex: number }) {
  const { table, layout, strings, selected, expandable, hasMenu, focus, groupRows } = context;
  const keys = groupRows.get(item.groupKey) ?? [];
  const count = keys.filter((key) => selected.has(key)).length;
  const checked = count === 0 ? false : count === keys.length ? true : 'indeterminate';
  const setGroup = (value: boolean) => {
    const inGroup = new Set(keys);
    const rest = table.state.selected.filter((key) => !inGroup.has(key));
    table.setSelected(value ? [...rest, ...keys] : rest);
  };
  let col = 0;
  const focusedHere = (c: number) => focus.r === rowIndex && focus.c === c;
  const cells: ReactNode[] = [];
  if (table.selectable) {
    const c = col++;
    cells.push(
      <ServiceCell key="__select" pin={PIN.start} index={0} role="select" colIndex={c} rowIndex={rowIndex} focused={focusedHere(c)}>
        <Checkbox checked={checked} onChange={setGroup} aria-label={strings.selectGroup(item.title)} />
      </ServiceCell>,
    );
  }
  if (expandable) {
    const c = col++;
    cells.push(
      <ServiceCell
        key="__expand"
        pin={PIN.start}
        index={table.selectable ? 1 : 0}
        role="expand"
        colIndex={c}
        rowIndex={rowIndex}
        focused={focusedHere(c)}
      />,
    );
  }
  layout.columns.forEach((columnLayout, index) => {
    const c = col++;
    cells.push(
      <td
        key={columnLayout.column.id}
        className="vl-table__td"
        data-col={columnLayout.column.id}
        data-align={columnLayout.align}
        data-pin={columnLayout.pin ?? undefined}
        data-card={columnLayout.cardRole}
        data-first={index === 0 || undefined}
        data-cell=""
        data-r={rowIndex}
        data-c={c}
        tabIndex={focusedHere(c) ? 0 : -1}
        {...pinAttrs(columnLayout.pin, columnLayout.pinIndex)}
      >
        {index === 0 ? (
          <button
            type="button"
            tabIndex={-1}
            className="vl-table__group-toggle"
            aria-expanded={item.expanded}
            onClick={() => table.toggleGroup(item.groupKey)}
          >
            <span className="vl-table__group-chevron">
              <ChevronRightIcon />
            </span>
            <span className="vl-table__group-title">{item.title}</span>
            <span className="vl-table__group-count">{formatCount(item.count, table.format.locale)}</span>
          </button>
        ) : (
          <TotalContent table={table} column={columnLayout.column} total={item.totals[columnLayout.column.id]} strings={strings} />
        )}
      </td>,
    );
  });
  if (hasMenu) {
    const c = col++;
    cells.push(<ServiceCell key="__menu" pin={PIN.end} index={0} role="menu" colIndex={c} rowIndex={rowIndex} focused={focusedHere(c)} />);
  }
  return (
    <tr className="vl-table__group" data-expanded={item.expanded} aria-rowindex={rowIndex + 2} aria-expanded={item.expanded}>
      {cells}
    </tr>
  );
}

function PinnedRow<Row>({ context, row, position }: { context: RowContext<Row>; row: Row; position: 'top' | 'bottom' }) {
  const { table, layout, strings, expandable, hasMenu } = context;
  return (
    <tr className="vl-table__row vl-table__row--pinned" data-pinned-row={position}>
      {table.selectable ? <td className="vl-table__td vl-table__service" data-pin="start" {...pinAttrs(PIN.start, 0)} /> : null}
      {expandable ? (
        <td className="vl-table__td vl-table__service" data-pin="start" {...pinAttrs(PIN.start, table.selectable ? 1 : 0)} />
      ) : null}
      {layout.columns.map((columnLayout, index) => (
        <td
          key={columnLayout.column.id}
          className="vl-table__td"
          data-col={columnLayout.column.id}
          data-align={columnLayout.align}
          data-pin={columnLayout.pin ?? undefined}
          data-card={columnLayout.cardRole}
          data-first={index === 0 || undefined}
          {...pinAttrs(columnLayout.pin, columnLayout.pinIndex)}
        >
          <CellContent column={columnLayout.column} row={row} context={cellContext(table, columnLayout.column, row)} strings={strings} />
        </td>
      ))}
      {hasMenu ? <td className="vl-table__td vl-table__service" data-pin="end" {...pinAttrs(PIN.end, 0)} /> : null}
    </tr>
  );
}

function SkeletonRows<Row>({ context, count }: { context: RowContext<Row>; count: number }) {
  const { table, layout, expandable, hasMenu } = context;
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <tr key={index} className="vl-table__row vl-table__row--skeleton" aria-hidden="true">
          {table.selectable ? (
            <td className="vl-table__td vl-table__service" data-pin="start" data-card="select" {...pinAttrs(PIN.start, 0)}>
              <span className="vl-table__skeleton" data-type="check" />
            </td>
          ) : null}
          {expandable ? (
            <td
              className="vl-table__td vl-table__service"
              data-pin="start"
              data-card="expand"
              {...pinAttrs(PIN.start, table.selectable ? 1 : 0)}
            />
          ) : null}
          {layout.columns.map((columnLayout, cellIndex) => (
            <td
              key={columnLayout.column.id}
              className="vl-table__td"
              data-align={columnLayout.align}
              data-pin={columnLayout.pin ?? undefined}
              data-card={columnLayout.cardRole}
              data-first={cellIndex === 0 || undefined}
              {...pinAttrs(columnLayout.pin, columnLayout.pinIndex)}
            >
              <span
                className="vl-table__skeleton"
                data-type={columnLayout.column.type}
                ref={cssVars({
                  '--vt-skeleton-ch': `${Math.max(3, Math.round(skeletonChOf(columnLayout.column) * (1 - (index % 3) * 0.2)))}ch`,
                })}
              />
            </td>
          ))}
          {hasMenu ? <td className="vl-table__td vl-table__service" data-pin="end" data-card="menu" {...pinAttrs(PIN.end, 0)} /> : null}
        </tr>
      ))}
    </>
  );
}

function TotalsRow<Row>({ context, label }: { context: RowContext<Row>; label: string }) {
  const { table, layout, strings, expandable, hasMenu } = context;
  return (
    <tr className="vl-table__totals">
      {table.selectable ? (
        <td className="vl-table__td vl-table__service" data-pin="start" data-card="select" {...pinAttrs(PIN.start, 0)} />
      ) : null}
      {expandable ? (
        <td
          className="vl-table__td vl-table__service"
          data-pin="start"
          data-card="expand"
          {...pinAttrs(PIN.start, table.selectable ? 1 : 0)}
        />
      ) : null}
      {layout.columns.map((columnLayout, index) => (
        <td
          key={columnLayout.column.id}
          className="vl-table__td"
          data-col={columnLayout.column.id}
          data-align={columnLayout.align}
          data-pin={columnLayout.pin ?? undefined}
          data-card={columnLayout.cardRole}
          data-first={index === 0 || undefined}
          {...pinAttrs(columnLayout.pin, columnLayout.pinIndex)}
        >
          {index === 0 && columnLayout.column.total === undefined ? (
            <span className="vl-table__totals-label">{label}</span>
          ) : (
            <TotalContent table={table} column={columnLayout.column} total={table.model.totals[columnLayout.column.id]} strings={strings} />
          )}
        </td>
      ))}
      {hasMenu ? <td className="vl-table__td vl-table__service" data-pin="end" data-card="menu" {...pinAttrs(PIN.end, 0)} /> : null}
    </tr>
  );
}

// ---------- states, pager, selection ----------

function StateBlock({
  icon,
  title,
  description,
  action,
  tone,
  overlay = false,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  tone?: 'danger' | 'muted';
  overlay?: boolean;
}) {
  return (
    <div className={overlay ? 'vl-table__overlay' : 'vl-table__state'} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className="vl-table-state" data-tone={tone}>
        <span className="vl-table-state__icon" aria-hidden="true">
          {icon}
        </span>
        <p className="vl-table-state__title">{title}</p>
        {description === undefined ? null : <p className="vl-table-state__description">{description}</p>}
        {action === undefined ? null : (
          <button type="button" className="vl-table-button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZES = [25, 50, 100] as const;

function Pager<Row>({
  table,
  strings,
  hasMore,
  onLoadMore,
  loadingMore,
}: {
  table: DataTableInstance<Row>;
  strings: TableStrings;
  hasMore: boolean;
  onLoadMore?: () => void;
  loadingMore: boolean;
}) {
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizeAnchor = useRef<HTMLButtonElement | null>(null);
  const { pagination, state, model } = table;
  const locale = table.format.locale;
  const count = table.mode === 'server' ? model.totalCount : model.itemCount;
  if (pagination === PAGINATION.pages) {
    // One page and nothing to gain from a bigger page size: no pager at all.
    if (model.pageCount <= 1 && count <= (PAGE_SIZES[0] ?? 25)) return null;
    const from = state.page * state.pageSize + 1;
    const to = Math.min((state.page + 1) * state.pageSize, count);
    return (
      <nav className="vl-table__pager" aria-label={strings.rowsPerPage}>
        <span className="vl-table__pager-range" aria-live="polite">
          {strings.pageRange(formatCount(from, locale), formatCount(to, locale), formatCount(count, locale))}
        </span>
        <button
          type="button"
          className="vl-table-icon-button"
          aria-label={strings.previousPage}
          disabled={state.page === 0}
          onClick={() => table.setPage(state.page - 1)}
        >
          <span className="vl-table-flip">
            <ChevronRightIcon />
          </span>
        </button>
        <button
          type="button"
          className="vl-table-icon-button"
          aria-label={strings.nextPage}
          disabled={state.page >= model.pageCount - 1}
          onClick={() => table.setPage(state.page + 1)}
        >
          <ChevronRightIcon />
        </button>
        <button
          ref={sizeAnchor}
          type="button"
          className="vl-table-button vl-table-button--flat vl-table-button--xs"
          aria-haspopup="menu"
          aria-expanded={sizeOpen}
          onClick={() => setSizeOpen(!sizeOpen)}
        >
          {strings.perPage(state.pageSize)}
        </button>
        <Menu
          open={sizeOpen}
          onOpenChange={setSizeOpen}
          anchor={sizeAnchor}
          label={strings.rowsPerPage}
          items={PAGE_SIZES.map((size) => ({
            id: String(size),
            label: strings.perPage(size),
            checked: size === state.pageSize,
            onSelect: () => table.setPageSize(size),
          }))}
        />
      </nav>
    );
  }
  if (pagination === PAGINATION.more) {
    const shown = model.items.length;
    const more = table.mode === 'server' ? hasMore : shown < count;
    if (!more && shown >= count) return null;
    const next = Math.min(state.pageSize, count - shown);
    return (
      <div className="vl-table__pager vl-table__pager--more">
        {more ? (
          <button
            type="button"
            className="vl-table-button"
            aria-busy={loadingMore || undefined}
            disabled={loadingMore}
            onClick={() => (table.mode === 'server' ? onLoadMore?.() : table.setPage(state.page + 1))}
          >
            {strings.showMore(next > 0 ? formatCount(next, locale) : '')}
          </button>
        ) : null}
        <span className="vl-table__pager-range">{strings.shown(formatCount(shown, locale), formatCount(count, locale))}</span>
      </div>
    );
  }
  return null;
}

function SelectionBar<Row>({
  table,
  strings,
  bulkActions,
}: {
  table: DataTableInstance<Row>;
  strings: TableStrings;
  bulkActions?: (rows: Row[]) => ReactNode;
}) {
  const count = table.state.selected.length;
  const [shown, setShown] = useState(count);
  if (count > 0 && shown !== count) setShown(count);
  const phase = count > 0 ? 'open' : 'closing';
  if (count === 0 && shown === 0) return null;
  const locale = table.format.locale;
  return (
    <div
      className="vl-table__selection"
      role="region"
      aria-label={strings.selectedRegion}
      data-phase={phase}
      onAnimationEnd={() => {
        if (count === 0) setShown(0);
      }}
    >
      <span className="vl-table__selection-count" aria-live="polite">
        {strings.selectedOf(formatCount(shown, locale), formatCount(table.model.matchedCount, locale))}
      </span>
      <div className="vl-table__selection-actions">{bulkActions?.(table.selectedRows)}</div>
      <button type="button" className="vl-table-button vl-table-button--flat" onClick={() => table.setSelected([])}>
        {strings.clearSelection}
      </button>
    </div>
  );
}

function CardsSort<Row>({ table, strings }: { table: DataTableInstance<Row>; strings: TableStrings }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const sortable = table.ordered.filter((column) => isSortable(column) && !table.state.hidden.includes(column.id));
  if (sortable.length === 0) return null;
  const key = table.state.sort[0];
  const column = key === undefined ? undefined : table.columns.find((item) => item.id === key.columnId);
  const items: MenuEntry[] = [
    ...sortable.map((item) => ({
      id: item.id,
      label: item.title,
      checked: item.id === key?.columnId,
      onSelect: () => table.setSort([{ columnId: item.id, direction: key?.direction ?? 'desc' }]),
    })),
    'separator',
    {
      id: 'desc',
      label: strings.sortDescending,
      checked: key?.direction === 'desc',
      disabled: key === undefined,
      onSelect: () => key && table.setSort([{ columnId: key.columnId, direction: 'desc' }]),
    },
    {
      id: 'asc',
      label: strings.sortAscending,
      checked: key?.direction === 'asc',
      disabled: key === undefined,
      onSelect: () => key && table.setSort([{ columnId: key.columnId, direction: 'asc' }]),
    },
    { id: 'none', label: strings.noSort, disabled: key === undefined, onSelect: () => table.setSort([]) },
  ];
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="vl-table-button vl-table-button--secondary vl-table-button--xs"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {column === undefined ? strings.cardsNoSort : strings.sortLabel(column.title)}
        {key === undefined ? null : key.direction === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />}
      </button>
      <Menu open={open} onOpenChange={setOpen} anchor={anchor} label={strings.cardsSorting} items={items} align="start" />
    </>
  );
}

function RowDetails<Row>({
  table,
  rowKey,
  onClose,
  strings,
  anchor,
}: {
  table: DataTableInstance<Row>;
  rowKey: string | null;
  onClose: () => void;
  strings: TableStrings;
  anchor: React.RefObject<HTMLElement | null>;
}) {
  const row = rowKey === null ? undefined : table.rows.find((item) => table.rowKey(item) === rowKey);
  const [first] = table.ordered;
  const title = row !== undefined && first !== undefined ? formatCell(first, first.value(row), table.format) : strings.details;
  return (
    <Popover
      open={row !== undefined}
      onOpenChange={(open) => (open ? undefined : onClose())}
      anchor={anchor}
      mode="sheet"
      label={title}
      sheetTitle={title}
      className="vl-table-details-sheet"
    >
      {row === undefined ? null : (
        <dl className="vl-table__details">
          {table.ordered.map((column) => (
            <div key={column.id} className="vl-table__details-item">
              <dt>{column.title}</dt>
              <dd data-align={column.type}>
                <CellContent column={column} row={row} context={cellContext(table, column, row)} strings={strings} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Popover>
  );
}

// ---------- the table ----------

interface StateProps {
  loading: boolean;
  error: TableStateMessage | null;
  noAccess: TableStateMessage | false;
  empty: TableStateMessage | undefined;
}

/** The shared block state as table props. */
function blockStateProps(state: BlockState | undefined): StateProps {
  const none: StateProps = { loading: false, error: null, noAccess: false, empty: undefined };
  if (state === undefined) return none;
  switch (state.status) {
    case 'loading':
      return { ...none, loading: true };
    case 'error':
      return { ...none, error: { title: state.title, description: state.reason, onRetry: state.onRetry } };
    case 'no-access':
      return { ...none, noAccess: { title: state.title, description: state.reason } };
    case 'empty':
      return { ...none, empty: { title: state.title, description: state.reason } };
    case 'ready':
    case 'partial':
      return none;
  }
}

/**
 * Data table on top of `useDataTable`: pinned header and columns with scroll shadows, sorting,
 * filters, grouping with totals, expandable and selectable rows, resizable columns, pages,
 * virtualization, live cell pulses, a phone layout and an ARIA grid with arrow-key navigation.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const {
    table,
    label: ariaLabel,
    state: blockState,
    maxHeight,
    mobileLayout: narrow = NARROW_LAYOUT.scroll,
    mobileBelow: narrowBelow = 640,
    loading: loadingProp,
    error: errorProp,
    refreshError = null,
    noAccess: noAccessProp,
    empty: emptyProp,
    rowHref,
    onRowNavigate,
    onRowClick: onRowActivate,
    activeRowKey,
    rowMenu,
    renderExpanded,
    rowDetails = false,
    bulkActions,
    pinnedRows,
    pulseChanges: live = false,
    hasMore = false,
    onLoadMore,
    loadingMore = false,
    totalsLabel,
    strings: stringsOverride,
    className,
  } = props;
  const fromState = blockStateProps(blockState);
  const loading = loadingProp ?? fromState.loading;
  const error = errorProp === undefined ? fromState.error : errorProp;
  const noAccess = noAccessProp ?? fromState.noAccess;
  const empty = emptyProp ?? fromState.empty;
  const partial = blockState?.status === 'partial' ? blockState : null;
  const locale = useLocale();
  const strings = useMemo<TableStrings>(() => ({ ...tableStringsFor(locale.code), ...stringsOverride }), [locale.code, stringsOverride]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: -1, c: 0 });
  const pendingFocus = useRef(false);
  const reducedMotion = useReducedMotion();

  const width = useElementWidth(rootRef);
  const isNarrow = width !== null && width > 0 && width < narrowBelow;
  const cards = isNarrow && narrow === NARROW_LAYOUT.cards;
  const expandable = renderExpanded !== undefined;
  const hasMenu = rowMenu !== undefined;
  const startService = (table.selectable ? 1 : 0) + (expandable ? 1 : 0);
  const layout = useMemo(
    () => computeLayout(table, { narrow: isNarrow, containerWidth: width, startService, endService: hasMenu ? 1 : 0 }),
    [table, isNarrow, width, startService, hasMenu],
  );
  const overflow = useScrollEdges(rootRef, scrollerRef, tableRef);
  const { model, state } = table;

  const denied = noAccess !== false;
  const loadFailed = error !== null && table.rows.length === 0;
  const showSkeleton = !denied && ((loading && table.rows.length === 0) || loadFailed);
  const isEmpty = !denied && !showSkeleton && error === null && model.totalCount === 0;
  const noMatches = !denied && !showSkeleton && model.totalCount > 0 && model.matchedCount === 0;
  const hasTotals = table.visible.some((column) => column.total !== undefined);
  const virtual = !cards && maxHeight !== undefined && model.items.length > VIRTUAL_FROM && state.expanded.length === 0;
  const rowHeight = ROW_HEIGHT[state.density];
  const windowed = useVirtualRows({ scroller: scrollerRef, count: model.items.length, rowHeight, offset: HEAD_HEIGHT, enabled: virtual });
  const colCount = layout.columns.length + startService + (hasMenu ? 1 : 0);
  const selected = useMemo(() => new Set(state.selected), [state.selected]);

  const groupRows = useMemo(() => {
    const map = new Map<string, string[]>();
    const grouping = table.groupings.find((item) => item.id === state.groupBy);
    if (grouping === undefined) return map;
    for (const row of model.matched) {
      const key = grouping.key(row);
      const list = map.get(key) ?? [];
      list.push(table.rowKey(row));
      map.set(key, list);
    }
    return map;
  }, [table, state.groupBy, model.matched]);

  // Live: compare the new rows with the previous snapshot and mark changed cells for 1.6 s.
  const previous = useRef<Map<string, Row> | null>(null);
  const [changes, setChanges] = useState<ReadonlyMap<string, LiveMark>>(() => new Map());
  const stamp = useRef(0);
  useEffect(() => {
    if (!live) {
      previous.current = null;
      return undefined;
    }
    const before = previous.current;
    previous.current = indexRows(table.rows, table.rowKey);
    if (before === null) return undefined;
    const found = diffRows(before, table.rows, table.visible, table.rowKey).slice(0, LIVE_MAX);
    if (found.length === 0) return undefined;
    stamp.current += 1;
    const current = stamp.current;
    setChanges((old) => {
      const next = new Map(old);
      for (const change of found) {
        const column = table.visible.find((item) => item.id === change.columnId);
        const delta =
          change.delta === null || column === undefined
            ? null
            : `${change.delta > 0 ? '+' : '−'}${formatCell(column, Math.abs(change.delta), table.format)}`;
        next.set(liveKey(change.rowKey, change.columnId), { direction: change.direction, delta, stamp: current });
      }
      return next;
    });
    const timer = setTimeout(
      () => {
        setChanges((old) => {
          const next = new Map(old);
          for (const [key, mark] of old) if (mark.stamp === current) next.delete(key);
          return next;
        });
      },
      reducedMotion ? LIVE_MS / 2 : LIVE_MS,
    );
    return () => clearTimeout(timer);
  }, [live, table.rows, table.rowKey, table.visible, table.format, reducedMotion]);

  const moreToLoad = table.mode === 'server' ? hasMore : model.items.length < model.itemCount;
  useInfiniteLoad(
    sentinelRef,
    maxHeight === undefined ? null : scrollerRef,
    () => {
      if (loadingMore) return;
      if (table.mode === 'server') onLoadMore?.();
      else table.setPage(state.page + 1);
    },
    table.pagination === PAGINATION.infinite && moreToLoad && !showSkeleton,
  );

  // ---- keyboard grid ----
  const itemCount = showSkeleton || denied ? 0 : model.items.length;
  const lastCol = colCount - 1;
  const moveFocus = useCallback(
    (r: number, c: number) => {
      const row = Math.max(-1, Math.min(itemCount - 1, r));
      const col = Math.max(0, Math.min(lastCol, c));
      pendingFocus.current = true;
      setFocus({ r: row, c: col });
      // A row outside the rendered window: scroll to it first, the effect focuses it after render.
      const scroller = scrollerRef.current;
      if (virtual && scroller !== null && row >= 0) {
        const top = HEAD_HEIGHT + row * rowHeight;
        if (top < scroller.scrollTop + HEAD_HEIGHT) scroller.scrollTop = top - HEAD_HEIGHT;
        else if (top + rowHeight > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + rowHeight - scroller.clientHeight;
      }
    },
    [itemCount, lastCol, virtual, rowHeight],
  );

  useEffect(() => {
    if (!pendingFocus.current) return;
    const cell = tableRef.current?.querySelector<HTMLElement>(`[data-cell][data-r="${focus.r}"][data-c="${focus.c}"]`);
    if (cell !== null && cell !== undefined) {
      pendingFocus.current = false;
      cell.focus({ preventScroll: true });
      cell.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  });

  // Keep the tab stop inside the grid when rows shrink.
  if (focus.r >= itemCount && focus.r !== -1) setFocus({ r: itemCount - 1, c: focus.c });
  if (focus.c > lastCol) setFocus({ r: focus.r, c: lastCol });

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>('[data-cell]');
    if (cell === null) return;
    const r = Number(cell.dataset['r']);
    const c = Number(cell.dataset['c']);
    if (target !== cell) {
      // Inside a control of the cell: only Escape leaves it.
      if (event.key === 'Escape') {
        event.preventDefault();
        cell.focus();
      }
      return;
    }
    const rtl = getComputedStyle(cell).direction === 'rtl';
    switch (event.key) {
      case 'ArrowDown':
        moveFocus(r + 1, c);
        break;
      case 'ArrowUp':
        moveFocus(r - 1, c);
        break;
      case 'ArrowRight':
        moveFocus(r, c + (rtl ? -1 : 1));
        break;
      case 'ArrowLeft':
        moveFocus(r, c - (rtl ? -1 : 1));
        break;
      case 'Home':
        moveFocus(event.ctrlKey ? 0 : r, 0);
        break;
      case 'End':
        moveFocus(event.ctrlKey ? itemCount - 1 : r, lastCol);
        break;
      case 'PageDown':
        moveFocus(r + PAGE_JUMP, c);
        break;
      case 'PageUp':
        moveFocus(Math.max(0, r - PAGE_JUMP), c);
        break;
      case 'Enter':
      case 'F2': {
        const control = cell.querySelector<HTMLElement>('button, a[href], input');
        if (r === -1) {
          cell.querySelector<HTMLButtonElement>('.vl-table__sort')?.click();
        } else if (event.key === 'Enter' && cell.closest('tr')?.dataset['clickable'] !== undefined) {
          cell.closest('tr')?.click();
        } else if (control !== null) {
          control.focus();
        } else {
          return;
        }
        break;
      }
      case ' ': {
        if (r < 0) return;
        const item = model.items[r];
        if (item?.kind === 'row' && table.selectable) table.toggleRow(item.key);
        else if (item?.kind === 'group') table.toggleGroup(item.groupKey);
        else return;
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  const context: RowContext<Row> = {
    table,
    layout,
    strings,
    selected,
    expandable,
    hasMenu,
    rowMenu,
    rowHref,
    onRowNavigate,
    onRowActivate,
    onOpenDetails: rowDetails && isNarrow && rowHref === undefined && onRowActivate === undefined ? setDetailsKey : undefined,
    activeRowKey,
    focus,
    changes,
    groupRows,
    renderExpanded,
    colCount,
  };

  useIsomorphicLayoutEffect(() => {
    tableRef.current?.style.setProperty('min-inline-size', cards ? '' : `${layout.minWidth}px`);
    if (maxHeight === undefined) rootRef.current?.style.removeProperty('--vt-max-h');
    else rootRef.current?.style.setProperty('--vt-max-h', typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight);
  }, [cards, layout.minWidth, maxHeight]);

  const allSelected = model.matchedCount > 0 && state.selected.length >= model.matchedCount;
  const someSelected = state.selected.length > 0 && !allSelected;
  const scrollable = overflow.overflowX || overflow.overflowY;
  const showAbove = cards || table.activeFilters.length > 0 || state.search !== '';
  const deniedMessage = typeof noAccess === 'object' ? noAccess : {};
  let headerCol = 0;

  return (
    <div
      ref={rootRef}
      className={cx('vl-table', className)}
      data-layout={cards ? 'cards' : 'table'}
      data-density={state.density}
      data-narrow={isNarrow || undefined}
      data-own-scroll={maxHeight === undefined ? undefined : true}
      data-live={live || undefined}
    >
      {refreshError === null ? null : (
        <div className="vl-table__banner" role="alert">
          <AlertIcon />
          <span>{refreshError.title ?? strings.refreshError}</span>
          {refreshError.onRetry === undefined ? null : (
            <button type="button" className="vl-table-button vl-table-button--flat vl-table-button--xs" onClick={refreshError.onRetry}>
              {strings.retry}
            </button>
          )}
        </div>
      )}
      {partial === null ? null : (
        <div className="vl-table__banner" data-tone="info" role="status">
          <InfoIcon />
          <span>{partial.reason ?? strings.partial}</span>
        </div>
      )}
      {showAbove ? (
        <div className="vl-table__above">
          {cards ? <CardsSort table={table} strings={strings} /> : null}
          <FilterChips table={table} strings={strings} onEdit={cards ? undefined : setFilterColumn} />
        </div>
      ) : null}
      {table.groupings.length > 0 && state.groupBy !== null && !denied && !showSkeleton ? (
        <div className="vl-table__group-actions">
          <button
            type="button"
            className="vl-table-button vl-table-button--flat vl-table-button--xs"
            onClick={() => table.setAllGroupsCollapsed(state.collapsed.length === 0)}
          >
            {state.collapsed.length === 0 ? strings.collapseAll : strings.expandAll}
          </button>
        </div>
      ) : null}
      <div className="vl-table__frame">
        <span className="vl-table__shadow vl-table__shadow--start" aria-hidden="true" />
        <span className="vl-table__shadow vl-table__shadow--end" aria-hidden="true" />
        <span className="vl-table__shadow vl-table__shadow--top" aria-hidden="true" />
        <span className="vl-table__shadow vl-table__shadow--bottom" aria-hidden="true" />
        <div
          ref={scrollerRef}
          className="vl-table__scroller"
          role={scrollable ? 'region' : undefined}
          aria-label={scrollable ? ariaLabel : undefined}
          tabIndex={scrollable ? 0 : undefined}
        >
          <table
            ref={tableRef}
            className="vl-table__table"
            role="grid"
            aria-label={ariaLabel}
            aria-rowcount={itemCount + 1 + (hasTotals ? 1 : 0)}
            aria-colcount={colCount}
            aria-busy={showSkeleton || loadingMore || undefined}
            aria-multiselectable={table.selectable || undefined}
            onKeyDown={onGridKeyDown}
          >
            <colgroup>
              {table.selectable ? <col className="vl-table__col-service" /> : null}
              {expandable ? <col className="vl-table__col-service" /> : null}
              {layout.columns.map((columnLayout) => (
                <col key={columnLayout.column.id} ref={cssVars({ 'inline-size': columnLayout.grow ? null : columnLayout.width })} />
              ))}
              {hasMenu ? <col className="vl-table__col-service" /> : null}
            </colgroup>
            <thead>
              <tr className="vl-table__head-row" aria-rowindex={1}>
                {table.selectable
                  ? (() => {
                      const c = headerCol++;
                      return (
                        <ServiceCell
                          header
                          pin={PIN.start}
                          index={0}
                          role="select"
                          colIndex={c}
                          rowIndex={-1}
                          focused={focus.r === -1 && focus.c === c}
                        >
                          <Checkbox
                            checked={someSelected ? 'indeterminate' : allSelected}
                            onChange={(value) => table.selectAll(value)}
                            disabled={model.matchedCount === 0}
                            aria-label={strings.selectAll}
                          />
                        </ServiceCell>
                      );
                    })()
                  : null}
                {expandable
                  ? (() => {
                      const c = headerCol++;
                      return (
                        <ServiceCell
                          header
                          pin={PIN.start}
                          index={table.selectable ? 1 : 0}
                          role="expand"
                          colIndex={c}
                          rowIndex={-1}
                          focused={focus.r === -1 && focus.c === c}
                        />
                      );
                    })()
                  : null}
                {layout.columns.map((columnLayout) => {
                  const c = headerCol++;
                  return (
                    <HeaderCell
                      key={columnLayout.column.id}
                      table={table}
                      layout={columnLayout}
                      colIndex={c}
                      focusCol={focus.r === -1 ? focus.c : null}
                      resizable={!isNarrow}
                      tableRef={tableRef}
                      filterOpen={filterColumn === columnLayout.column.id}
                      onFilterOpenChange={(open) => setFilterColumn(open ? columnLayout.column.id : null)}
                      strings={strings}
                    />
                  );
                })}
                {hasMenu
                  ? (() => {
                      const c = headerCol++;
                      return (
                        <th
                          scope="col"
                          className="vl-table__th vl-table__service"
                          data-pin="end"
                          data-cell=""
                          data-r={-1}
                          data-c={c}
                          tabIndex={focus.r === -1 && focus.c === c ? 0 : -1}
                          aria-label={strings.actions}
                          {...pinAttrs(PIN.end, 0)}
                        />
                      );
                    })()
                  : null}
              </tr>
            </thead>
            <tbody>
              {showSkeleton ? <SkeletonRows context={context} count={SKELETON_ROWS} /> : null}
              {!showSkeleton && !denied
                ? pinnedRows?.top?.map((row, index) => <PinnedRow key={`top-${index}`} context={context} row={row} position="top" />)
                : null}
              {!showSkeleton && !denied && windowed.before > 0 ? (
                <tr className="vl-table__spacer" aria-hidden="true" ref={cssVars({ 'block-size': windowed.before })}>
                  <td colSpan={colCount} />
                </tr>
              ) : null}
              {showSkeleton || denied
                ? null
                : model.items.slice(windowed.start, windowed.end).map((item, offset) => {
                    const rowIndex = windowed.start + offset;
                    return item.kind === 'group' ? (
                      <GroupRow key={item.key} context={context} item={item} rowIndex={rowIndex} />
                    ) : (
                      <Fragment key={item.key}>
                        <BodyRow context={context} item={item} rowIndex={rowIndex} />
                      </Fragment>
                    );
                  })}
              {!showSkeleton && !denied && windowed.after > 0 ? (
                <tr className="vl-table__spacer" aria-hidden="true" ref={cssVars({ 'block-size': windowed.after })}>
                  <td colSpan={colCount} />
                </tr>
              ) : null}
              {!showSkeleton && !denied
                ? pinnedRows?.bottom?.map((row, index) => (
                    <PinnedRow key={`bottom-${index}`} context={context} row={row} position="bottom" />
                  ))
                : null}
              {loadingMore ? <SkeletonRows context={context} count={MORE_SKELETON_ROWS} /> : null}
            </tbody>
            {hasTotals && !showSkeleton && !denied && model.matchedCount > 0 ? (
              <tfoot>
                <TotalsRow context={context} label={totalsLabel ?? strings.total} />
              </tfoot>
            ) : null}
          </table>
          {table.pagination === PAGINATION.infinite ? <div ref={sentinelRef} className="vl-table__sentinel" aria-hidden="true" /> : null}
        </div>
        {loadFailed && error !== null ? (
          <StateBlock
            overlay
            tone="danger"
            icon={error.icon ?? <AlertIcon />}
            title={error.title ?? strings.loadError}
            description={error.description}
            action={error.onRetry === undefined ? error.action : { label: strings.retry, onClick: error.onRetry }}
          />
        ) : null}
        {denied ? (
          <StateBlock
            overlay
            tone="muted"
            icon={deniedMessage.icon ?? <LockIcon />}
            title={deniedMessage.title ?? strings.noAccess}
            description={deniedMessage.description ?? strings.noAccessReason}
            action={deniedMessage.action}
          />
        ) : null}
      </div>
      {isEmpty ? (
        <StateBlock
          tone="muted"
          icon={empty?.icon ?? <InboxIcon />}
          title={empty?.title ?? strings.empty}
          description={empty?.description}
          action={empty?.action}
        />
      ) : null}
      {noMatches ? (
        <StateBlock
          tone="muted"
          icon={<SearchOffIcon />}
          title={strings.noMatches}
          description={strings.noMatchesReason}
          action={{ label: strings.resetFilters, onClick: () => table.clearFilters() }}
        />
      ) : null}
      {denied || showSkeleton ? null : (
        <Pager table={table} strings={strings} hasMore={hasMore} onLoadMore={onLoadMore} loadingMore={loadingMore} />
      )}
      {table.selectable ? <SelectionBar table={table} strings={strings} bulkActions={bulkActions} /> : null}
      {rowDetails ? (
        <RowDetails table={table} rowKey={detailsKey} onClose={() => setDetailsKey(null)} strings={strings} anchor={rootRef} />
      ) : null}
    </div>
  );
}
