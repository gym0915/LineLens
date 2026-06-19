import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const outfile = join(root, 'dist', 'content.js');

mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'content', 'index.ts')],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info'
});
