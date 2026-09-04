# مِشعل — Meshal Job Autopilot

An autonomous, cloud-native job-search and job-application platform. It
continuously discovers real job postings, independently verifies them,
matches them against a candidate profile, routes eligible matches to the
correct ATS connector, fills and submits the application form, independently
verifies the submission, stores evidence, and tracks replies — all
coordinated by a central orchestrator over a durable Postgres-backed queue.
See `BUILD_STATUS.md` for current progress.

## Architecture

```
DISCOVERY AGENT → VERIFICATION AGENT → MATCHING AGENT → APPLICATION QUEUE
  → APPLICATION AGENT → SUBMISSION VERIFICATION AGENT → APPLICATION RECORD AGENT
  → TRACKING AGENT → PRESENTATION AGENT (dashboard)
```

Every agent is independently executable, observable, retryable, and
replaceable. Agents communicate exclusively through a durable Postgres queue
and an append-only event log (`application_events`) — never through
conversational hand-offs. The Orchestrator (`packages/orchestration`) is the
only code path allowed to change a job's lifecycle state, validated against
an explicit state machine (`packages/shared/src/types.ts`).

## Repository layout

```
apps/
  api/            REST API + JWT dashboard auth
  worker/         Queue consumer + Asia/Riyadh cron scheduler
  web/            Arabic RTL mobile dashboard (Vite + React)
packages/
  shared/         Types, error taxonomy, structured logger, fingerprinting
  database/       Postgres schema, migrations, typed query helpers
  orchestration/  Durable queue (SKIP LOCKED + backoff + DLQ), state machine,
                  event bus, Orchestrator, scheduler
  agents/         BaseAgent + the 7 queue-driven agents + 2 read-side agents
  matching/       Professional pre-filter, candidate policy, scoring engine
  browser/        Playwright wrapper, encrypted session manager,
                  FieldResolver, question classifier
  ats/            ConnectorContract, ApplicationRouter, Lever connector
                  (real, end-to-end), phased stub connectors
  email/          IMAP confirmation/tracking connector
migrations/       SQL migrations (applied automatically on API/worker boot)
tests/            node:test unit tests
```

## Running locally

```bash
cp .env.example .env        # fill in DASHBOARD_PASSWORD / JWT_SECRET / SESSION_ENCRYPTION_KEY
docker compose up --build
```

- API + Dashboard: http://localhost:3000 (health at `/healthz`). The API
  service serves the built dashboard directly from the same origin, so no
  reverse proxy is needed in production.
- Worker runs discovery/verification/matching/application/submission-verification/tracking continuously.

Without Docker:

```bash
npm install
npm run build
npm run migrate            # requires DATABASE_URL
npm run dev:api             # in one shell
npm run dev:worker          # in another
cd apps/web && npm run dev  # dashboard dev server
```

## Tests

```bash
npm test
```

## Connector roadmap (Section 45)

| Phase | ATS             | Status                                   |
|-------|-----------------|-------------------------------------------|
| 1     | Lever           | Implemented — discovery (public API) + full apply-form connector |
| 2     | Greenhouse      | Stub — raises `ATS_UNSUPPORTED`, not attempted |
| 3     | SmartRecruiters | Stub |
| 4     | Workday         | Stub |
| 5     | Oracle          | Stub |
| 6     | SuccessFactors  | Stub |

A connector is only "done" when it produces a real submission + an
independent confirmation + stored evidence — never merely when a form opens.

## What still needs the account owner

- A real candidate profile (`PUT /api/profile`) and CV (`POST /api/resume`).
- `DASHBOARD_PASSWORD`, `JWT_SECRET`, `SESSION_ENCRYPTION_KEY` secrets.
- IMAP credentials if email-based submission confirmation/tracking is wanted.
- Confirming which real employers/Lever tenants to seed into the employer
  registry before the pipeline is allowed to run against real vacancies.
- Railway project authorization for deployment.
