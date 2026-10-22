import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    let candidate;
    if (specifier.startsWith('@/')) candidate = new URL(specifier.slice(2), root);
    else if (specifier.startsWith('.') && context.parentURL) candidate = new URL(specifier, context.parentURL);
    if (candidate?.protocol === 'file:' && existsSync(`${fileURLToPath(candidate)}.ts`)) {
      return nextResolve(pathToFileURL(`${fileURLToPath(candidate)}.ts`).href, context);
    }
    return nextResolve(specifier, context);
  },
});
