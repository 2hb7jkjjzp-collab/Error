import { applicationsDb, evidenceDb } from "@meshal/database";
import { JobState, ErrorCode, QueueName } from "@meshal/shared";
import type { AgentOutcome, DequeuedTask } from "@meshal/orchestration";
import { EmailConnector } from "@meshal/email";
import { BaseAgent } from "./BaseAgent.js";
import type { SubmissionSignals } from "@meshal/ats";

/**
 * Submission Verification Agent — Section 23/47. The Application Agent is
 * NOT authorized to mark an application submitted. This agent independently
 * examines the signals collected right after the submit click (confirmation
 * text/URL, screenshot) and, where email tracking is configured, corroborates
 * with an inbox confirmation. ONLY on positive confirmation does the job
 * move to SUBMITTED; otherwise it is SUBMISSION_UNVERIFIED -> NEEDS_ACTION,
 * never silently assumed successful because "the button was clicked" or
 * "the page changed without error".
 */
export class SubmissionVerificationAgent extends BaseAgent {
  readonly name = "submission_verification_agent";
  private readonly emailConnector = new EmailConnector();

  protected async process(task: DequeuedTask, runId: string): Promise<AgentOutcome> {
    if (!task.application_id) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: "submission_verification task missing application_id" } };
    }
    const application = await applicationsDb.getApplication(task.application_id);
    if (!application) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: `Application ${task.application_id} not found` } };
    }

    const { screenshot_path, signals } = task.payload as { screenshot_path?: string; signals?: SubmissionSignals };

    const hasStrongSignal = Boolean(signals?.confirmationText || signals?.confirmationUrl || signals?.externalApplicationId);

    let emailConfirmed = false;
    let emailExcerpt: string | null = null;
    if (this.emailConnector.isConfigured()) {
      const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const found = await this.emailConnector.searchConfirmation({
        company: application.company,
        title: application.title,
        sinceDate,
      });
      if (found.length > 0) {
        emailConfirmed = true;
        emailExcerpt = found[0].excerpt;
      }
    }

    const verified = hasStrongSignal || emailConfirmed;
    const verificationMethod = emailConfirmed
      ? "email_confirmation"
      : hasStrongSignal
        ? "page_confirmation_signal"
        : "none";

    if (!verified) {
      await applicationsDb.updateApplication(task.application_id, {
        status: JobState.NEEDS_ACTION,
        blocker: { code: ErrorCode.SUBMISSION_UNVERIFIED, message: "No positive confirmation signal found after submit." },
      });
      return {
        nextState: JobState.NEEDS_ACTION,
        payload: { verification_method: verificationMethod },
      };
    }

    await evidenceDb.saveEvidence({
      application_id: task.application_id,
      job_id: application.job_id,
      company: application.company,
      title: application.title,
      ats_type: application.ats_type,
      confirmation_url: signals?.confirmationUrl ?? null,
      external_application_id: signals?.externalApplicationId ?? null,
      confirmation_text: signals?.confirmationText ?? emailExcerpt,
      screenshot_path: screenshot_path ?? null,
      verification_method: verificationMethod,
      run_id: runId,
    });

    await applicationsDb.updateApplication(task.application_id, {
      status: JobState.SUBMITTED,
      submitted_at: new Date().toISOString(),
      confirmation_url: signals?.confirmationUrl ?? undefined,
      external_application_id: signals?.externalApplicationId ?? undefined,
      next_action: "none",
    });

    return {
      nextState: JobState.SUBMITTED,
      enqueueNext: [{ queue: QueueName.TRACKING, application_id: task.application_id, payload: {} }],
      payload: { verification_method: verificationMethod },
    };
  }
}
