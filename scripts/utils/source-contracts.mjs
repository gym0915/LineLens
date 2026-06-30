import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readProjectFile(projectRoot, path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

export function readProjectFiles(projectRoot, paths) {
  return Object.fromEntries(paths.map(([key, path]) => [key, readProjectFile(projectRoot, path)]));
}

export function findWorkspaceRootWithFile(startDir, relativePath) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, relativePath))) {
      return current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Unable to locate workspace file ${relativePath} from ${startDir}`);
}

export function readWorkspaceFile(startDir, relativePath) {
  return readProjectFile(findWorkspaceRootWithFile(startDir, relativePath), relativePath);
}
