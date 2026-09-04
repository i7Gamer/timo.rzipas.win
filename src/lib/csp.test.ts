import { describe, expect, it } from 'vitest';

import { cspHash } from './csp';

describe('cspHash', () => {
  // Known SHA-256 vectors, base64-encoded as CSP wants them.
  it('hashes the empty string to the well-known digest', () => {
    expect(cspHash('')).toBe(
      'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
    );
  });

  it('hashes "abc" to the well-known digest', () => {
    expect(cspHash('abc')).toBe(
      'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=',
    );
  });

  it('is a source expression a browser accepts', () => {
    expect(cspHash('alert(1)')).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
  });

  it('changes with any change to the source, including non-ASCII', () => {
    expect(cspHash('a — b')).not.toBe(cspHash('a - b'));
    expect(cspHash('x')).not.toBe(cspHash('x '));
  });
});
