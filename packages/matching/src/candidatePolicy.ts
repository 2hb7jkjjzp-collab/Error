/**
 * Section 11 — Candidate policy. This is deliberately conservative and
 * explicit: location is Riyadh-only (strict), salary floor is 15,000 SAR
 * when stated, unknown salary is never an automatic rejection, and the same
 * original CV is used for every application (never fabricated or modified).
 */
export interface CandidatePolicy {
  allowedCities: string[];
  strictLocation: boolean;
  minimumSalarySar: number;
  rejectOnMissingSalary: boolean;
}

export const DEFAULT_CANDIDATE_POLICY: CandidatePolicy = {
  allowedCities: ["riyadh", "الرياض"],
  strictLocation: true,
  minimumSalarySar: 15000,
  rejectOnMissingSalary: false,
};

export interface LocationCheckResult {
  pass: boolean;
  reason: string;
}

export function checkLocation(
  job: { city?: string | null; location?: string | null; country?: string | null },
  policy: CandidatePolicy = DEFAULT_CANDIDATE_POLICY
): LocationCheckResult {
  const haystack = `${job.city ?? ""} ${job.location ?? ""}`.toLowerCase();
  const isRiyadh = policy.allowedCities.some((c) => haystack.includes(c));

  if (!policy.strictLocation) {
    return { pass: true, reason: "Location check not strict." };
  }
  if (isRiyadh) {
    return { pass: true, reason: "Location is Riyadh." };
  }
  // Fully remote roles with no city constraint are not auto-accepted under a
  // strict Riyadh-only policy unless explicitly stated as Riyadh-eligible remote.
  return { pass: false, reason: `Location "${job.city ?? job.location ?? "unknown"}" is not Riyadh; strict policy rejects it.` };
}

export interface SalaryCheckResult {
  pass: boolean;
  reason: string;
}

export function checkSalary(
  job: { salary_min?: number | null; salary_max?: number | null; currency?: string | null },
  policy: CandidatePolicy = DEFAULT_CANDIDATE_POLICY
): SalaryCheckResult {
  const hasSalary = job.salary_min != null || job.salary_max != null;
  if (!hasSalary) {
    return policy.rejectOnMissingSalary
      ? { pass: false, reason: "Salary not stated and policy requires it." }
      : { pass: true, reason: "Salary not stated; not rejecting on missing salary per policy." };
  }
  const isSar = !job.currency || /sar|sr|ريال/i.test(job.currency);
  if (!isSar) {
    // Non-SAR salary: don't reject solely on currency mismatch, defer to semantic analysis.
    return { pass: true, reason: `Salary stated in ${job.currency}; not directly comparable to SAR floor.` };
  }
  const relevant = job.salary_max ?? job.salary_min ?? 0;
  if (relevant < policy.minimumSalarySar) {
    return { pass: false, reason: `Stated salary (${relevant} SAR) is below the ${policy.minimumSalarySar} SAR minimum.` };
  }
  return { pass: true, reason: `Salary (${relevant} SAR) meets the ${policy.minimumSalarySar} SAR minimum.` };
}
