# BUILD STATUS — Meshal Job Autopilot

_Last updated: 2026-09-04_

## Current phase

**Phase 1 (Section 45/50): core architecture + Lever end-to-end, pre-deployment.**
Repository structure, database schema, durable queue/state machine, agent
contracts, orchestrator, Lever connector, minimal dashboard, and Docker are
built and compiling/testing green. Railway deployment has not been executed
yet — it needs a decision from the account owner (see Blockers) before it
provisions real cloud resources.

## Completed components

- **Repository structure** — `apps/{api,worker,web}`, `packages/{shared,database,orchestration,agents,matching,browser,ats,email}`, `migrations/`, `tests/`, `docker/` per spec Section 40. Legacy unrelated bot code (`app.py`, `requirements.txt`) removed.
- **Database** — Full Postgres schema (`migrations/001_init.sql`) covering all 19 core tables from Section 33, plus a migration runner that auto-applies on API/worker boot and typed query modules per table.
- **Durable queue** — Postgres-backed queue (`application_queue`) using `FOR UPDATE SKIP LOCKED` for safe concurrent workers, exponential backoff retry, and dead-letter after `max_attempts`.
- **State machine** — Full job lifecycle (`DISCOVERED` → … → `SUBMITTED` → `REPLIED`/`INTERVIEW`/`OFFER`/`REJECTED`, plus `NEEDS_ACTION`/`RETRY_PENDING`/`DUPLICATE`/`CLOSED`/`REJECTED_BY_FILTER`) with an explicit transition table; the orchestrator is the only code path allowed to write `jobs.status`.
- **Event bus** — Append-only `application_events` audit trail; every agent action emits a structured event.
- **Orchestrator** — `packages/orchestration` dispatches queue tasks to registered agents, validates transitions, enqueues follow-up work, and turns thrown errors into retry/dead-letter outcomes automatically (Section 22: technical failures never silently downgrade to "needs action").
- **Scheduler** — `node-cron`, Asia/Riyadh timezone, 06:00 & 08:00 weekdays full pipeline, tracking every 2 hours, with an in-process overlap guard. `POST /api/pipeline/run` exposes the manual "بحث وتقديم الآن" trigger.
- **All 9 agents implemented**: Discovery, Verification, Matching, Application, Submission Verification, Application Record, Tracking, plus Presentation (dashboard aggregation) and the shared `BaseAgent` contract.
- **Matching** — Deterministic professional pre-filter (finance/accounting/audit/risk/treasury/tax keyword set with explicit irrelevant-profession rejection), Riyadh-strict + 15,000 SAR salary-floor candidate policy (never rejects on *missing* salary), and a scoring engine combining skills/experience/professional-fit into `MatchResult`.
- **Browser/ATS layer** — Playwright wrapper with no CAPTCHA/anti-bot evasion, AES-256-GCM encrypted `SessionManager` for persistent authenticated sessions, semantic `FieldResolver` + `questionClassifier` (never fabricates required legal/sensitive answers), `ConnectorContract`, `ApplicationRouter`.
- **Lever connector (Phase 1, real)** — `LeverDiscoveryAdapter` pulls real postings from Lever's public `api.lever.co/v0/postings/{tenant}` API (canonical, original-employer source, no scraping). `LeverConnector` drives the real `jobs.lever.co/.../apply` form end-to-end: open → fill known fields → upload resume → answer questions → validate → submit → collect signals. It never marks an application submitted itself.
- **Submission Verification Agent** — Independently checks confirmation text/URL/external ID and, when IMAP is configured, an inbox confirmation, before writing `SUBMITTED` + evidence row. No positive signal → `SUBMISSION_UNVERIFIED` → `NEEDS_ACTION`, never inferred from "no error was thrown."
- **Stub connectors** — Greenhouse/SmartRecruiters/Workday/Oracle/SuccessFactors are registered in the router (so URLs route correctly) but honestly raise `ATS_UNSUPPORTED` with their roadmap phase instead of pretending to submit.
- **Error taxonomy** — All 16 explicit codes from Section 37 implemented in `@meshal/shared`, with retryable vs. needs-action classification.
- **REST API** — `/healthz`, `/api/auth/login` (JWT), `/api/dashboard`, `/api/jobs[/:id]`, `/api/applications[/:id][/retry]`, `/api/agents`, `/api/runs`, `/api/pipeline/run`, `/api/profile` (+answers), `/api/resume`, `/api/settings`. Helmet, CORS, rate limiting, bearer-JWT auth on every non-health/login route.
- **Dashboard** — Arabic RTL, mobile-first (Vite + React + react-router), login, اليوم/funnel stats, live agent activity, jobs list + detail + timeline, applications list + detail + timeline + retry, profile editor + CV upload, settings/logout.
- **Docker** — Multi-stage `Dockerfile` (Playwright/Chromium base image for API+worker), separate `apps/web/Dockerfile`, `docker-compose.yml` wiring Postgres + api + worker + web with a named volume for `storage/` (sessions/evidence/resume).
- **Tests** — 21 `node:test` unit tests covering the state machine, professional pre-filter, candidate policy (Riyadh-strict, salary floor, missing-salary non-rejection), idempotent job fingerprinting, and the question classifier's "never fabricate a legal answer" rule. All passing.

## Architecture correction made during this pass

Résumé storage was redesigned before deployment: the API and worker run as
separate Railway services with independent volumes, so a file written to
the API service's local disk would never be visible to the worker's
Playwright automation. Résumé bytes are now stored centrally in Postgres
(`candidate_profiles.resume_data`, `migrations/003_resume_storage.sql`);
`ApplicationAgent.materializeResume()` writes them to a local temp file only
at the moment it needs to hand a path to the file input.

## Tests passed

```
npm run build   → tsc -b across all 9 packages + 2 apps: 0 errors
npm test        → 21/21 passing (state machine, professional filter, candidate policy, idempotency, question classifier)
apps/web build  → vite build: 0 errors, 177KB bundle
```

Not yet run in this sandbox (no Docker daemon available here): a live
migration run against Postgres, and a live Lever end-to-end submission. Both
are mechanically ready (`npm run migrate`, `docker compose up`) and will run
as part of Railway provisioning.

## Current blockers (need the account owner)

1. **No candidate profile or CV yet.** `candidate_profiles` is empty, so `MatchingAgent` correctly returns `REQUIRED_UNKNOWN_FIELD` on every job rather than guessing. Provide real profile data via the dashboard's Profile page (or `PUT /api/profile` / `POST /api/resume`) before any real application can be attempted.
2. **No employer registry seeded.** The pipeline only scans Lever tenants present in the `employers` table. None are seeded yet — real applications will not go out to real employers until specific companies/tenants are approved and added.
3. **Secrets not generated/set.** `DASHBOARD_PASSWORD`, `JWT_SECRET`, `SESSION_ENCRYPTION_KEY` need real values (env vars only, never committed).
4. **Railway deployment not started.** This account has Railway access (whoami confirmed), but creating a project, provisioning Postgres + a volume, and going live against real employers is a real-world, hard-to-reverse action (it will start sending real job applications once seeded) — proceeding needs an explicit go-ahead on which project/workspace to use and confirmation that seeding real employers is authorized.
5. **Email/IMAP not configured.** Optional but recommended: without it, submission verification relies solely on in-page confirmation signals, and the Tracking Agent cannot detect replies/interviews/offers/rejections.

## Deployment status

Not deployed. Docker image builds locally are untested against a live
Playwright/Chromium pull in this sandbox (no Docker daemon here) but the
Dockerfile follows the standard `mcr.microsoft.com/playwright` base image
pattern. Railway provisioning is queued behind the blockers above.

## Next engineering task

1. Get blockers 1–3 resolved (candidate profile, CV, secrets).
2. Provision Railway: Postgres + volume + api/worker/web services + env vars + health check, per Section 39.
3. Seed 1–3 real Lever employer tenants explicitly approved by the account owner.
4. Run one real end-to-end proof per Section 49: discover → verify → match → queue → apply → CV upload → submit → independently verify → evidence stored → visible on dashboard → tracking enabled.
5. Only after that proof succeeds, begin Phase 2 (Greenhouse connector).
