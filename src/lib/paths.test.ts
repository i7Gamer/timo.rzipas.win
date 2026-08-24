import { describe, expect, it } from 'vitest';

import { isActivePath, normalizePath } from './paths';

describe('normalizePath', () => {
  it('strips trailing slashes', () => {
    expect(normalizePath('/projects/')).toBe('/projects');
    expect(normalizePath('/projects///')).toBe('/projects');
  });

  it('keeps the root path as a single slash', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });

  it('leaves paths without trailing slash untouched', () => {
    expect(normalizePath('/about')).toBe('/about');
  });
});

describe('isActivePath', () => {
  it('matches identical routes regardless of trailing slash', () => {
    expect(isActivePath('/projects/', '/projects')).toBe(true);
    expect(isActivePath('/projects', '/projects/')).toBe(true);
    expect(isActivePath('/', '/')).toBe(true);
  });

  it('does not match different routes', () => {
    expect(isActivePath('/projects', '/homelab')).toBe(false);
    expect(isActivePath('/projects', '/')).toBe(false);
    expect(isActivePath('/', '/projects')).toBe(false);
  });
});
