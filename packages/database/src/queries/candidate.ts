import { getPool } from "../pool.js";
import type { CandidateProfile, CandidateAnswer } from "@meshal/shared";

export async function getActiveCandidateProfile(): Promise<(CandidateProfile & { id: string }) | null> {
  const { rows } = await getPool().query("SELECT * FROM candidate_profiles ORDER BY updated_at DESC LIMIT 1");
  return (rows[0] as (CandidateProfile & { id: string })) ?? null;
}

export async function upsertCandidateProfile(id: string | null, profile: CandidateProfile): Promise<string> {
  const pool = getPool();
  if (id) {
    await pool.query(
      `UPDATE candidate_profiles SET
        legal_name=$2, first_name=$3, middle_name=$4, last_name=$5, preferred_name=$6, email=$7, phone=$8,
        nationality=$9, date_of_birth=$10, gender=$11, address=$12, city=$13, country=$14, postal_code=$15,
        linkedin_url=$16, portfolio_url=$17, current_employer=$18, current_role=$19, years_experience=$20,
        current_salary=$21, expected_salary=$22, notice_period=$23, education=$24, certifications=$25,
        languages=$26, skills=$27, work_history=$28, resume_path=$29, updated_at=now()
       WHERE id=$1`,
      [
        id,
        profile.legal_name,
        profile.first_name,
        profile.middle_name ?? null,
        profile.last_name,
        profile.preferred_name ?? null,
        profile.email,
        profile.phone,
        profile.nationality ?? null,
        profile.date_of_birth ?? null,
        profile.gender ?? null,
        profile.address ?? null,
        profile.city,
        profile.country,
        profile.postal_code ?? null,
        profile.linkedin_url ?? null,
        profile.portfolio_url ?? null,
        profile.current_employer ?? null,
        profile.current_role ?? null,
        profile.years_experience,
        profile.current_salary ?? null,
        profile.expected_salary ?? null,
        profile.notice_period ?? null,
        JSON.stringify(profile.education),
        JSON.stringify(profile.certifications),
        JSON.stringify(profile.languages),
        JSON.stringify(profile.skills),
        JSON.stringify(profile.work_history),
        profile.resume_path,
      ]
    );
    return id;
  }
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO candidate_profiles (
      legal_name, first_name, middle_name, last_name, preferred_name, email, phone, nationality,
      date_of_birth, gender, address, city, country, postal_code, linkedin_url, portfolio_url,
      current_employer, current_role, years_experience, current_salary, expected_salary, notice_period,
      education, certifications, languages, skills, work_history, resume_path
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
    RETURNING id`,
    [
      profile.legal_name,
      profile.first_name,
      profile.middle_name ?? null,
      profile.last_name,
      profile.preferred_name ?? null,
      profile.email,
      profile.phone,
      profile.nationality ?? null,
      profile.date_of_birth ?? null,
      profile.gender ?? null,
      profile.address ?? null,
      profile.city,
      profile.country,
      profile.postal_code ?? null,
      profile.linkedin_url ?? null,
      profile.portfolio_url ?? null,
      profile.current_employer ?? null,
      profile.current_role ?? null,
      profile.years_experience,
      profile.current_salary ?? null,
      profile.expected_salary ?? null,
      profile.notice_period ?? null,
      JSON.stringify(profile.education),
      JSON.stringify(profile.certifications),
      JSON.stringify(profile.languages),
      JSON.stringify(profile.skills),
      JSON.stringify(profile.work_history),
      profile.resume_path,
    ]
  );
  return rows[0].id;
}

export async function listCandidateAnswers(candidateProfileId: string): Promise<CandidateAnswer[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM candidate_answers WHERE candidate_profile_id = $1",
    [candidateProfileId]
  );
  return rows as CandidateAnswer[];
}

export async function upsertCandidateAnswer(
  candidateProfileId: string,
  answer: Omit<CandidateAnswer, "id">
): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO candidate_answers (candidate_profile_id, question_pattern, category, answer, confidence, source, allowed_for_auto_answer)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      candidateProfileId,
      answer.question_pattern,
      answer.category,
      answer.answer,
      answer.confidence,
      answer.source,
      answer.allowed_for_auto_answer,
    ]
  );
  return rows[0].id;
}
