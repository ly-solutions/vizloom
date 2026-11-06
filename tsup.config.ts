import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core/index.ts',
    charts: 'src/charts/index.ts',
    table: 'src/table/index.ts',
    dashboard: 'src/dashboard/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { types: [] } },
  tsconfig: 'tsconfig.build.json',
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  target: 'es2020',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // Styles ship as plain CSS files built by scripts/build-css.mjs; JS never imports CSS.
  loader: { '.css': 'empty' },
});
