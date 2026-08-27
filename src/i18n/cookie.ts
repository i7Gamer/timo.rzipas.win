// Kept dependency-free: imported by the client-side LanguageSwitcher script,
// and the name must match $cookie_lang in deploy/nginx.conf.
export const LANG_COOKIE_NAME = 'lang';
export const LANG_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The `document.cookie` string that pins the site to `locale`.
 *
 * `Secure` is only legal on a secure origin: a browser silently drops the
 * cookie when it is set over plain HTTP, which strands the language switch
 * whenever the container is reached directly over the LAN instead of
 * through the HTTPS tunnel. Pass `location.protocol`.
 */
export function langCookie(locale: string, protocol: string): string {
  const secure = protocol === 'https:' ? '; Secure' : '';
  return `${LANG_COOKIE_NAME}=${locale}; path=/; max-age=${LANG_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
