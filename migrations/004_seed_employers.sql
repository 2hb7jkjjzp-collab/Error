-- Initial employer registry seed: companies confirmed (via web search) to run
-- a public Lever job board with Riyadh-relevant activity. This is a starting
-- point for the Discovery Agent, not a guarantee any of them currently have a
-- finance/accounting opening — the professional pre-filter and Riyadh/salary
-- policy in @meshal/matching reject anything that doesn't genuinely fit.
INSERT INTO employers (company_name, career_url, country, city, ats_type, ats_tenant, ats_base_url, active, discovery_method) VALUES
  ('dLocal', 'https://jobs.lever.co/dlocal', 'Saudi Arabia', 'Riyadh', 'lever', 'dlocal', 'https://api.lever.co/v0/postings/dlocal', true, 'web_search_seed'),
  ('Flow', 'https://jobs.lever.co/flowlife', 'Saudi Arabia', 'Riyadh', 'lever', 'flowlife', 'https://api.lever.co/v0/postings/flowlife', true, 'web_search_seed'),
  ('Edelman', 'https://jobs.lever.co/djeholdings', 'Saudi Arabia', 'Riyadh', 'lever', 'djeholdings', 'https://api.lever.co/v0/postings/djeholdings', true, 'web_search_seed'),
  ('SOUM', 'https://jobs.lever.co/soum', 'Saudi Arabia', 'Riyadh', 'lever', 'soum', 'https://api.lever.co/v0/postings/soum', true, 'web_search_seed'),
  ('Lalamove', 'https://jobs.lever.co/lalamove', 'Saudi Arabia', 'Riyadh', 'lever', 'lalamove', 'https://api.lever.co/v0/postings/lalamove', true, 'web_search_seed'),
  ('Strategic Gears', 'https://jobs.lever.co/strategicgears', 'Saudi Arabia', 'Riyadh', 'lever', 'strategicgears', 'https://api.lever.co/v0/postings/strategicgears', true, 'web_search_seed'),
  ('Contentsquare', 'https://jobs.lever.co/contentsquare', 'Saudi Arabia', 'Riyadh', 'lever', 'contentsquare', 'https://api.lever.co/v0/postings/contentsquare', true, 'web_search_seed')
ON CONFLICT (company_name, ats_type, ats_tenant) DO NOTHING;
