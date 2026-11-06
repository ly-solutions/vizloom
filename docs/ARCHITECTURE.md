# Architecture

vizloom is one npm package with subpath exports:

| Import                                                                           | What                                                                                                                                                                                                          | Owner  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `vizloom/core`                                                                   | time, scales, formatting (en/ru), palettes, motion, gestures, tooltip placement, tile data source, shared UI (legend, tooltip, crosshair, delta badge, live number, skeleton, block states), public contracts | core   |
| `vizloom/charts`                                                                 | every chart                                                                                                                                                                                                   | charts |
| `vizloom/table`                                                                  | headless table core + `DataTable`                                                                                                                                                                             | tables |
| `vizloom/dashboard`                                                              | KPI strip, chart card, grid, comparison helpers                                                                                                                                                               | core   |
| `vizloom`                                                                        | everything (convenience)                                                                                                                                                                                      | —      |
| `vizloom/styles.css` (or `core.css`, `charts.css`, `table.css`, `dashboard.css`) | plain CSS                                                                                                                                                                                                     | —      |

Layers depend downwards only: `dashboard → charts, table → core`. `core` never imports a chart.

```
src/
  core/
    model/      time, locale, format, scale, palette, types, aggregate, viewport, canvas (LOD)
    data/       TileSource contract, createLocalSource, useTileData (cache, abort, keep previous frame)
    motion/     easing, tween, reduced motion, rafThrottle
    gestures/   attachGestures: hover, tap, double tap, long press, drag, wheel/trackpad zoom, pinch
    positioning/placement (12 directions, adapted from Taiga UI) and chart tooltip placement
    theme/      VizProvider (locale, zone, animate), readThemeColors (CSS variables → canvas colours)
    hooks/      element size, theme colours, reduced motion, gestures, viewport, granularity, series state, tweens
    ui/         Swatch, Legend, ChartTooltip, TooltipContent, Crosshair, DeltaBadge, LiveNumber, Pulse, Skeleton, StateView, ChartDataTable
    contracts/  BlockState, chart props (BaseChartProps, TimeSeriesChartProps, CategoryChartProps, SparklineProps), table props (ColumnDef, TableState, DataTableProps)
  charts/       charts workstream
  table/        tables workstream
  dashboard/    KPI, cards, grid
  styles/       tokens.css, base.css, index.css
```

## Decisions

1. **One package with subpath exports, not a pnpm monorepo.** The parts share one design language,
   one release cadence and one version; consumers install one thing. Subpaths plus
   `"sideEffects": ["**/*.css"]` give the same tree-shaking a monorepo would. A monorepo adds
   cross-package versioning, build ordering and duplicate configs for no user benefit at this size.
   Splitting later is cheap: every area already has its own entry and CSS file.
2. **Plain CSS files, no CSS-in-JS, JS never imports CSS.** Zero runtime cost, SSR-safe, works with
   any bundler, themeable with CSS variables. Users import `vizloom/styles.css` once (or per-area
   files). Built by esbuild (`scripts/build-css.mjs`).
3. **Theme = CSS variables** (`--vl-*`). Light by default, `data-vl-theme="dark"` on any ancestor,
   `data-vl-theme="auto"` follows the OS. Canvases read resolved variables at their element
   (`useThemeColors`) and redraw when a theme attribute changes anywhere (one shared
   MutationObserver). No hard-coded colours in components.
4. **Canvas for dense series, SVG/DOM for small ones.** Time series, heatmaps and navigators draw
   on canvas with min/max LOD (peaks survive) and redraw in one rAF; donuts, bars, funnels and
   sparklines may be SVG. Every drawing is `aria-hidden` and paired with `ChartDataTable`.
5. **Time is UTC ms + a `TimeZone` offset function.** The model needs no `Intl` (tests and SSR are
   deterministic); `intlZone('Europe/Berlin')` covers DST zones; default UTC.
6. **Locale is data** (`en`, `ru`, `defineLocale`): month names, compact suffixes, every UI string.
   `VizProvider` binds locale and zone; components work without it (English, UTC).
7. **Tile source contract**: `load({ metric, granularity, range, signal }) → { start, step, length, values }`.
   `useTileData` asks only when the cached frame does not cover the window, aborts stale requests,
   debounces while the window moves and keeps the previous frame on screen (the chart morphs).
8. **One viewport object** (`Viewport`) shared by chart, navigator, markers and zoom buttons; it eases
   centre and log-width so zoom feels uniform. Reduced motion makes it instant.
9. **Gestures are framework-free** (`attachGestures`): wheel zooms (or ctrl/⌘+wheel only when
   `wheelZoom: false`), trackpad pinch arrives as ctrl+wheel, two fingers pinch-zoom and pan,
   a one-finger horizontal drag pans, vertical drags scroll the page (`touch-action: pan-y`),
   long press starts a touch scrub, tap pins a tooltip.
10. **Block states are one union** (`BlockState`): ready, loading (skeleton in the block's shape),
    empty (with a reason), no-access (lock), partial (content + notice), error (retry).
11. **Tooltips live inside the chart container** (absolute, no portal): SSR-safe, no z-index wars;
    they flip near edges and dock above the plot on narrow containers so a finger never hides them.
    Pinned tooltips become dialogs with a close button.
12. **Delta always carries arrow + sign**, colour is only the tone; `invert` for lower-is-better metrics.
13. **Build**: tsup (ESM + CJS + `.d.ts`/`.d.cts`), React and react-dom are peers (18.2+ or 19).
    Checked by `publint --strict` and `attw --profile node16`.
14. **Tooling**: TypeScript strict, ESLint 9 flat config (no `any`, no inline style objects),
    Prettier, Vitest + Testing Library + jsdom, Storybook 8 (react-vite), Changesets, GitHub Actions.
15. **Name** `vizloom`: free on npm, neutral. To rename: `package.json` `name`, README badges and
    install lines, `.storybook/manager.ts` brand. CSS prefix `vl-` is internal and need not change.
16. **Category charts are SVG/DOM, time charts are canvas.** Bars, lists, split bars, gauges, donuts and funnels
    have few marks and need focus, text and hit areas; the time engine draws thousands of points with LOD.
17. **Canvas colours accept `var(--vl-*)`.** `resolveColor` reads custom properties from the root (or a given
    scope) so series can be configured with the same token strings as the DOM components.
18. **The time engine keeps its own pointer handling** (inertia, scrub, vertical swipe yields to the page)
    instead of `attachGestures`, for parity with the reference behaviour. Both follow the same rules
    (`touch-action: pan-y`, wheel zoom only over the plot).
19. **One public name per thing.** On merge the dashboard comparison helper became `alignComparison`
    (the chart one is `alignCompare`), and the table's internal `Segmented` is not exported —
    `Segmented` from `vizloom/dashboard` is the public one.
20. **Table sparkline cell reuses `Sparkline`** from `vizloom/charts` in its compact mode — one drawing
    code path for blocks and cells.
21. **CSS entry points are excluded from `attw`** (it only checks type resolution); `publint` still
    validates them.
