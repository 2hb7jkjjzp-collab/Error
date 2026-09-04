-- =============================================================================
-- MESHAL JOB AUTOPILOT — initial schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  nationality TEXT,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  city TEXT NOT NULL DEFAULT 'Riyadh',
  country TEXT NOT NULL DEFAULT 'Saudi Arabia',
  postal_code TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  current_employer TEXT,
  current_job_title TEXT,
  years_experience NUMERIC,
  current_salary NUMERIC,
  expected_salary NUMERIC,
  notice_period TEXT,
  education JSONB NOT NULL DEFAULT '[]',
  certifications JSONB NOT NULL DEFAULT '[]',
  languages JSONB NOT NULL DEFAULT '[]',
  skills JSONB NOT NULL DEFAULT '[]',
  work_history JSONB NOT NULL DEFAULT '[]',
  resume_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  answer TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'user',
  allowed_for_auto_answer BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employers (
  employer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  career_url TEXT,
  country TEXT,
  city TEXT,
  ats_type TEXT,
  ats_tenant TEXT,
  ats_base_url TEXT,
  last_scan TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  discovery_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_name, ats_type, ats_tenant)
);

CREATE TABLE IF NOT EXISTS job_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL, -- ats_direct | job_board | search_engine
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  employer_id UUID REFERENCES employers(employer_id),
  location TEXT,
  city TEXT,
  country TEXT,
  description TEXT,
  requirements TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  currency TEXT,
  employment_type TEXT,
  experience_level TEXT,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  original_application_url TEXT,
  application_email TEXT,
  ats_type TEXT NOT NULL DEFAULT 'unknown',
  ats_tenant TEXT,
  external_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);

CREATE TABLE IF NOT EXISTS job_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  duplicate_of_job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  candidate_profile_id UUID REFERENCES candidate_profiles(id),
  score NUMERIC NOT NULL,
  eligible BOOLEAN NOT NULL,
  auto_apply BOOLEAN NOT NULL,
  confidence NUMERIC NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]',
  rejection_reasons JSONB NOT NULL DEFAULT '[]',
  salary_analysis TEXT,
  experience_analysis TEXT,
  skills_analysis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_matches_job ON job_matches(job_id);

CREATE TABLE IF NOT EXISTS application_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue TEXT NOT NULL,
  job_id UUID REFERENCES jobs(job_id) ON DELETE CASCADE,
  application_id UUID,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | RUNNING | DONE | FAILED | DEAD_LETTER
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  priority INT NOT NULL DEFAULT 100,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_queue_dispatch ON application_queue(queue, status, run_at);

CREATE TABLE IF NOT EXISTS applications (
  application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  candidate_profile_id UUID REFERENCES candidate_profiles(id),
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  ats_type TEXT NOT NULL,
  source TEXT NOT NULL,
  application_url TEXT,
  match_score NUMERIC,
  status TEXT NOT NULL DEFAULT 'QUEUED_FOR_APPLICATION',
  attempt_count INT NOT NULL DEFAULT 0,
  blocker JSONB,
  confirmation_url TEXT,
  external_application_id TEXT,
  next_action TEXT,
  current_step TEXT,
  fields_completed JSONB NOT NULL DEFAULT '[]',
  unanswered_fields JSONB NOT NULL DEFAULT '[]',
  browser_session_id UUID,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

CREATE TABLE IF NOT EXISTS application_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(job_id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(application_id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  event_type TEXT NOT NULL,
  run_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_job ON application_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_application ON application_events(application_id, created_at);

CREATE TABLE IF NOT EXISTS agent_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL,
  trigger TEXT NOT NULL, -- schedule | manual | retry
  status TEXT NOT NULL DEFAULT 'RUNNING', -- RUNNING | SUCCEEDED | FAILED
  stats JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES agent_runs(run_id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  job_id UUID REFERENCES jobs(job_id),
  application_id UUID REFERENCES applications(application_id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ats_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ats_type TEXT NOT NULL,
  ats_tenant TEXT,
  username TEXT NOT NULL,
  secret_ref TEXT NOT NULL, -- name of the secret/env var holding the credential; never the credential itself
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | NEEDS_VERIFICATION | EXPIRED
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ats_type, ats_tenant, username)
);

CREATE TABLE IF NOT EXISTS browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ats_type TEXT NOT NULL,
  ats_tenant TEXT,
  ats_account_id UUID REFERENCES ats_accounts(id),
  storage_path TEXT NOT NULL, -- encrypted Playwright storageState path, persistent volume
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | EXPIRED
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submission_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  ats_type TEXT NOT NULL,
  confirmation_url TEXT,
  external_application_id TEXT,
  confirmation_text TEXT,
  screenshot_path TEXT,
  verification_method TEXT NOT NULL,
  run_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(application_id) ON DELETE CASCADE,
  message_id TEXT,
  sender TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ,
  classification TEXT, -- REPLIED | INTERVIEW | OFFER | REJECTED | ACTION_REQUIRED | UNKNOWN_REPLY
  raw_excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  classification TEXT NOT NULL,
  detail TEXT,
  source TEXT NOT NULL, -- email | ats
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
