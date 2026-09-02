import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Node major is deliberately bumped by hand (.github/dependabot.yml
 * ignores node majors) so the image never ships on a runtime the tests did
 * not run on. Nothing enforced that pairing, so these do.
 */
const ROOT = join(import.meta.dirname, '..');

function read(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8');
}

/** The Node major the repo pins for local work and CI. */
function nvmrcMajor(): string {
  return read('.nvmrc').trim().replace(/^v/, '').split('.')[0];
}

/** The Node major the production image builds on (the FROM may carry a --platform flag). */
function dockerfileMajor(): string | undefined {
  return /^FROM (?:--platform=\S+ )?node:(\d+)[.-]/m.exec(
    read('Dockerfile'),
  )?.[1];
}

describe('Node version', () => {
  it('is a bare major in .nvmrc', () => {
    expect(nvmrcMajor()).toMatch(/^\d+$/);
  });

  it('is the same in .nvmrc and the Dockerfile', () => {
    expect(dockerfileMajor(), 'Dockerfile FROM node:<major>').toBe(
      nvmrcMajor(),
    );
  });

  // Otherwise CI could drift away from both of the above.
  it('reaches CI from .nvmrc rather than a second literal', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain("node-version-file: '.nvmrc'");
    expect(ci).not.toMatch(/node-version:\s*['"]?\d/);
  });
});
