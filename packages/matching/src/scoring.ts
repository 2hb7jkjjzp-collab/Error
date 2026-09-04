import type { CandidateProfile, MatchResult, NormalizedJob } from "@meshal/shared";
import { professionalPreFilter } from "./professionalFilter.js";
import { checkLocation, checkSalary, DEFAULT_CANDIDATE_POLICY, type CandidatePolicy } from "./candidatePolicy.js";

/**
 * Deterministic scoring engine. This intentionally does not call an LLM
 * directly (no network dependency in this package) — MatchingAgent may layer
 * an optional semantic/LLM pass on top of this deterministic baseline before
 * finalizing MatchResult, per spec Section 10 ("both deterministic rules and
 * semantic/LLM analysis"). Keeping this package pure and dependency-light
 * makes it independently unit-testable.
 */
function skillOverlapScore(candidate: CandidateProfile, job: NormalizedJob): { score: number; matched: string[] } {
  const haystack = `${job.title} ${job.description ?? ""} ${job.requirements ?? ""}`.toLowerCase();
  const matched = candidate.skills.filter((s) => haystack.includes(s.toLowerCase()));
  const score = candidate.skills.length === 0 ? 0.5 : matched.length / candidate.skills.length;
  return { score: Math.min(1, score), matched };
}

function experienceScore(candidate: CandidateProfile, job: NormalizedJob): { score: number; note: string } {
  if (!job.experience_level) {
    return { score: 0.6, note: "Job does not state an experience level; assuming plausible fit." };
  }
  const level = job.experience_level.toLowerCase();
  const years = candidate.years_experience;
  if (level.includes("senior") || level.includes("manager")) {
    return years >= 5
      ? { score: 0.9, note: `${years} years experience fits a senior/manager role.` }
      : { score: 0.4, note: `${years} years experience may be light for a senior/manager role.` };
  }
  if (level.includes("junior") || level.includes("entry")) {
    return years <= 3
      ? { score: 0.8, note: `${years} years experience fits an entry/junior role.` }
      : { score: 0.7, note: `${years} years experience exceeds entry-level but transferable.` };
  }
  return { score: 0.7, note: `Experience level "${job.experience_level}" treated as mid-level; ${years} years considered compatible.` };
}

export function scoreJobAgainstCandidate(
  candidate: CandidateProfile,
  job: NormalizedJob,
  policy: CandidatePolicy = DEFAULT_CANDIDATE_POLICY
): MatchResult {
  const reasons: string[] = [];
  const rejectionReasons: string[] = [];

  const professional = professionalPreFilter(job.title, job.description);
  if (!professional.pass) {
    rejectionReasons.push(professional.reason);
    return {
      score: 0,
      eligible: false,
      auto_apply: false,
      confidence: 0.95,
      reasons,
      rejection_reasons: rejectionReasons,
      salary_analysis: "Not evaluated: rejected by professional pre-filter.",
      experience_analysis: "Not evaluated: rejected by professional pre-filter.",
      skills_analysis: "Not evaluated: rejected by professional pre-filter.",
    };
  }
  reasons.push(professional.reason);

  const location = checkLocation(job, policy);
  if (!location.pass) rejectionReasons.push(location.reason);
  else reasons.push(location.reason);

  const salary = checkSalary(job, policy);
  if (!salary.pass) rejectionReasons.push(salary.reason);
  else reasons.push(salary.reason);

  const skills = skillOverlapScore(candidate, job);
  const experience = experienceScore(candidate, job);

  const weighted = skills.score * 0.4 + experience.score * 0.4 + (professional.matchedKeywords.length > 0 ? 0.2 : 0);
  const score = Math.round(weighted * 100);

  const eligible = rejectionReasons.length === 0;
  const auto_apply = eligible && score >= 55;

  return {
    score,
    eligible,
    auto_apply,
    confidence: 0.75,
    reasons,
    rejection_reasons: rejectionReasons,
    salary_analysis: salary.reason,
    experience_analysis: experience.note,
    skills_analysis:
      skills.matched.length > 0
        ? `Matched skills: ${skills.matched.join(", ")}`
        : "No direct skill keyword overlap found; scored on title/experience relevance.",
  };
}
