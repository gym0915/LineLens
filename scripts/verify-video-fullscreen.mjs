import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(new URL('..', import.meta.url).pathname);
const mediaCss = readFileSync(resolve(workspaceRoot, 'public/styles/media.css'), 'utf8');
const fixture = readFileSync(
  '/Users/steve/.codex/attachments/24bc1be8-9c9a-4377-9230-e62e6131bd83/pasted-text.txt',
  'utf8'
);

assert.match(
  fixture,
  /padding-bottom:\s*177\.295%/,
  'fixture should expose a portrait tweet video aspect ratio from the source DOM'
);
assert.match(
  fixture,
  /<video[\s\S]*object-fit:\s*contain;/,
  'fixture should show X rendering the portrait video with object-fit: contain'
);
assert.match(
  mediaCss,
  /\.reader-video-player:fullscreen,\s*[\s\S]*?object-fit:\s*contain;/,
  'fullscreen video should preserve the full frame with object-fit contain'
);
assert.match(
  mediaCss,
  /\.reader-video-player:fullscreen,\s*[\s\S]*?object-position:\s*center;/,
  'fullscreen video should stay centered instead of stretching to one side'
);

console.log('Fullscreen video verification passed.');
