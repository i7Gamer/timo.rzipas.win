# syntax=docker/dockerfile:1

FROM node:26-alpine AS build
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

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
