# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
# Version must match the packageManager field in package.json.
RUN npm install -g pnpm@8.15.6
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG PUBLIC_BUILD_SHA=""
ENV PUBLIC_BUILD_SHA=$PUBLIC_BUILD_SHA
RUN node scripts/build.mjs

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
