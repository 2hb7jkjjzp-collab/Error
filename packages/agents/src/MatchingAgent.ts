import { jobsDb, matchesDb, candidateDb } from "@meshal/database";
import { JobState, QueueName, ErrorCode, type NormalizedJob } from "@meshal/shared";
import type { AgentOutcome } from "@meshal/orchestration";
import type { DequeuedTask } from "@meshal/orchestration";
import { scoreJobAgainstCandidate } from "@meshal/matching";
import { BaseAgent } from "./BaseAgent.js";

/**
 * Matching Agent — scores a verified job against the active candidate
 * profile using the deterministic engine in @meshal/matching (professional
 * pre-filter + Riyadh/salary policy + skills/experience scoring). Persists
 * the MatchResult regardless of outcome so rejections stay explainable.
 */
export class MatchingAgent extends BaseAgent {
  readonly name = "matching_agent";

  protected async process(task: DequeuedTask, _runId: string): Promise<AgentOutcome> {
    if (!task.job_id) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: "matching task missing job_id" } };
    }
    const job = await jobsDb.getJob(task.job_id);
    if (!job) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: `Job ${task.job_id} not found` } };
    }

    const candidate = await candidateDb.getActiveCandidateProfile();
    if (!candidate) {
      // No candidate profile configured yet — this is a genuine NEEDS_ACTION,
      // not an engineering error: only the account owner can provide it.
      return {
        error: {
          code: ErrorCode.REQUIRED_UNKNOWN_FIELD,
          message: "No candidate profile is configured. Set one via PUT /api/profile before matching can run.",
        },
      };
    }

    await jobsDb.setJobStatus(task.job_id, JobState.MATCHING);

    const normalized: NormalizedJob = {
      job_id: job.job_id,
      title: job.title,
      company: job.company,
      location: job.location,
      city: job.city,
      country: job.country,
      description: job.description,
      requirements: job.requirements,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      currency: job.currency,
      employment_type: job.employment_type,
      experience_level: job.experience_level,
      source: job.source,
      source_url: job.source_url,
      original_application_url: job.original_application_url,
      application_email: job.application_email,
      ats_type: job.ats_type,
      ats_tenant: job.ats_tenant,
      external_job_id: job.external_job_id,
      discovered_at: job.discovered_at,
      verified_at: job.verified_at,
      status: job.status as JobState,
    };

    const result = scoreJobAgainstCandidate(candidate, normalized);
    await matchesDb.saveMatch(task.job_id, candidate.id, result);

    if (!result.eligible) {
      return { nextState: JobState.REJECTED_BY_FILTER, payload: { score: result.score, rejection_reasons: result.rejection_reasons } };
    }

    return {
      nextState: JobState.MATCHED,
      enqueueNext: result.auto_apply
        ? [{ queue: QueueName.APPLICATION, job_id: task.job_id, payload: { candidate_profile_id: candidate.id } }]
        : [],
      payload: { score: result.score, auto_apply: result.auto_apply, reasons: result.reasons },
    };
  }
}
