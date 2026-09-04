# syntax=docker/dockerfile:1

# Keep the Node major in sync with .nvmrc — CI runs the tests on that
# version, and Dependabot is told not to bump this major on its own.
# --platform=$BUILDPLATFORM: the output is static files, so this stage always
# runs natively on the CI runner instead of under QEMU for arm64 — only the
# nginx stage below is built per target architecture.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
# corepack installs the pnpm version pinned in package.json's packageManager field.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG PUBLIC_BUILD_SHA=""
ENV PUBLIC_BUILD_SHA=$PUBLIC_BUILD_SHA
RUN node scripts/build.mjs

# -slim: the same nginx without the module packages (njs, geoip, xslt, image
# filter) this config never loads.
FROM nginx:1.31-alpine-slim
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
# Included by nginx.conf at exactly this path (src/deploy.test.ts checks both sides).
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Built into the image so every deployment gets it, not only the ones that
# copied a healthcheck block from deploy/docker-compose.example.yml. Three
# misses in a row mark the container unhealthy in `docker ps`.
HEALTHCHECK --interval=60s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
