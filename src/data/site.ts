export const AUTHOR = 'Timo Rzipa';
export const SITE_URL = 'https://timo.rzipas.win';
export const GITHUB_URL = 'https://github.com/i7Gamer';
export const REPO_URL = 'https://github.com/i7Gamer/timo.rzipas.win';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/timo-rzipa-135770124/';
export const EMAIL = 'timorzipa@gmail.com';

/**
 * The social preview card. Width and height are declared so platforms can
 * reserve the right space before the image loads; src/data/site.test.ts
 * fails if they stop matching public/og.png.
 */
export const OG_IMAGE = {
  path: '/og.png',
  width: 1200,
  height: 630,
} as const;
