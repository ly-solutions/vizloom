# vizloom

React charts, data tables and dashboard blocks. Dense time series on canvas with zoom, pan and
touch gestures; a full data table; KPI strips, chart cards, a 12-column grid, block states and a
comparison mode. Themeable with CSS variables, SSR-safe, tree-shakeable, English and Russian
built in. MIT.

- **Charts** — wave/area, line, stacked and column time series with a period navigator,
  wheel/drag/pinch zoom, event markers with "before → after" effects, zones, a "now" line and
  live updates; sales pace with a "usual" band and forecast; refunds; flow with series focus;
  hour × day heatmap; funnel; donut/pie with a centre label; gauge; bar list; horizontal,
  vertical, grouped and stacked bars; sparklines; split bar.
- **Table** — sticky header and columns, scroll shadows, multi-sort, grouping with subtotals,
  expandable rows, selection, column visibility/order/resize, filters, search, pagination and
  virtualization, number/money/percent/delta/sparkline/bar/progress/status cells, totals, a
  phone layout, keyboard grid navigation, a headless core.
- **Dashboard** — `KpiStrip` (delta always under the number, live count-up and "+N"),
  `ChartCard` (title, "?" hint with a calculation card, actions, mode tabs, segments),
  `DashboardGrid` (12 columns on container queries), `StatTile`, `InsightList`,
  `ActivityFeed`, `LiveIndicator`, comparison alignment by date or by "days before".
- **Core** — time model with time zones, locale-aware formatting (numbers, money, percent, dates,
  relative time), scales, palettes with contrast tools, motion with reduced-motion, gestures,
  tooltip placement, a tile data source, legend, tooltip, crosshair, delta badge, live number,
  pulse, skeletons and the five block states (loading, empty, no access, partial, error).

## Install

```bash
npm install vizloom        # or: pnpm add vizloom / yarn add vizloom
```

Peer dependencies: `react` and `react-dom` 18.2+ or 19.

## Quick start

```tsx
import 'vizloom/styles.css';
import { VizProvider, currencyUnit, UNIT_COUNT } from 'vizloom/core';
import { ChartCard, DashboardGrid, KpiStrip } from 'vizloom/dashboard';

export function Overview() {
  return (
    <VizProvider locale="en">
      <DashboardGrid>
        <KpiStrip
          items={[
            { id: 'revenue', label: 'Revenue', value: 117763, unit: currencyUnit('USD'), delta: 9 },
            { id: 'tickets', label: 'Tickets sold', value: 2874, unit: UNIT_COUNT, delta: 18 },
          ]}
        />
        <ChartCard title="Sales by day" span={8} info="Tickets sold per day">
          {/* any chart from 'vizloom/charts' */}
        </ChartCard>
      </DashboardGrid>
    </VizProvider>
  );
}
```

Dark theme: put `data-vl-theme="dark"` on any ancestor (or `"auto"` to follow the OS). Brand
colours: override `--vl-*` variables — see _Guides / Theming_ in Storybook.

## Imports

| Subpath              | Use for                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `vizloom/core`       | formatting, time, palettes, data source, shared UI, contracts          |
| `vizloom/charts`     | charts                                                                 |
| `vizloom/table`      | `DataTable` and the headless table                                     |
| `vizloom/dashboard`  | KPI, cards, grid, tiles, feed                                          |
| `vizloom`            | everything                                                             |
| `vizloom/styles.css` | all styles (or `core.css`, `charts.css`, `table.css`, `dashboard.css`) |

## Components

| Group                           | Components                                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time series (`vizloom/charts`)  | `TimeSeriesChart` and presets `AreaChart`, `LineChart`, `StackedAreaChart`, `TimeColumnChart`; `Navigator`, `ZoomControls`. Tile sources, zoom and pan, live mode, markers, zones, comparison                                                 |
| Categories (`vizloom/charts`)   | `BarChart` (vertical / horizontal, grouped / stacked / percent), `BarList`, `SplitBar`, `Gauge`, `Sparkline`, `DonutChart` (ring, pie, semi), `FunnelChart`, `HeatmapChart` (weekday × hour)                                                  |
| Business (`vizloom/charts`)     | `PaceChart` (sell-out pace), `RefundsChart`, `FlowChart` (entry flow with series cards)                                                                                                                                                       |
| Table (`vizloom/table`)         | `DataTable`, headless `useDataTable`, `DataTableToolbar`, filter and settings panels; cells `StatusCell`, `DeltaCell`, `BarCell`, `ProgressCell`, `SparklineCell`, `AvatarCell`, `LinkCell`, `TwoLineCell`, `PillCell`, `DotCell`; CSV export |
| Dashboard (`vizloom/dashboard`) | `KpiStrip`, `Kpi`, `ChartCard`, `DashboardGrid`, `StatTile`, `TileRow`, `InsightList`, `ActivityFeed`, `LiveIndicator`, `Segmented`, `Tabs`, `InfoHint`, comparison helpers                                                                   |
| Core (`vizloom/core`)           | `VizProvider` (locale, time zone, motion), formatters, scales, palette, tile-source contract and `useTileData`, `Viewport`, gestures, `Legend`, `ChartTooltip`, `DeltaBadge`, `LiveNumber`, `StateView`, `ChartDataTable`                     |

## Storybook

Every component and variation (themes, phone viewports, loading/empty/error, live data,
comparison) is in Storybook, together with guides and recipes.

```bash
pnpm install
pnpm storybook                 # dev server on http://127.0.0.1:6106
pnpm build-storybook           # static site in storybook-static/
python3 -m http.server 6106 --bind 127.0.0.1 --directory storybook-static
```

The CI workflow also deploys the static Storybook to GitHub Pages on every push to `main`.

## Development

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm check:package             # publint + are-the-types-wrong
```

## Publish

### To GitHub (first time)

```bash
gh repo create ly-solutions/vizloom --public --source=. --remote=origin --push
```

(or create an empty repository on github.com and run `git remote add origin git@github.com:ly-solutions/vizloom.git && git push -u origin main`).
Then in the repository settings: _Pages → Source: GitHub Actions_ (Storybook site) and
_Secrets → Actions → `NPM_TOKEN`_ (an npm automation token).

### To npm

One command from a clean `main`:

```bash
npm login && pnpm release      # verify (typecheck, lint, tests, build, publint, attw) + publish
```

Or let CI do it: run `pnpm changeset`, commit, push — the _Release_ workflow opens a
"Version packages" PR; merging it publishes to npm with provenance. Pushing a tag `v0.1.0` that
matches `package.json` also publishes.

### Renaming the package

The name `vizloom` was free on npm at the time of writing. To rename: change `name` in
`package.json`, the import paths in this README and `docs/`, and the brand in
`.storybook/manager.ts`. CSS classes and variables (`vl-`, `--vl-`) do not depend on the name.

## Browser support

Evergreen browsers and Safari 15.4+ (container queries need Safari 16+, older browsers get the
single-column layout).

## License

MIT © Sergey Chernyshev. Adapted parts are listed in [NOTICE.md](NOTICE.md).
