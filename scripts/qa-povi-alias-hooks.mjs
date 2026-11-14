import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Resolve hook for offline QA scripts that import the real TypeScript modules.
// Maps the tsconfig "@/*" alias to the repository root, and resolves
// extensionless relative imports to their ".ts" file when one exists.
// No vote authority, no networking, no live participation: resolution only.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    let target = path.join(repoRoot, specifier.slice(2));
    if (!path.extname(target) && existsSync(target + '.ts')) target += '.ts';
    return {url: pathToFileURL(target).href, shortCircuit: true};
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const candidate = path.join(parentDir, specifier) + '.ts';
    if (existsSync(candidate)) {
      return {url: pathToFileURL(candidate).href, shortCircuit: true};
    }
  }
  return nextResolve(specifier, context);
}
