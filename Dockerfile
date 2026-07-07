# syntax=docker/dockerfile:1
# Towventure app image (OPERATIONS.md §1). Multi-stage: install + build the client
# bundle, then a runtime that serves the API and hands the static bundle to Caddy
# via a shared volume. The server runs under tsx (resolves the cross-package TS
# workspace directly); a Phase 5 pass can swap in a prebuilt bundle if wanted.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
COPY packages/harness/package.json ./packages/harness/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @towventure/client build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/packages/server
EXPOSE 8080
ENTRYPOINT ["sh", "/app/ops/docker-entrypoint.sh"]
