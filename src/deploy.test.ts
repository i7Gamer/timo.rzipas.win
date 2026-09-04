import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contracts between deploy/nginx.conf, the header snippet it includes and
 * the Dockerfile that ships both. A broken include only surfaces when the
 * container starts, and a dropped header surfaces nowhere at all, so these
 * guard what a test suite can see without running the image.
 */
const ROOT = join(import.meta.dirname, '..');

function read(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8');
}

const NGINX_CONF = read('deploy/nginx.conf');
const HEADERS_SNIPPET = read('deploy/security-headers.conf');
const DOCKERFILE = read('Dockerfile');
const COMPOSE_EXAMPLE = read('deploy/docker-compose.example.yml');

/** Where the Dockerfile installs the snippet inside the image. */
const SNIPPET_PATH = '/etc/nginx/snippets/security-headers.conf';
const INCLUDE_DIRECTIVE = `include ${SNIPPET_PATH};`;

/** Headers every response must carry, whichever block produced it. */
const SHARED_HEADERS = [
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Content-Security-Policy',
];

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** What the image's health check must request, from inside the container. */
const HEALTH_PROBE = 'wget -q --spider http://127.0.0.1/healthz';
/** A HEALTHCHECK instruction is short; its CMD sits within this many chars. */
const HEALTHCHECK_MAX_LENGTH = 200;

/**
 * The server block's own directives and each location block's body, keyed
 * by block name. Locations in this config nest no further braces. Anchored
 * to line starts so the word "location" inside a comment does not count.
 */
function nginxBlocks(): Record<string, string> {
  const server = /^server \{([\s\S]*)\n\}/m.exec(NGINX_CONF)?.[1];
  if (server === undefined) {
    throw new Error('no server block in deploy/nginx.conf');
  }
  const blocks: Record<string, string> = {};
  let own = server;
  for (const [whole, name, body] of server.matchAll(
    /^\s*(location [^{\n]+)\{([^}]*)\}/gm,
  )) {
    blocks[name.trim()] = body;
    own = own.replace(whole, '');
  }
  blocks.server = own;
  return blocks;
}

describe('nginx blocks', () => {
  // Without this, the header checks below could pass vacuously if the
  // block matcher silently stopped matching.
  it('are all found by the matcher', () => {
    expect(Object.keys(nginxBlocks()).sort()).toEqual([
      'location /',
      'location = /healthz',
      'location = /status.json',
      'server',
    ]);
  });
});

describe('nginx hygiene', () => {
  // Cloudflare masks the Server header publicly; the LAN sees it directly.
  it('hides the nginx version', () => {
    expect(nginxBlocks().server).toContain('server_tokens off;');
  });

  // The image health check and the host status probe hit /healthz every
  // minute; logging those would bury real traffic.
  it('keeps the health probes out of the access log', () => {
    expect(nginxBlocks()['location = /healthz']).toContain('access_log off;');
  });
});

describe('nginx redirects', () => {
  // TLS ends at the Cloudflare edge, so nginx only sees plain HTTP and would
  // otherwise build http:// Locations for /projects -> /projects/.
  it('are relative, so the visitor keeps their own scheme', () => {
    expect(nginxBlocks().server).toContain('absolute_redirect off;');
  });
});

describe('nginx response headers', () => {
  it('include HSTS for a year, on error pages too', () => {
    expect(HEADERS_SNIPPET).toMatch(
      new RegExp(
        `^add_header Strict-Transport-Security "max-age=${ONE_YEAR_SECONDS}[^"]*" always;$`,
        'm',
      ),
    );
  });

  it('declare every shared header in the snippet, with always', () => {
    for (const header of SHARED_HEADERS) {
      expect(HEADERS_SNIPPET, header).toMatch(
        new RegExp(`^add_header ${header} .* always;$`, 'm'),
      );
    }
  });

  it('declare the shared headers nowhere else', () => {
    for (const header of SHARED_HEADERS) {
      expect(NGINX_CONF, header).not.toContain(`add_header ${header}`);
    }
  });

  // add_header is inherited only by blocks that declare none of their own,
  // so a location adding one header silently drops every server-level one.
  it('are re-included by every block that adds a header of its own', () => {
    for (const [name, body] of Object.entries(nginxBlocks())) {
      if (body.includes('add_header')) {
        expect(body, name).toContain(INCLUDE_DIRECTIVE);
      }
    }
  });

  it('come from the file the Dockerfile installs at the included path', () => {
    expect(DOCKERFILE).toContain(
      `COPY deploy/security-headers.conf ${SNIPPET_PATH}`,
    );
  });
});

describe('image health check', () => {
  it('is built into the image and probes /healthz', () => {
    const start = DOCKERFILE.indexOf('HEALTHCHECK');
    expect(start, 'HEALTHCHECK instruction').toBeGreaterThanOrEqual(0);
    const instruction = DOCKERFILE.slice(start, start + HEALTHCHECK_MAX_LENGTH);
    expect(instruction).toMatch(/^HEALTHCHECK [\s\S]*?\bCMD\b/);
    expect(instruction).toContain(HEALTH_PROBE);
  });

  // The example used to carry the block, and a deployment that did not copy
  // it ran with no health check at all. The image owns it now.
  it('is not duplicated by the compose example', () => {
    expect(COMPOSE_EXAMPLE).not.toMatch(/^\s*healthcheck:/m);
  });
});

const CI = read('.github/workflows/ci.yml');
const SMOKE_SCRIPT = read('deploy/smoke-test.sh');

describe('image build', () => {
  // Without the workspace file, pnpm 10+ refuses esbuild's install script
  // inside the image build.
  it('installs with the pnpm settings file', () => {
    expect(DOCKERFILE).toContain(
      'COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./',
    );
  });

  // The full alpine image bundles modules (njs, geoip, xslt, image filter)
  // this config never loads.
  it('serves from the slim nginx image', () => {
    expect(DOCKERFILE).toMatch(/^FROM nginx:[0-9.]+-alpine-slim$/m);
  });

  // The output is static files, so the Node stage never has to run on the
  // target architecture; under QEMU it took longer than the whole test job.
  it('compiles the site on the build host instead of under emulation', () => {
    expect(DOCKERFILE).toMatch(/^FROM --platform=\$BUILDPLATFORM node:/m);
  });
});

/** The lines of one top-level job in ci.yml, up to the next job. */
function jobBlock(name: string): string {
  const lines = CI.split('\n');
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start < 0) {
    throw new Error(`no job "${name}" in ci.yml`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));
  return rest.slice(0, end < 0 ? rest.length : end).join('\n');
}

describe('CI', () => {
  it('has a bash smoke test for a running image', () => {
    expect(SMOKE_SCRIPT.startsWith('#!/usr/bin/env bash\n')).toBe(true);
    expect(SMOKE_SCRIPT).toContain('set -euo pipefail');
  });

  it('runs that smoke test against a freshly built image', () => {
    expect(CI).toContain('bash deploy/smoke-test.sh');
  });

  it('publishes the image only after test and smoke passed', () => {
    expect(jobBlock('docker')).toContain('needs: [test, smoke]');
  });

  // Guards the slicing above: run past the next job and this would see
  // the publish job's needs line too.
  it('lets test and smoke run without waiting on each other', () => {
    expect(jobBlock('test')).not.toContain('needs:');
    expect(jobBlock('smoke')).not.toContain('needs:');
  });
});

describe('nginx Vary', () => {
  // Hashed assets are the same file in every language tree; a Vary: Cookie
  // there makes browsers refetch fonts and CSS after every language switch.
  it('is switched off for language-independent files through a map', () => {
    expect(NGINX_CONF).toMatch(/^map \$uri \$vary \{$/m);
    expect(NGINX_CONF).toMatch(/"~\^\/_astro\/"\s+""/);
    expect(nginxBlocks().server).toContain('add_header Vary $vary always;');
  });

  it('still names the language inputs on the health endpoint', () => {
    expect(nginxBlocks()['location = /healthz']).toContain(
      'add_header Vary "Cookie, Accept-Language";',
    );
  });
});

describe('content security policy', () => {
  // The page policy travels in a <meta> that Astro fills with script hashes;
  // the header keeps only what a <meta> cannot carry.
  it('leaves script and style sources to the page-level meta policy', () => {
    const header =
      /^add_header Content-Security-Policy "([^"]*)" always;$/m.exec(
        HEADERS_SNIPPET,
      )?.[1];
    expect(header).toBe("frame-ancestors 'none'");
  });

  it('allows unsafe-inline nowhere', async () => {
    expect(HEADERS_SNIPPET).not.toContain('unsafe-inline');
    expect(NGINX_CONF).not.toContain('unsafe-inline');
    const { default: config } = await import('../astro.config');
    expect(JSON.stringify(config.security?.csp)).not.toContain('unsafe-inline');
  });

  it('is generated by Astro with the site-wide directives', async () => {
    const { default: config } = await import('../astro.config');
    const csp = config.security?.csp;
    expect(csp).toBeTypeOf('object');
    if (typeof csp !== 'object') {
      return;
    }
    expect(csp.directives).toEqual(
      expect.arrayContaining([
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
      ]),
    );
  });
});
