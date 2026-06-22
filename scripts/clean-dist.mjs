import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const distDir = resolve(projectRoot, 'dist');

if (!distDir.startsWith(projectRoot)) {
  throw new Error(`Refusing to remove dist outside project root: ${distDir}`);
}

rmSync(distDir, { recursive: true, force: true });
