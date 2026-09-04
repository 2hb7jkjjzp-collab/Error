import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jobsDb, applicationsDb, candidateDb } from "@meshal/database";
import { JobState, QueueName, ErrorCode, MeshalError } from "@meshal/shared";
import { transitionJobState } from "@meshal/orchestration";
import type { AgentOutcome, DequeuedTask } from "@meshal/orchestration";
import { BrowserManager, SessionManager } from "@meshal/browser";
import { buildDefaultRouter, type ApplicationContext } from "@meshal/ats";
import { BaseAgent } from "./BaseAgent.js";

/**
 * Application Agent — routes to the correct ATS connector and drives it
 * through the full multi-step contract (Section 14/20). It is explicitly
 * NOT authorized to mark a job SUBMITTED: after submit() it only moves the
 * job to SUBMISSION_PENDING_VERIFICATION and hands off to the Submission
 * Verification Agent (Section 23).
 */
export class ApplicationAgent extends BaseAgent {
  readonly name = "application_agent";
  private readonly router = buildDefaultRouter();
  private readonly browserManager = new BrowserManager();
  private readonly sessionManager = new SessionManager();

  protected async process(task: DequeuedTask, runId: string): Promise<AgentOutcome> {
    if (!task.job_id) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: "application task missing job_id" } };
    }
    const job = await jobsDb.getJob(task.job_id);
    if (!job) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: `Job ${task.job_id} not found` } };
    }

    const candidate = await candidateDb.getActiveCandidateProfile();
    if (!candidate) {
      return { error: { code: ErrorCode.REQUIRED_UNKNOWN_FIELD, message: "No candidate profile configured." } };
    }

    const applicationUrl = job.original_application_url ?? job.source_url;
    const connector = this.router.route(applicationUrl); // throws ATS_UNSUPPORTED if unroutable

    const resumeLocalPath = await this.materializeResume(candidate.id);
    if (!resumeLocalPath) {
      return { error: { code: ErrorCode.REQUIRED_UNKNOWN_FIELD, message: "No résumé uploaded for the candidate profile yet." } };
    }

    const applicationId = await applicationsDb.createApplication({
      job_id: job.job_id,
      candidate_profile_id: candidate.id,
      company: job.company,
      title: job.title,
      location: job.location,
      ats_type: connector.atsType,
      source: job.source,
      application_url: applicationUrl,
    });

    // A retry (after NEEDS_ACTION/dead-letter, or a crash mid-attempt that
    // left the job at APPLYING) can start from a state other than MATCHED —
    // only walk through QUEUED_FOR_APPLICATION when starting fresh from
    // MATCHED, and skip the APPLYING transition entirely if already there.
    if (job.status === JobState.MATCHED) {
      await transitionJobState(job.job_id, JobState.QUEUED_FOR_APPLICATION, this.name, runId);
      await transitionJobState(job.job_id, JobState.APPLYING, this.name, runId);
    } else if (job.status !== JobState.APPLYING) {
      await transitionJobState(job.job_id, JobState.APPLYING, this.name, runId);
    }
    await applicationsDb.updateApplication(applicationId, { status: JobState.APPLYING, started_at: new Date().toISOString() });

    const ctx: ApplicationContext = {
      jobUrl: applicationUrl,
      externalJobId: job.external_job_id,
      atsTenant: job.ats_tenant,
      candidate: { ...candidate, resume_path: resumeLocalPath },
      knownAnswers: await candidateDb.listCandidateAnswers(candidate.id),
      applicationId,
    };

    const sessionPath = this.sessionManager.has(connector.atsType, job.ats_tenant)
      ? (this.sessionManager.materializeForPlaywright(connector.atsType, job.ats_tenant) ?? undefined)
      : undefined;
    const context = await this.browserManager.newContext(sessionPath);
    const page = await context.newPage();

    try {
      const steps = [
        () => connector.open(page, ctx),
        () => connector.authenticate(page, ctx),
        () => connector.startApplication(page, ctx),
        () => connector.fillKnownFields(page, ctx),
        () => connector.uploadResume(page, ctx),
        () => connector.answerQuestions(page, ctx),
        () => connector.validateStep(page),
      ];

      const fieldsCompleted: string[] = [];
      for (const step of steps) {
        const result = await step();
        if (result.fieldsCompleted) fieldsCompleted.push(...result.fieldsCompleted);
        await applicationsDb.updateApplication(applicationId, {
          current_step: result.step,
          fields_completed: fieldsCompleted,
          attempt_count: task.attempts,
        });
        if (!result.ok) {
          const code = (result.errorCode as string) ?? ErrorCode.ENGINEERING_ERROR;
          await applicationsDb.updateApplication(applicationId, {
            status: JobState.NEEDS_ACTION,
            unanswered_fields: result.unansweredFields ?? [],
            blocker: { code, message: result.errorMessage, step: result.step },
          });
          return { nextState: JobState.NEEDS_ACTION, payload: { blocker: code, step: result.step, message: result.errorMessage } };
        }
      }

      await connector.submit(page);

      const evidenceDir = join(process.env.EVIDENCE_DIR ?? "./storage/evidence", applicationId);
      mkdirSync(evidenceDir, { recursive: true });
      const screenshotPath = join(evidenceDir, "post-submit.png");
      await this.browserManager.screenshot(page, screenshotPath);

      const signals = await connector.collectSubmissionSignals(page);

      // Persist the authenticated session for reuse next time (only if the
      // ATS required login; Lever's public flow has nothing to persist).
      const storageState = await context.storageState();
      this.sessionManager.save(connector.atsType, job.ats_tenant, storageState);

      await applicationsDb.updateApplication(applicationId, {
        status: JobState.SUBMISSION_PENDING_VERIFICATION,
        current_step: "submitted_pending_verification",
      });

      return {
        nextState: JobState.SUBMISSION_PENDING_VERIFICATION,
        enqueueNext: [
          {
            queue: QueueName.SUBMISSION_VERIFICATION,
            application_id: applicationId,
            payload: { screenshot_path: screenshotPath, signals },
          },
        ],
        payload: { application_id: applicationId },
      };
    } catch (err) {
      const meshalErr = err instanceof MeshalError ? err : new MeshalError(ErrorCode.ENGINEERING_ERROR, String(err));
      if (meshalErr.needsAction) {
        await applicationsDb.updateApplication(applicationId, {
          status: JobState.NEEDS_ACTION,
          blocker: { code: meshalErr.code, message: meshalErr.message },
        });
        return { nextState: JobState.NEEDS_ACTION, payload: { blocker: meshalErr.code } };
      }
      // Retryable engineering/technical errors bubble up so the queue's
      // exponential backoff handles the retry — never silently downgraded
      // to NEEDS_ACTION per Section 22.
      throw meshalErr;
    } finally {
      await connector.close(page);
      await context.close().catch(() => undefined);
    }
  }

  /**
   * Writes the candidate's résumé bytes (stored centrally in Postgres) to a
   * local temp file this worker instance can hand to Playwright's file
   * input. Returns null if no résumé has been uploaded yet.
   */
  private async materializeResume(candidateProfileId: string): Promise<string | null> {
    const blob = await candidateDb.getResumeBlob(candidateProfileId);
    if (!blob) return null;
    const dir = join(process.env.STORAGE_DIR ?? "./storage", "resume-tmp");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${candidateProfileId}-${blob.filename}`);
    writeFileSync(path, blob.data);
    return path;
  }
}
