import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { filterKindOf, isHideable } from '../core/columns';
import { formatCell, formatCount, formatDate, normalizeSearch } from '../core/format';
import { countValues, emptyFilter, isFilterActive } from '../core/pipeline';
import { tableStringsFor, type TableStrings } from '../core/strings';
import { useLocale } from '../../core/theme/provider';
import {
  COLUMN_TYPE,
  DENSITY,
  FILTER_KIND,
  type ColumnDef,
  type DateRangeFilter,
  type FilterValue,
  type Pin,
  type RangeFilter,
  type SelectFilter,
  type TextFilter,
} from '../core/types';
import { parseDay } from '../core/values';
import {
  Checkbox,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DotsIcon,
  DownloadIcon,
  FilterIcon,
  GripIcon,
  Menu,
  PinIcon,
  Popover,
  SearchIcon,
  Segmented,
  SlidersIcon,
  type MenuEntry,
} from './overlay';
import type { DataTableInstance } from './use-data-table';

/** A select filter gets its own search box from this many options. */
const SELECT_SEARCH_FROM = 8;
const DAY_MS = 86_400_000;

function parseNumber(text: string): number | null {
  const normalized = text.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function dayString(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function NumberField({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number | null;
  unit: string | null;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  return (
    <label className="vl-table-field">
      <span className="vl-table-field__label">{label}</span>
      <span className="vl-table-field__control">
        <input
          className="vl-table-field__input"
          inputMode="decimal"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onChange(parseNumber(event.target.value));
          }}
        />
        {unit === null ? null : <span className="vl-table-field__unit">{unit}</span>}
      </span>
    </label>
  );
}

function unitOf<Row>(column: ColumnDef<Row>, currencySymbol: string): string | null {
  if (column.type === COLUMN_TYPE.money) return currencySymbol;
  if (column.type === COLUMN_TYPE.percent) return '%';
  return null;
}

function currencySymbolOf(locale: string, currency: string): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((item) => item.type === 'currency');
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

function RangeEditor<Row>({ table, column, filter, onChange, strings }: EditorProps<Row, RangeFilter>) {
  const unit = unitOf(column, currencySymbolOf(table.format.locale, column.currency ?? table.format.currency));
  return (
    <div className="vl-table-filter__range">
      <NumberField label={strings.from} value={filter.min} unit={unit} onChange={(min) => onChange({ ...filter, min })} />
      <NumberField label={strings.to} value={filter.max} unit={unit} onChange={(max) => onChange({ ...filter, max })} />
    </div>
  );
}

function SelectEditor<Row>({ table, column, filter, onChange, strings }: EditorProps<Row, SelectFilter>) {
  const [query, setQuery] = useState('');
  const counts = useMemo(() => countValues(table.rows, column), [table.rows, column]);
  const options = useMemo(
    () =>
      column.options !== undefined
        ? column.options.map((option) => ({ value: option.value, label: option.label }))
        : [...counts.keys()]
            .sort((a, b) => a.localeCompare(b, table.format.locale))
            .map((value) => ({ value, label: formatCell(column, value, table.format) })),
    [column, counts, table.format],
  );
  const needle = normalizeSearch(query.trim());
  const shown = needle === '' ? options : options.filter((option) => normalizeSearch(option.label).includes(needle));
  const toggle = (value: string, checked: boolean) =>
    onChange({ ...filter, values: checked ? [...filter.values, value] : filter.values.filter((item) => item !== value) });
  return (
    <div className="vl-table-filter__select">
      {options.length >= SELECT_SEARCH_FROM ? (
        <SearchField value={query} onChange={setQuery} placeholder={strings.find} clearLabel={strings.searchClear} autoFocus />
      ) : null}
      <ul className="vl-table-filter__options">
        {shown.map((option) => (
          <li key={option.value} className="vl-table-filter__option">
            <Checkbox
              checked={filter.values.includes(option.value)}
              onChange={(checked) => toggle(option.value, checked)}
              label={option.label}
            />
            <span className="vl-table-filter__count">{formatCount(counts.get(option.value) ?? 0, table.format.locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextEditor<Row>({ filter, onChange, strings }: EditorProps<Row, TextFilter>) {
  return (
    <SearchField
      value={filter.query}
      onChange={(query) => onChange({ ...filter, query })}
      placeholder={strings.contains}
      clearLabel={strings.searchClear}
      autoFocus
    />
  );
}

function DatesEditor<Row>({ filter, onChange, strings }: EditorProps<Row, DateRangeFilter>) {
  const today = dayString(Date.now());
  return (
    <div className="vl-table-filter__dates">
      <div className="vl-table-filter__presets">
        {strings.datePresets.map((preset) => {
          const from = dayString(Date.now() - preset.days * DAY_MS);
          const active = filter.from === from && filter.to === today;
          return (
            <button
              key={preset.label}
              type="button"
              className="vl-table-chip-button"
              aria-pressed={active}
              onClick={() => onChange({ ...filter, from, to: today })}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="vl-table-filter__range">
        <label className="vl-table-field">
          <span className="vl-table-field__label">{strings.since}</span>
          <input
            className="vl-table-field__input"
            type="date"
            value={filter.from ?? ''}
            onChange={(event) => onChange({ ...filter, from: parseDay(event.target.value) === null ? null : event.target.value })}
          />
        </label>
        <label className="vl-table-field">
          <span className="vl-table-field__label">{strings.until}</span>
          <input
            className="vl-table-field__input"
            type="date"
            value={filter.to ?? ''}
            onChange={(event) => onChange({ ...filter, to: parseDay(event.target.value) === null ? null : event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

interface EditorProps<Row, Filter extends FilterValue> {
  table: DataTableInstance<Row>;
  column: ColumnDef<Row>;
  filter: Filter;
  onChange: (filter: FilterValue) => void;
  strings: TableStrings;
}

function FilterEditor<Row>({ table, column, strings }: { table: DataTableInstance<Row>; column: ColumnDef<Row>; strings: TableStrings }) {
  const kind = filterKindOf(column);
  if (kind === null) return null;
  const current = table.state.filters[column.id];
  const filter = current !== undefined && current.kind === kind ? current : emptyFilter(kind);
  const onChange = (next: FilterValue) => table.setFilter(column.id, next);
  switch (filter.kind) {
    case FILTER_KIND.range:
      return <RangeEditor table={table} column={column} filter={filter} onChange={onChange} strings={strings} />;
    case FILTER_KIND.select:
      return <SelectEditor table={table} column={column} filter={filter} onChange={onChange} strings={strings} />;
    case FILTER_KIND.text:
      return <TextEditor table={table} column={column} filter={filter} onChange={onChange} strings={strings} />;
    case FILTER_KIND.dateRange:
      return <DatesEditor table={table} column={column} filter={filter} onChange={onChange} strings={strings} />;
  }
}

/** Short human text of a filter: `1 000–5 000 ₽`, `Paid and 2 more`, `«vip»`, `5 Oct – 12 Oct`. */
export function describeFilter<Row>(
  column: ColumnDef<Row>,
  filter: FilterValue,
  table: DataTableInstance<Row>,
  strings: TableStrings,
): string {
  if (!isFilterActive(filter)) return '';
  switch (filter.kind) {
    case FILTER_KIND.range: {
      const show = (value: number) => formatCell(column, value, table.format);
      if (filter.min !== null && filter.max !== null) return `${show(filter.min)} – ${show(filter.max)}`;
      return filter.min !== null ? strings.rangeFrom(show(filter.min)) : strings.rangeTo(show(filter.max ?? 0));
    }
    case FILTER_KIND.select: {
      const labels = filter.values.map((value) => column.options?.find((option) => option.value === value)?.label ?? value);
      return labels.length <= 2 ? labels.join(', ') : strings.andMore(labels[0] ?? '', labels.length - 1);
    }
    case FILTER_KIND.text:
      return `«${filter.query.trim()}»`;
    case FILTER_KIND.dateRange: {
      const show = (day: string) => {
        const parsed = parseDay(day);
        return parsed === null ? day : formatDate(new Date(parsed.year, parsed.month, parsed.day).getTime(), false, table.format);
      };
      if (filter.from !== null && filter.to !== null) return `${show(filter.from)} – ${show(filter.to)}`;
      return filter.from !== null ? `${strings.since} ${show(filter.from)}` : `${strings.until} ${show(filter.to ?? '')}`;
    }
  }
}

/** One column's filter: header, editor, reset and done. */
export function ColumnFilterPanel<Row>({
  table,
  column,
  strings,
  onDone,
  onBack,
}: {
  table: DataTableInstance<Row>;
  column: ColumnDef<Row>;
  strings: TableStrings;
  onDone: () => void;
  onBack?: () => void;
}) {
  const current = table.state.filters[column.id];
  const active = current !== undefined && isFilterActive(current);
  const locale = table.format.locale;
  return (
    <div className="vl-table-filter">
      <header className="vl-table-filter__header">
        {onBack === undefined ? null : (
          <button type="button" className="vl-table-icon-button" aria-label={strings.backToFilters} onClick={onBack}>
            <ChevronLeftIcon />
          </button>
        )}
        <span className="vl-table-filter__title">{column.title}</span>
        <span className="vl-table-filter__matched">
          {strings.matchedOf(formatCount(table.model.matchedCount, locale), formatCount(table.model.totalCount, locale))}
        </span>
      </header>
      <FilterEditor table={table} column={column} strings={strings} />
      <footer className="vl-table-filter__footer">
        <button
          type="button"
          className="vl-table-button vl-table-button--flat"
          disabled={!active}
          onClick={() => table.setFilter(column.id, null)}
        >
          {strings.reset}
        </button>
        <button type="button" className="vl-table-button" onClick={onDone}>
          {strings.done}
        </button>
      </footer>
    </div>
  );
}

/** All filters as a list; a row opens that column's editor. */
export function FiltersPanel<Row>({
  table,
  strings,
  onClose,
  initialColumnId = null,
}: {
  table: DataTableInstance<Row>;
  strings: TableStrings;
  onClose: () => void;
  initialColumnId?: string | null;
}) {
  const [columnId, setColumnId] = useState<string | null>(initialColumnId);
  const filterable = table.ordered.filter((column) => filterKindOf(column) !== null);
  const opened = filterable.find((column) => column.id === columnId);
  if (opened !== undefined) {
    return <ColumnFilterPanel table={table} column={opened} strings={strings} onDone={onClose} onBack={() => setColumnId(null)} />;
  }
  return (
    <div className="vl-table-filter">
      <ul className="vl-table-filter__list">
        {filterable.map((column) => {
          const filter = table.state.filters[column.id];
          const active = filter !== undefined && isFilterActive(filter);
          return (
            <li key={column.id}>
              <button
                type="button"
                className="vl-table-filter__item"
                data-active={active || undefined}
                onClick={() => setColumnId(column.id)}
              >
                <span className="vl-table-filter__item-title">{column.title}</span>
                <span className="vl-table-filter__item-value">
                  {active && filter !== undefined ? describeFilter(column, filter, table, strings) : strings.any}
                </span>
                <ChevronRightIcon />
              </button>
            </li>
          );
        })}
      </ul>
      {table.activeFilters.length > 0 ? (
        <footer className="vl-table-filter__footer">
          <button type="button" className="vl-table-button vl-table-button--flat" onClick={() => table.clearFilters()}>
            {strings.resetAll}
          </button>
        </footer>
      ) : null}
    </div>
  );
}

/** Removable chips of the search and every active filter, plus "Reset". */
export function FilterChips<Row>({
  table,
  strings,
  onEdit,
}: {
  table: DataTableInstance<Row>;
  strings: TableStrings;
  onEdit?: (columnId: string) => void;
}) {
  const query = table.state.search.trim();
  if (table.activeFilters.length === 0 && query === '') return null;
  return (
    <div className="vl-table__chips" role="group" aria-label={strings.activeFilters}>
      {query === '' ? null : (
        <span className="vl-table-chip">
          <span className="vl-table-chip__label">{strings.searchChip(query)}</span>
          <button type="button" className="vl-table-chip__remove" aria-label={strings.removeSearch} onClick={() => table.setSearch('')}>
            <CloseIcon />
          </button>
        </span>
      )}
      {table.activeFilters.map(({ column, filter }) => (
        <span key={column.id} className="vl-table-chip">
          {onEdit === undefined ? (
            <span className="vl-table-chip__label">{`${column.title}: ${describeFilter(column, filter, table, strings)}`}</span>
          ) : (
            <button type="button" className="vl-table-chip__label vl-table-chip__label--button" onClick={() => onEdit(column.id)}>
              {`${column.title}: ${describeFilter(column, filter, table, strings)}`}
            </button>
          )}
          <button
            type="button"
            className="vl-table-chip__remove"
            aria-label={strings.removeFilter(column.title)}
            onClick={() => table.setFilter(column.id, null)}
          >
            <CloseIcon />
          </button>
        </span>
      ))}
      <button type="button" className="vl-table-button vl-table-button--flat vl-table-button--xs" onClick={() => table.clearFilters()}>
        {strings.reset}
      </button>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
  clearLabel,
  autoFocus,
  onBlur,
  onKeyDown,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <span className={`vl-table-search${className === undefined ? '' : ` ${className}`}`}>
      <SearchIcon />
      <input
        className="vl-table-search__input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        data-autofocus={autoFocus ? '' : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      {value === '' ? null : (
        <button
          type="button"
          className="vl-table-search__clear"
          aria-label={clearLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange('')}
        >
          <CloseIcon />
        </button>
      )}
    </span>
  );
}

// ---------- settings ----------

function PinPicker<Row>({ table, column, strings }: { table: DataTableInstance<Row>; column: ColumnDef<Row>; strings: TableStrings }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const pin = table.pinOf(column);
  const choose = (next: Pin | null) => () => table.setPin(column.id, next);
  const items: MenuEntry[] = [
    { id: 'none', label: strings.pinNone, checked: pin === null, onSelect: choose(null) },
    { id: 'start', label: strings.pinStart, checked: pin === 'start', onSelect: choose('start') },
    { id: 'end', label: strings.pinEnd, checked: pin === 'end', onSelect: choose('end') },
  ];
  const current = pin === null ? strings.pinNone : pin === 'start' ? strings.pinStart : strings.pinEnd;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="vl-table-icon-button vl-table-settings__pin"
        data-pinned={pin ?? undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${strings.pinColumn(column.title)}: ${current}`}
        onClick={() => setOpen(!open)}
      >
        <PinIcon />
      </button>
      <Menu open={open} onOpenChange={setOpen} anchor={anchor} label={strings.pinColumn(column.title)} items={items} />
    </>
  );
}

/**
 * Column list with drag handles. The dragged row follows the pointer with a transform and the others
 * slide aside; the order is committed on release. Rows are not reordered in the DOM mid-drag: moving a
 * node that holds pointer capture drops the capture and the drag would stall. ↑/↓ on the handle moves
 * a column for keyboard users.
 */
interface ColumnDrag {
  readonly id: string;
  readonly from: number;
  readonly startY: number;
  /** Vertical middles of the rows when the drag started. */
  readonly mids: readonly number[];
  /** Height of the dragged row, the distance the others move aside. */
  readonly size: number;
  dy: number;
  to: number;
}

function ColumnList<Row>({ table, strings }: { table: DataTableInstance<Row>; strings: TableStrings }) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [drag, setDrag] = useState<ColumnDrag | null>(null);
  const ids = table.ordered.map((column) => column.id);

  const reorder = (id: string, to: number) => {
    const from = ids.indexOf(id);
    if (from === -1 || to < 0 || to >= ids.length || to === from) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, id);
    table.setOrder(next);
  };

  const onPointerDown = (id: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || listRef.current === null) return;
    event.preventDefault();
    const rows = Array.from(listRef.current.children) as HTMLElement[];
    const rects = rows.map((row) => row.getBoundingClientRect());
    const from = ids.indexOf(id);
    const state: ColumnDrag = {
      id,
      from,
      startY: event.clientY,
      mids: rects.map((rect) => rect.top + rect.height / 2),
      size: rects[from]?.height ?? 36,
      dy: 0,
      to: from,
    };
    const move = (e: PointerEvent) => {
      const dy = e.clientY - state.startY;
      const centre = state.mids[state.from] + dy;
      let to = state.from;
      while (to < state.mids.length - 1 && centre > state.mids[to + 1]) to += 1;
      while (to > 0 && centre < state.mids[to - 1]) to -= 1;
      setDrag({ ...state, dy, to });
      state.dy = dy;
      state.to = to;
    };
    const stop = (commit: boolean) => () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setDrag(null);
      if (commit) reorder(id, state.to);
    };
    const up = stop(true);
    const cancel = stop(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    setDrag(state);
  };

  const shiftOf = (index: number): number => {
    if (drag === null) return 0;
    if (index === drag.from) return drag.dy;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -drag.size;
    if (drag.from > drag.to && index >= drag.to && index < drag.from) return drag.size;
    return 0;
  };

  return (
    <ul ref={listRef} className="vl-table-settings__columns" data-sorting={drag !== null || undefined}>
      {table.ordered.map((column, index) => {
        const hidden = table.state.hidden.includes(column.id);
        const shift = shiftOf(index);
        return (
          <li
            key={column.id}
            className="vl-table-settings__column"
            data-dragging={drag?.id === column.id || undefined}
            style={shift === 0 ? undefined : { transform: `translateY(${shift}px)` }}
          >
            <button
              type="button"
              className="vl-table-settings__handle"
              aria-label={strings.moveColumn(column.title)}
              onPointerDown={onPointerDown(column.id)}
              onKeyDown={(event) => {
                const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
                if (step === 0) return;
                event.preventDefault();
                const handle = event.currentTarget;
                reorder(column.id, index + step);
                // Keep focus on the moved handle after React reorders the list.
                requestAnimationFrame(() => handle.focus());
              }}
            >
              <GripIcon />
            </button>
            <Checkbox
              checked={!hidden || !isHideable(column)}
              disabled={!isHideable(column)}
              onChange={(checked) => table.setHidden(column.id, !checked)}
              label={column.title}
            />
            <PinPicker table={table} column={column} strings={strings} />
          </li>
        );
      })}
    </ul>
  );
}

const NO_GROUP = '__none__';

export function SettingsPanel<Row>({ table, strings }: { table: DataTableInstance<Row>; strings: TableStrings }) {
  return (
    <div className="vl-table-settings">
      <section className="vl-table-settings__section">
        <h3 className="vl-table-settings__title">{strings.columns}</h3>
        <ColumnList table={table} strings={strings} />
      </section>
      {table.groupings.length > 0 ? (
        <section className="vl-table-settings__section">
          <h3 className="vl-table-settings__title">{strings.grouping}</h3>
          <Segmented
            label={strings.grouping}
            value={table.state.groupBy ?? NO_GROUP}
            onChange={(value) => table.setGroupBy(value === NO_GROUP ? null : value)}
            options={[
              { value: NO_GROUP, label: strings.noGrouping },
              ...table.groupings.map((grouping) => ({ value: grouping.id, label: grouping.label })),
            ]}
          />
        </section>
      ) : null}
      <section className="vl-table-settings__section">
        <h3 className="vl-table-settings__title">{strings.density}</h3>
        <Segmented
          label={strings.density}
          value={table.state.density}
          onChange={(density) => table.setDensity(density)}
          options={[
            { value: DENSITY.regular, label: strings.densityRegular },
            { value: DENSITY.compact, label: strings.densityCompact },
          ]}
        />
      </section>
      {table.viewToggles.length > 0 ? (
        <section className="vl-table-settings__section">
          <h3 className="vl-table-settings__title">{strings.view}</h3>
          {table.viewToggles.map((toggle) => (
            <label key={toggle.id} className="vl-table-settings__toggle">
              <span className="vl-table-settings__toggle-text">
                <span>{toggle.label}</span>
                {toggle.description === undefined ? null : <span className="vl-table-settings__toggle-hint">{toggle.description}</span>}
              </span>
              <input
                type="checkbox"
                role="switch"
                className="vl-table-switch"
                checked={table.state.view[toggle.id] ?? false}
                onChange={(event) => table.setView(toggle.id, event.target.checked)}
              />
            </label>
          ))}
        </section>
      ) : null}
      {table.customized ? (
        <footer className="vl-table-settings__footer">
          <button type="button" className="vl-table-button vl-table-button--flat" onClick={() => table.resetSettings()}>
            {strings.resetSettings}
          </button>
        </footer>
      ) : null}
    </div>
  );
}

// ---------- toolbar ----------

export const EXPORT_FORMAT = { csv: 'csv', xlsx: 'xlsx' } as const;
export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];

export interface DataTableToolbarProps<Row> {
  table: DataTableInstance<Row>;
  search?: boolean;
  searchPlaceholder?: string;
  filters?: boolean;
  settings?: boolean;
  exportFormats?: readonly ExportFormat[];
  onExport?: (format: ExportFormat) => void;
  /** Extra items of the "More" menu. */
  menu?: readonly MenuEntry[];
  /** Overrides of the built-in texts; the rest follow the `VizProvider` locale. */
  strings?: Partial<TableStrings>;
  children?: ReactNode;
}

function ToolbarSearch<Row>({
  table,
  placeholder,
  strings,
}: {
  table: DataTableInstance<Row>;
  placeholder: string;
  strings: TableStrings;
}) {
  const [open, setOpen] = useState(false);
  if (!open && table.state.search === '') {
    return (
      <button
        type="button"
        className="vl-table-icon-button vl-table-icon-button--m"
        aria-label={strings.search}
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
      </button>
    );
  }
  return (
    <SearchField
      className="vl-table-toolbar__search"
      value={table.state.search}
      onChange={(search) => table.setSearch(search)}
      placeholder={placeholder}
      clearLabel={strings.searchClear}
      autoFocus={open}
      onBlur={() => {
        if (table.state.search === '') setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          table.setSearch('');
          setOpen(false);
        }
      }}
    />
  );
}

function ToolbarPanel({
  icon,
  label,
  ariaLabel,
  title,
  count,
  customized,
  children,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  title: string;
  count?: number;
  customized?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="vl-table-toolbar__button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-active={(count !== undefined && count > 0) || customized || undefined}
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span className="vl-table-toolbar__label">{label}</span>
        {count !== undefined && count > 0 ? <span className="vl-table-toolbar__count">{count}</span> : null}
      </button>
      <Popover open={open} onOpenChange={setOpen} anchor={anchor} align="end" label={title} sheetTitle={title} className="vl-table-panel">
        {children(() => setOpen(false))}
      </Popover>
    </>
  );
}

/** Search, filters, settings and export for a `DataTable`; place it in the card header. */
export function DataTableToolbar<Row>({
  table,
  search = false,
  searchPlaceholder,
  filters = false,
  settings = false,
  exportFormats = [],
  onExport,
  menu = [],
  strings: stringsOverride,
  children,
}: DataTableToolbarProps<Row>) {
  const locale = useLocale();
  const strings = useMemo<TableStrings>(() => ({ ...tableStringsFor(locale.code), ...stringsOverride }), [locale.code, stringsOverride]);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreAnchor = useRef<HTMLButtonElement | null>(null);
  const hasFilters = filters && table.columns.some((column) => filterKindOf(column) !== null);
  const exportItems: MenuEntry[] = exportFormats.map((format) => ({
    id: `export-${format}`,
    label: format === EXPORT_FORMAT.csv ? strings.exportCsv : strings.exportXlsx,
    icon: <DownloadIcon />,
    disabled: onExport === undefined,
    onSelect: () => onExport?.(format),
  }));
  const moreItems: MenuEntry[] = [...exportItems, ...(exportItems.length > 0 && menu.length > 0 ? (['separator'] as const) : []), ...menu];
  const filterCount = table.activeFilters.length;
  return (
    <div className="vl-table-toolbar">
      {children}
      {search ? <ToolbarSearch table={table} placeholder={searchPlaceholder ?? strings.search} strings={strings} /> : null}
      {hasFilters ? (
        <ToolbarPanel
          icon={<FilterIcon />}
          label={strings.filters}
          ariaLabel={filterCount > 0 ? strings.filtersCount(filterCount) : strings.filters}
          title={strings.filters}
          count={filterCount}
        >
          {(close) => <FiltersPanel table={table} strings={strings} onClose={close} />}
        </ToolbarPanel>
      ) : null}
      {settings ? (
        <ToolbarPanel
          icon={<SlidersIcon />}
          label={strings.settings}
          ariaLabel={strings.settingsTitle}
          title={strings.settingsTitle}
          customized={table.customized}
        >
          {() => <SettingsPanel table={table} strings={strings} />}
        </ToolbarPanel>
      ) : null}
      {moreItems.length > 0 ? (
        <>
          <button
            ref={moreAnchor}
            type="button"
            className="vl-table-icon-button vl-table-icon-button--m"
            aria-label={strings.more}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            <DotsIcon />
          </button>
          <Menu open={moreOpen} onOpenChange={setMoreOpen} anchor={moreAnchor} label={strings.more} items={moreItems} />
        </>
      ) : null}
    </div>
  );
}
