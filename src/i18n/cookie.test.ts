import { describe, expect, it } from 'vitest';

import {
  LANG_COOKIE_MAX_AGE_SECONDS,
  LANG_COOKIE_NAME,
  langCookie,
} from './cookie';

describe('langCookie', () => {
  it('pins the locale under the name nginx negotiates on', () => {
    expect(langCookie('de', 'https:')).toContain(`${LANG_COOKIE_NAME}=de`);
  });

  it('scopes the cookie to the whole site and a year', () => {
    const cookie = langCookie('en', 'https:');
    expect(cookie).toContain('path=/');
    expect(cookie).toContain(`max-age=${LANG_COOKIE_MAX_AGE_SECONDS}`);
    expect(cookie).toContain('SameSite=Lax');
  });

  it('marks the cookie Secure over HTTPS', () => {
    expect(langCookie('de', 'https:')).toContain('; Secure');
  });

  // Browsers drop a Secure cookie set from a non-secure origin, which
  // stranded the switch when the container is reached over LAN HTTP
  // instead of through the HTTPS tunnel.
  it('omits Secure over plain HTTP so the switch still works on the LAN', () => {
    expect(langCookie('de', 'http:')).not.toContain('Secure');
  });

  it('omits Secure for any other scheme', () => {
    expect(langCookie('de', 'file:')).not.toContain('Secure');
  });
});
