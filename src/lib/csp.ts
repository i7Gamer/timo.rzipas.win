import { createHash } from 'node:crypto';

/**
 * The CSP source expression that allows an inline script or style with
 * exactly this text: SHA-256 over its UTF-8 bytes, base64 as the spec wants.
 * Build-time only (node:crypto) — BaseLayout hands the result to Astro,
 * which writes it into the page's <meta http-equiv="Content-Security-Policy">.
 */
export function cspHash(source: string): `sha256-${string}` {
  const digest = createHash('sha256').update(source, 'utf8').digest('base64');
  return `sha256-${digest}`;
}
