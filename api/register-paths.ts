// The backend imports modules with the tsconfig baseUrl style (`src/...`) instead of
// relative paths. TypeScript resolves those at build time, but Node cannot at runtime.
// Vercel also traces the function by following imports, and it stops at those
// specifiers, so parts of the tree are missing from the bundle unless vercel.json
// ships them (see "includeFiles": "dist/**"). This maps every `src/...` specifier
// onto whichever copy actually exists in the deployed bundle.
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';

const projectRoot = path.resolve(__dirname, '..');
const suffixes = ['', '.js', '.json', '/index.js'];

function firstExisting(tail: string): string | undefined {
  for (const base of [
    path.join(projectRoot, 'src', tail),
    path.join(projectRoot, 'dist', tail),
    path.join(projectRoot, tail),
  ]) {
    for (const suffix of suffixes) {
      if (fs.existsSync(base + suffix)) {
        return base + suffix;
      }
    }
  }
  return undefined;
}

const originalResolve = (Module as any)._resolveFilename;

(Module as any)._resolveFilename = function (request: string, ...rest: any[]) {
  if (typeof request === 'string' && request.startsWith('src/')) {
    const resolved = firstExisting(request.slice('src/'.length));
    if (resolved) {
      return originalResolve.call(this, resolved, ...rest);
    }
  }
  return originalResolve.call(this, request, ...rest);
};
