/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Locale of the current build pass, injected via vite define in astro.config.ts. */
  readonly SITE_LOCALE?: string;
  /** Git SHA baked in by CI (docker build arg); undefined in local dev. */
  readonly PUBLIC_BUILD_SHA?: string;
}
