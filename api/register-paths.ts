// The backend imports modules with the tsconfig baseUrl style (`src/...`) instead of
// relative paths. TypeScript resolves those at build time, but Node cannot at runtime,
// which crashes the Vercel function on boot. This maps every `src/...` specifier onto
// the deployed project root before the Nest application (and its entities) is loaded.
import path from 'node:path';
import Module from 'node:module';

const projectRoot = path.resolve(__dirname, '..');
const originalResolve = (Module as any)._resolveFilename;

(Module as any)._resolveFilename = function (request: string, ...rest: any[]) {
  if (typeof request === 'string' && request.startsWith('src/')) {
    return originalResolve.call(this, path.join(projectRoot, request), ...rest);
  }
  return originalResolve.call(this, request, ...rest);
};
