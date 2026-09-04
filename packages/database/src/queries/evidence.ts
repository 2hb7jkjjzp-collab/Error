import { getPool } from "../pool.js";

export interface SubmissionEvidenceInput {
  application_id: string;
  job_id: string;
  company: string;
  title: string;
  ats_type: string;
  confirmation_url?: string | null;
  external_application_id?: string | null;
  confirmation_text?: string | null;
  screenshot_path?: string | null;
  verification_method: string;
  run_id: string;
}

export async function saveEvidence(input: SubmissionEvidenceInput): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO submission_evidence
      (application_id, job_id, company, title, ats_type, confirmation_url, external_application_id, confirmation_text, screenshot_path, verification_method, run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      input.application_id,
      input.job_id,
      input.company,
      input.title,
      input.ats_type,
      input.confirmation_url ?? null,
      input.external_application_id ?? null,
      input.confirmation_text ?? null,
      input.screenshot_path ?? null,
      input.verification_method,
      input.run_id,
    ]
  );
  return rows[0].id;
}

export async function listEvidenceForApplication(applicationId: string) {
  const { rows } = await getPool().query(
    "SELECT * FROM submission_evidence WHERE application_id = $1 ORDER BY created_at DESC",
    [applicationId]
  );
  return rows;
}
