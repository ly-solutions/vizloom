// Bundles the plain CSS of every area into dist/*.css (resolves @import, minifies).
// JS modules never import CSS, so the library stays SSR-safe and bundler-agnostic.
import { build } from 'esbuild';
import { existsSync } from 'node:fs';

const entries = {
  styles: 'src/styles/index.css',
  core: 'src/styles/core.css',
  charts: 'src/charts/charts.css',
  table: 'src/table/table.css',
  dashboard: 'src/dashboard/dashboard.css',
};

const present = Object.fromEntries(Object.entries(entries).filter(([, path]) => existsSync(path)));

await build({
  entryPoints: present,
  bundle: true,
  minify: true,
  outdir: 'dist',
  target: ['chrome100', 'safari15.4', 'firefox100'],
  logLevel: 'warning',
});
console.log(
  `css: ${Object.keys(present)
    .map((n) => `dist/${n}.css`)
    .join(', ')}`,
);
