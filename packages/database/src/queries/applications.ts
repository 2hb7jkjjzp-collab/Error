import { getPool } from "../pool.js";

export interface ApplicationRow {
  application_id: string;
  job_id: string;
  candidate_profile_id: string | null;
  company: string;
  title: string;
  location: string | null;
  ats_type: string;
  source: string;
  application_url: string | null;
  match_score: number | null;
  status: string;
  attempt_count: number;
  blocker: Record<string, unknown> | null;
  confirmation_url: string | null;
  external_application_id: string | null;
  next_action: string | null;
  current_step: string | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createApplication(input: {
  job_id: string;
  candidate_profile_id?: string | null;
  company: string;
  title: string;
  location?: string | null;
  ats_type: string;
  source: string;
  application_url?: string | null;
  match_score?: number | null;
}): Promise<string> {
  const { rows } = await getPool().query<{ application_id: string }>(
    `INSERT INTO applications (job_id, candidate_profile_id, company, title, location, ats_type, source, application_url, match_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (job_id) DO UPDATE SET updated_at = now()
     RETURNING application_id`,
    [
      input.job_id,
      input.candidate_profile_id ?? null,
      input.company,
      input.title,
      input.location ?? null,
      input.ats_type,
      input.source,
      input.application_url ?? null,
      input.match_score ?? null,
    ]
  );
  return rows[0].application_id;
}

export async function getApplication(applicationId: string): Promise<ApplicationRow | null> {
  const { rows } = await getPool().query("SELECT * FROM applications WHERE application_id = $1", [
    applicationId,
  ]);
  return (rows[0] as ApplicationRow) ?? null;
}

export async function getApplicationByJobId(jobId: string): Promise<ApplicationRow | null> {
  const { rows } = await getPool().query("SELECT * FROM applications WHERE job_id = $1", [jobId]);
  return (rows[0] as ApplicationRow) ?? null;
}

export async function listApplications(params: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ApplicationRow[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  if (params.status) {
    const { rows } = await getPool().query(
      "SELECT * FROM applications WHERE status = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
      [params.status, limit, offset]
    );
    return rows as ApplicationRow[];
  }
  const { rows } = await getPool().query(
    "SELECT * FROM applications ORDER BY updated_at DESC LIMIT $1 OFFSET $2",
    [limit, offset]
  );
  return rows as ApplicationRow[];
}

export async function updateApplication(
  applicationId: string,
  fields: Partial<{
    status: string;
    attempt_count: number;
    blocker: Record<string, unknown> | null;
    confirmation_url: string;
    external_application_id: string;
    next_action: string;
    current_step: string;
    fields_completed: string[];
    unanswered_fields: string[];
    started_at: string;
    submitted_at: string;
    browser_session_id: string;
  }>
): Promise<void> {
  const setParts: string[] = ["updated_at = now()"];
  const values: unknown[] = [applicationId];
  let i = 2;
  for (const [k, v] of Object.entries(fields)) {
    const isJson = ["blocker", "fields_completed", "unanswered_fields"].includes(k);
    setParts.push(`${k} = $${i}`);
    values.push(isJson ? JSON.stringify(v) : v);
    i++;
  }
  await getPool().query(`UPDATE applications SET ${setParts.join(", ")} WHERE application_id = $1`, values);
}

export async function countApplicationsByStatus(): Promise<Record<string, number>> {
  const { rows } = await getPool().query<{ status: string; count: string }>(
    "SELECT status, COUNT(*)::text as count FROM applications GROUP BY status"
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.count);
  return out;
}
