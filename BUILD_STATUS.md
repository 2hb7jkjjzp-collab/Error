# BUILD STATUS — Meshal Job Autopilot

_Last updated: 2026-09-04_

## Current phase

**Phase 1 (Section 45/50): core architecture + Lever end-to-end — deployed and live on Railway, awaiting candidate data.**
Repository structure, database schema, durable queue/state machine, agent
contracts, orchestrator, Lever connector, dashboard, and Docker are built,
tested, and now running in production on Railway (project
`meshal-job-autopilot`). The pipeline is safely idle: it will not send any
real application until a candidate profile + CV are provided and at least
one employer is seeded (see Blockers).

## Completed components

- **Repository structure** — `apps/{api,worker,web}`, `packages/{shared,database,orchestration,agents,matching,browser,ats,email}`, `migrations/`, `tests/`, `docker/` per spec Section 40. Legacy unrelated bot code (`app.py`, `requirements.txt`) removed.
- **Database** — Full Postgres schema (`migrations/001_init.sql` + `002_seed_job_sources.sql` + `003_resume_storage.sql`) covering all core tables from Section 33, plus a migration runner that auto-applies on API/worker boot and typed query modules per table.
- **Durable queue** — Postgres-backed queue (`application_queue`) using `FOR UPDATE SKIP LOCKED` for safe concurrent workers, exponential backoff retry, and dead-letter after `max_attempts`.
- **State machine** — Full job lifecycle (`DISCOVERED` → … → `SUBMITTED` → `REPLIED`/`INTERVIEW`/`OFFER`/`REJECTED`, plus `NEEDS_ACTION`/`RETRY_PENDING`/`DUPLICATE`/`CLOSED`/`REJECTED_BY_FILTER`) with an explicit transition table; the orchestrator is the only code path allowed to write `jobs.status`.
- **Event bus** — Append-only `application_events` audit trail; every agent action emits a structured event.
- **Orchestrator** — `packages/orchestration` dispatches queue tasks to registered agents, validates transitions, enqueues follow-up work, and turns thrown errors into retry/dead-letter outcomes automatically (Section 22: technical failures never silently downgrade to "needs action").
- **Scheduler** — `node-cron`, Asia/Riyadh timezone, 06:00 & 08:00 weekdays full pipeline, tracking every 2 hours, with an in-process overlap guard. Confirmed running in production logs (`scheduler.started`). `POST /api/pipeline/run` exposes the manual "بحث وتقديم الآن" trigger.
- **All 9 agents implemented**: Discovery, Verification, Matching, Application, Submission Verification, Application Record, Tracking, plus Presentation (dashboard aggregation) and the shared `BaseAgent` contract.
- **Matching** — Deterministic professional pre-filter (finance/accounting/audit/risk/treasury/tax keyword set with explicit irrelevant-profession rejection), Riyadh-strict + 15,000 SAR salary-floor candidate policy (never rejects on *missing* salary), and a scoring engine combining skills/experience/professional-fit into `MatchResult`.
- **Browser/ATS layer** — Playwright wrapper with no CAPTCHA/anti-bot evasion, AES-256-GCM encrypted `SessionManager` for persistent authenticated sessions, semantic `FieldResolver` + `questionClassifier` (never fabricates required legal/sensitive answers), `ConnectorContract`, `ApplicationRouter`.
- **Lever connector (Phase 1, real)** — `LeverDiscoveryAdapter` pulls real postings from Lever's public `api.lever.co/v0/postings/{tenant}` API (canonical, original-employer source, no scraping). `LeverConnector` drives the real `jobs.lever.co/.../apply` form end-to-end: open → fill known fields → upload résumé → answer questions → validate → submit → collect signals. It never marks an application submitted itself.
- **Submission Verification Agent** — Independently checks confirmation text/URL/external ID and, when IMAP is configured, an inbox confirmation, before writing `SUBMITTED` + evidence row. No positive signal → `SUBMISSION_UNVERIFIED` → `NEEDS_ACTION`, never inferred from "no error was thrown."
- **Stub connectors** — Greenhouse/SmartRecruiters/Workday/Oracle/SuccessFactors are registered in the router (so URLs route correctly) but honestly raise `ATS_UNSUPPORTED` with their roadmap phase instead of pretending to submit.
- **Error taxonomy** — All 16 explicit codes from Section 37 implemented in `@meshal/shared`, with retryable vs. needs-action classification.
- **REST API** — `/healthz`, `/api/auth/login` (JWT), `/api/dashboard`, `/api/jobs[/:id]`, `/api/applications[/:id][/retry]`, `/api/agents`, `/api/runs`, `/api/pipeline/run`, `/api/profile` (+answers), `/api/resume`, `/api/settings`. Helmet, CORS, rate limiting, bearer-JWT auth on every non-health/login route.
- **Dashboard** — Arabic RTL, mobile-first (Vite + React + react-router), login, اليوم/funnel stats, live agent activity, jobs list + detail + timeline, applications list + detail + timeline + retry, profile editor + CV upload, settings/logout. Served by the API service itself (`express.static` + SPA fallback) — one origin, no reverse proxy needed.
- **Docker** — Multi-stage `Dockerfile` (Playwright/Chromium base image), `docker-compose.yml` wiring Postgres + api + worker with a named volume for `storage/` (sessions/evidence). Résumé bytes live in Postgres, not on disk, so they're visible to whichever service needs them regardless of volume boundaries.
- **Tests** — 21 `node:test` unit tests covering the state machine, professional pre-filter, candidate policy (Riyadh-strict, salary floor, missing-salary non-rejection), idempotent job fingerprinting, and the question classifier's "never fabricate a legal answer" rule. All passing.

## Architecture corrections made during this pass

1. **Résumé storage moved from disk to Postgres.** The API and worker run as separate Railway services with independent volumes, so a file written to the API service's local disk would never be visible to the worker's Playwright automation. Résumé bytes are now stored centrally (`candidate_profiles.resume_data`, `migrations/003_resume_storage.sql`); `ApplicationAgent.materializeResume()` writes them to a local temp file only at the moment it needs to hand a path to the file input.
2. **Dashboard now served by the API service**, not a separate `serve -s dist` container — the latter had no way to proxy `/api` calls to the API service in production and would have left the dashboard unable to reach its backend.
3. **`pg` pool no longer defaults to SSL for any non-localhost host.** It incorrectly assumed every non-localhost Postgres needed SSL; the actual Railway Postgres service (a plain `postgres:16-alpine` image, not a managed SSL-terminated product) doesn't speak SSL, which crash-looped both services in production until fixed (`packages/database/src/pool.ts`). SSL now only turns on via an explicit `sslmode=require`/`ssl=true` in `DATABASE_URL` or `PGSSL=true`.
4. **Renamed `candidate_profiles.current_role` → `current_job_title`.** `current_role` is a reserved PostgreSQL keyword, which made the unquoted `CREATE TABLE` fail with a syntax error on every deploy attempt until caught and fixed.

## Tests passed

```
npm run build   → tsc -b across all 9 packages + 2 apps: 0 errors
npm test        → 21/21 passing (state machine, professional filter, candidate policy, idempotency, question classifier)
apps/web build  → vite build: 0 errors, 177KB bundle
```

## Deployment status — LIVE

Deployed to Railway, project **`meshal-job-autopilot`** (account `2hb7jkjjzp-collab`, workspace "2hb7jkjjzp-collab's Projects"), environment `production`.

| Service    | State  | Notes |
|------------|--------|-------|
| `postgres` | Online | `postgres:16-alpine`, persistent volume `pgdata` at `/var/lib/postgresql/data` |
| `api`      | Online | Dockerfile builder, health check `/healthz` passing, serves the dashboard, public domain generated |
| `worker`   | Online | Dockerfile builder (Playwright/Chromium base image), persistent volume `worker-storage` at `/repo/storage` for sessions/evidence, scheduler confirmed started (`Asia/Riyadh`) |

Public dashboard URL: **https://api-production-9bb1.up.railway.app**
(login with the `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` shared with the account owner out-of-band — never committed to the repo).

All 3 migrations (`001_init.sql`, `002_seed_job_sources.sql`, `003_resume_storage.sql`) confirmed applied from live deploy logs. This session's outbound network sandbox blocks direct `curl`/`WebFetch` to the deployed domain, so external reachability was verified indirectly: Railway's own HTTP health check (which gates the `online`/`SUCCESS` state) passed, and deploy logs show `API server listening` / `Worker started` / `Scheduler started` with no further errors.

Three real production bugs were caught and fixed during this deployment (not caught by local `tsc`/tests, since there's no live Postgres in this sandbox): the SSL default, the `current_role` reserved keyword, and the résumé-storage/volume-sharing issue. All three are now fixed, pushed, and confirmed running.

## Current blockers (need the account owner)

1. **No candidate profile or CV yet.** `candidate_profiles` is empty, so `MatchingAgent` correctly returns `REQUIRED_UNKNOWN_FIELD` on every job rather than guessing. Provide real profile data via the dashboard's Profile page (or `PUT /api/profile` / `POST /api/resume`) before any real application can be attempted.
2. **No employer registry seeded.** The pipeline only scans Lever tenants present in the `employers` table. None are seeded yet — real applications will not go out to real employers until specific companies/tenants are approved and added. This is deliberate: the platform is live and safe (nothing to apply to) until this step is explicitly authorized.
3. **Email/IMAP not configured.** Optional but recommended: without it, submission verification relies solely on in-page confirmation signals, and the Tracking Agent cannot detect replies/interviews/offers/rejections.

## Next engineering task

1. Get the candidate profile + CV into the system via the dashboard.
2. Seed 1–3 real Lever employer tenants explicitly approved by the account owner.
3. Trigger "بحث وتقديم الآن" (or wait for the 06:00/08:00 Riyadh schedule) and run one real end-to-end proof per Section 49: discover → verify → match → queue → apply → CV upload → submit → independently verify → evidence stored → visible on dashboard → tracking enabled.
4. Only after that proof succeeds, begin Phase 2 (Greenhouse connector).
