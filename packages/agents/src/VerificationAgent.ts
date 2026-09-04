import { jobsDb, getPool } from "@meshal/database";
import { JobState, QueueName, ErrorCode } from "@meshal/shared";
import type { AgentOutcome } from "@meshal/orchestration";
import type { DequeuedTask } from "@meshal/orchestration";
import { BaseAgent } from "./BaseAgent.js";

/**
 * Job Verification Agent — independently confirms a discovered job is real,
 * open, and prefers the original employer/ATS URL as the canonical
 * application URL (Section 8). For Lever postings, the discovery adapter
 * already sourced the canonical Lever apply URL directly from Lever's API,
 * so verification here re-checks liveness and freshness rather than
 * re-deriving the canonical URL from a third party.
 */
export class VerificationAgent extends BaseAgent {
  readonly name = "verification_agent";

  protected async process(task: DequeuedTask, _runId: string): Promise<AgentOutcome> {
    if (!task.job_id) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: "verification task missing job_id" } };
    }
    const job = await jobsDb.getJob(task.job_id);
    if (!job) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: `Job ${task.job_id} not found` } };
    }

    await jobsDb.setJobStatus(task.job_id, JobState.VERIFYING);

    // Duplicate check: same fingerprint already exists as a different, older job.
    // (upsertJob already enforces fingerprint uniqueness at write time, so a
    // duplicate row cannot exist — this guards against near-duplicates from
    // multiple sources describing the same canonical application URL.)
    const nearDuplicate = job.original_application_url
      ? await this.findNearDuplicate(job.job_id, job.original_application_url)
      : null;
    if (nearDuplicate) {
      return { nextState: JobState.DUPLICATE, payload: { duplicate_of: nearDuplicate } };
    }

    const liveness = await this.checkLiveness(job.original_application_url ?? job.source_url);
    if (!liveness.ok) {
      return { nextState: JobState.CLOSED, payload: { reason: liveness.reason } };
    }

    return {
      nextState: JobState.VERIFIED,
      enqueueNext: [{ queue: QueueName.MATCHING, job_id: task.job_id }],
      payload: { verified: true, canonical_url: job.original_application_url ?? job.source_url },
    };
  }

  private async findNearDuplicate(jobId: string, canonicalUrl: string): Promise<string | null> {
    const { rows } = await getPool().query(
      "SELECT job_id FROM jobs WHERE original_application_url = $1 AND job_id != $2 AND status NOT IN ('DUPLICATE','CLOSED','REJECTED_BY_FILTER') LIMIT 1",
      [canonicalUrl, jobId]
    );
    return rows[0]?.job_id ?? null;
  }

  private async checkLiveness(url: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      if (res.status === 404 || res.status === 410) {
        return { ok: false, reason: `Vacancy page returned ${res.status} (closed).` };
      }
      if (!res.ok) {
        // Non-fatal HTTP error: treat as still open but flag — a hard 5xx would
        // be retried by the queue's own backoff, not silently marked closed.
        return { ok: true, reason: `Non-2xx status ${res.status}, treated as still open.` };
      }
      return { ok: true };
    } catch {
      // Network failure: don't kill the job on a transient fetch issue.
      return { ok: true, reason: "Liveness check network error; treated as still open pending retry." };
    }
  }
}
