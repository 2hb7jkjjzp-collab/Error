import { getPool } from "../pool.js";

export interface RecordEventInput {
  job_id?: string | null;
  application_id?: string | null;
  agent: string;
  event_type: string;
  run_id: string;
  payload?: Record<string, unknown>;
  error?: Record<string, unknown> | null;
}

/** Append-only audit trail. Never update or delete rows here. */
export async function recordEvent(input: RecordEventInput): Promise<string> {
  const { rows } = await getPool().query<{ event_id: string }>(
    `INSERT INTO application_events (job_id, application_id, agent, event_type, run_id, payload, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING event_id`,
    [
      input.job_id ?? null,
      input.application_id ?? null,
      input.agent,
      input.event_type,
      input.run_id,
      JSON.stringify(input.payload ?? {}),
      input.error ? JSON.stringify(input.error) : null,
    ]
  );
  return rows[0].event_id;
}

export async function listEventsForJob(jobId: string) {
  const { rows } = await getPool().query(
    "SELECT * FROM application_events WHERE job_id = $1 ORDER BY created_at ASC",
    [jobId]
  );
  return rows;
}

export async function listEventsForApplication(applicationId: string) {
  const { rows } = await getPool().query(
    "SELECT * FROM application_events WHERE application_id = $1 ORDER BY created_at ASC",
    [applicationId]
  );
  return rows;
}
