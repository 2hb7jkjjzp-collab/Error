import { getPool } from "../pool.js";
import type { NormalizedJob, JobState } from "@meshal/shared";

export interface JobRow extends NormalizedJob {
  fingerprint: string;
  employer_id: string | null;
  updated_at: string;
}

export async function upsertJob(
  fingerprint: string,
  job: Omit<NormalizedJob, "job_id" | "status" | "verified_at">
): Promise<{ job_id: string; inserted: boolean }> {
  const pool = getPool();
  const existing = await pool.query<{ job_id: string }>(
    "SELECT job_id FROM jobs WHERE fingerprint = $1",
    [fingerprint]
  );
  if (existing.rows.length > 0) {
    return { job_id: existing.rows[0].job_id, inserted: false };
  }
  const { rows } = await pool.query<{ job_id: string }>(
    `INSERT INTO jobs (
      fingerprint, title, company, location, city, country, description, requirements,
      salary_min, salary_max, currency, employment_type, experience_level,
      source, source_url, original_application_url, application_email,
      ats_type, ats_tenant, external_job_id, status, discovered_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'DISCOVERED',$21)
    RETURNING job_id`,
    [
      fingerprint,
      job.title,
      job.company,
      job.location,
      job.city,
      job.country,
      job.description,
      job.requirements,
      job.salary_min,
      job.salary_max,
      job.currency,
      job.employment_type,
      job.experience_level,
      job.source,
      job.source_url,
      job.original_application_url,
      job.application_email,
      job.ats_type,
      job.ats_tenant,
      job.external_job_id,
      job.discovered_at,
    ]
  );
  return { job_id: rows[0].job_id, inserted: true };
}

export async function getJob(jobId: string): Promise<JobRow | null> {
  const { rows } = await getPool().query("SELECT * FROM jobs WHERE job_id = $1", [jobId]);
  return (rows[0] as JobRow) ?? null;
}

export async function listJobsByStatus(status: JobState, limit = 100): Promise<JobRow[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM jobs WHERE status = $1 ORDER BY discovered_at DESC LIMIT $2",
    [status, limit]
  );
  return rows as JobRow[];
}

export async function listJobs(params: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<JobRow[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  if (params.status) {
    const { rows } = await getPool().query(
      "SELECT * FROM jobs WHERE status = $1 ORDER BY discovered_at DESC LIMIT $2 OFFSET $3",
      [params.status, limit, offset]
    );
    return rows as JobRow[];
  }
  const { rows } = await getPool().query(
    "SELECT * FROM jobs ORDER BY discovered_at DESC LIMIT $1 OFFSET $2",
    [limit, offset]
  );
  return rows as JobRow[];
}

export async function setJobStatus(
  jobId: string,
  status: JobState,
  extra: Partial<{ verified_at: string; ats_type: string; ats_tenant: string; original_application_url: string; external_job_id: string }> = {}
): Promise<void> {
  const setParts = ["status = $2", "updated_at = now()"];
  const values: unknown[] = [jobId, status];
  let i = 3;
  for (const [k, v] of Object.entries(extra)) {
    setParts.push(`${k} = $${i}`);
    values.push(v);
    i++;
  }
  await getPool().query(`UPDATE jobs SET ${setParts.join(", ")} WHERE job_id = $1`, values);
}

export async function countJobsByStatus(): Promise<Record<string, number>> {
  const { rows } = await getPool().query<{ status: string; count: string }>(
    "SELECT status, COUNT(*)::text as count FROM jobs GROUP BY status"
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.count);
  return out;
}
