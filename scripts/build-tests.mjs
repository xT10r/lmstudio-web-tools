import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  packages: 'external',
};

await build({ ...common, entryPoints: ['src/index.ts'], outfile: '.lmstudio/check.cjs' });
await build({ ...common, entryPoints: ['src/searchProviders.ts'], outfile: '.lmstudio/searchProviders.cjs' });
await build({
  ...common,
  entryPoints: ['src/index.ts'],
  alias: { 'got-scraping': './tests/mock-got.cjs' },
  outfile: '.lmstudio/website-check.cjs',
});

await build({ ...common, entryPoints: ['src/diagnostics.ts'], outfile: '.lmstudio/diagnostics.cjs' });
