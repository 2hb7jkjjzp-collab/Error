-- The API and worker run as separate Railway services with independent
-- volumes, so a résumé written to the API's local disk would be invisible
-- to the worker's browser automation. Store the résumé bytes centrally in
-- Postgres instead; the worker materializes them to a local temp file only
-- at the moment it needs to hand a file path to Playwright's file input.
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS resume_data BYTEA;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS resume_filename TEXT;
