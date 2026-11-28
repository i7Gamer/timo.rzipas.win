import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The gateway image copies an explicit file list. A new module imported by the
 * gateway must be added to it, or the container fails at startup (only the
 * Docker smoke test in CI would notice).
 */
const root = resolve(import.meta.dirname, '../../..');
const ENTRY = 'services/ask/server.ts';
const DOCKERFILE = 'services/ask/Dockerfile';

// Static imports and re-exports; `import type` is erased at runtime.
const importPattern =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const toRepoPath = (path: string) => relative(root, path).split('\\').join('/');

function runtimeModules(entry: string) {
  const found = new Set<string>();
  const pending = [entry];
  while (pending.length) {
    const file = pending.pop()!;
    if (found.has(file)) continue;
    found.add(file);
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(join(root, file), 'utf8');
    for (const [, specifier] of source.matchAll(importPattern)) {
      if (!specifier.startsWith('.')) continue;
      pending.push(toRepoPath(resolve(root, dirname(file), specifier)));
    }
  }
  return [...found];
}

function copiedFiles() {
  const lines = readFileSync(join(root, DOCKERFILE), 'utf8')
    .replace(/\\\r?\n/g, ' ')
    .split(/\r?\n/);
  return new Set(
    lines
      .filter((line) => /^COPY\s/.test(line))
      .flatMap((line) =>
        line
          .trim()
          .split(/\s+/)
          .slice(1, -1)
          .filter((token) => !token.startsWith('--')),
      ),
  );
}

describe('Ask gateway image', () => {
  it('copies every module the gateway imports at runtime', () => {
    const copied = copiedFiles();
    const missing = runtimeModules(ENTRY).filter((file) => !copied.has(file));
    expect(missing).toEqual([]);
  });

  // The image runs the sources directly with Node's type stripping, which
  // rejects syntax that needs transpiling (Vitest transpiles, so it hides it).
  it.each(runtimeModules(ENTRY).filter((file) => file.endsWith('.ts')))(
    'runs %s without transpiling',
    (file) => {
      const source = readFileSync(join(root, file), 'utf8');
      expect(() => stripTypeScriptTypes(source)).not.toThrow();
    },
  );

  it('rejects syntax that needs transpiling', () => {
    const parameterProperty = 'class A { constructor(readonly b: number) {} }';
    expect(() => stripTypeScriptTypes(parameterProperty)).toThrow();
  });

  it('finds the gateway’s known dependencies', () => {
    const modules = runtimeModules(ENTRY);
    expect(modules).toContain('services/ask/selection.ts');
    expect(modules).toContain('src/data/ask/facts.json');
  });
});
