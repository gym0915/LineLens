import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const publicDir = join(root, 'public');
const fixturesDir = join(root, 'fixtures');
const hlsSource = join(root, 'node_modules', 'hls.js', 'dist', 'hls.min.js');

mkdirSync(dist, { recursive: true });
cpSync(publicDir, dist, { recursive: true });

if (existsSync(hlsSource)) {
  mkdirSync(join(dist, 'vendor'), { recursive: true });
  copyFileSync(hlsSource, join(dist, 'vendor', 'hls.min.js'));
}

if (existsSync(fixturesDir)) {
  cpSync(fixturesDir, join(dist, 'fixtures'), { recursive: true });
}

const entrypoints = [
  ['background/index.js', 'background.js'],
  ['background/index.js.map', 'background.js.map'],
  ['content/index.js', 'content.js'],
  ['content/index.js.map', 'content.js.map'],
  ['reader/index.js', 'reader.js'],
  ['reader/index.js.map', 'reader.js.map']
];

for (const [from, to] of entrypoints) {
  const source = join(dist, from);
  if (existsSync(source)) {
    copyFileSync(source, join(dist, to));
  }
}
