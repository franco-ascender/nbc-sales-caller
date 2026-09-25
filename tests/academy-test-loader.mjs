// Test-only loader: resolves app aliases and transpiles TS; production auth/services stay intact.
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (specifier.startsWith('@/')) specifier = new URL(`src/${specifier.slice(2)}`, root).href;
    if ((specifier.startsWith('.') || specifier.startsWith('file:')) && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      if (!/\.[cm]?[jt]sx?$/.test(url.pathname) && existsSync(fileURLToPath(url) + '.ts')) specifier = url.href + '.ts';
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts') && !url.includes('/node_modules/')) {
      return { format: 'module', source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
