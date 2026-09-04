import { getPool } from "../pool.js";
import type { MatchResult } from "@meshal/shared";

export async function saveMatch(
  jobId: string,
  candidateProfileId: string | null,
  result: MatchResult
): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO job_matches (job_id, candidate_profile_id, score, eligible, auto_apply, confidence, reasons, rejection_reasons, salary_analysis, experience_analysis, skills_analysis)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      jobId,
      candidateProfileId,
      result.score,
      result.eligible,
      result.auto_apply,
      result.confidence,
      JSON.stringify(result.reasons),
      JSON.stringify(result.rejection_reasons),
      result.salary_analysis,
      result.experience_analysis,
      result.skills_analysis,
    ]
  );
  return rows[0].id;
}

export async function getLatestMatch(jobId: string) {
  const { rows } = await getPool().query(
    "SELECT * FROM job_matches WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1",
    [jobId]
  );
  return rows[0] ?? null;
}
