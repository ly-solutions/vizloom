import { useLocale } from '../theme/provider';

export interface ChartDataTableProps {
  /** Caption read before the table: usually the chart title. */
  readonly caption: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly (string | number)[])[];
  /** Visually hidden by default; `visible` shows it (a "show as table" toggle). */
  readonly visible?: boolean;
  /** Cap for very dense series: screen readers get a summary, not 10 000 rows. */
  readonly maxRows?: number;
}

/**
 * Tabular description of a chart's data for screen readers: every canvas/SVG chart renders one
 * next to its drawing (the drawing itself is `aria-hidden`).
 */
export function ChartDataTable({ caption, columns, rows, visible = false, maxRows = 200 }: ChartDataTableProps) {
  const s = useLocale().strings;
  const shown = rows.length > maxRows ? rows.slice(0, maxRows) : rows;
  return (
    <table className={visible ? 'vl-data-table-fallback' : 'vl-sr-only'}>
      <caption>
        {caption}
        {rows.length > maxRows ? ` — ${s.dataTable}: ${maxRows} / ${rows.length}` : ''}
      </caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {shown.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) =>
              j === 0 ? (
                <th key={j} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={j}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
