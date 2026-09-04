-- Seed the initial set of job sources / ATS discovery adapters.
INSERT INTO job_sources (name, kind, enabled, config) VALUES
  ('lever', 'ats_direct', true, '{"adapter": "LeverDiscoveryAdapter"}'),
  ('greenhouse', 'ats_direct', false, '{"adapter": "GreenhouseDiscoveryAdapter", "phase": 2}'),
  ('smartrecruiters', 'ats_direct', false, '{"adapter": "SmartRecruitersDiscoveryAdapter", "phase": 3}'),
  ('workday', 'ats_direct', false, '{"adapter": "WorkdayDiscoveryAdapter", "phase": 4}'),
  ('oracle', 'ats_direct', false, '{"adapter": "OracleDiscoveryAdapter", "phase": 5}'),
  ('successfactors', 'ats_direct', false, '{"adapter": "SuccessFactorsDiscoveryAdapter", "phase": 6}')
ON CONFLICT (name) DO NOTHING;
