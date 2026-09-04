# syntax=docker/dockerfile:1

# ---- base: install deps once, shared across build stages ----
FROM node:20-bookworm-slim AS base
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/orchestration/package.json packages/orchestration/package.json
COPY packages/matching/package.json packages/matching/package.json
COPY packages/browser/package.json packages/browser/package.json
COPY packages/ats/package.json packages/ats/package.json
COPY packages/email/package.json packages/email/package.json
COPY packages/agents/package.json packages/agents/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

# ---- build: compile all TS packages + web bundle ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- runtime: api + worker (Playwright/Chromium included) ----
FROM mcr.microsoft.com/playwright:v1.48.2-jammy AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
RUN npm prune --omit=dev

EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:${PORT}/healthz || exit 1

# Default process is the API; Railway service config overrides CMD for the
# worker service (see docs/railway.md) to run `node apps/worker/dist/index.js`.
CMD ["node", "apps/api/dist/index.js"]
