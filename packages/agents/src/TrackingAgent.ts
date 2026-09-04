import { getPool } from "@meshal/database";
import { JobState, ErrorCode } from "@meshal/shared";
import type { AgentOutcome, DequeuedTask } from "@meshal/orchestration";
import { EmailConnector, classifyEmail, type EmailClassification } from "@meshal/email";
import { BaseAgent } from "./BaseAgent.js";

const CLASSIFICATION_TO_JOB_STATE: Record<EmailClassification, JobState | null> = {
  REPLIED: JobState.REPLIED,
  INTERVIEW: JobState.INTERVIEW,
  OFFER: JobState.OFFER,
  REJECTED: JobState.REJECTED,
  ACTION_REQUIRED: JobState.NEEDS_ACTION,
  UNKNOWN_REPLY: JobState.REPLIED,
};

/**
 * Tracking Agent — periodically (every 2h, Section 26) checks for replies,
 * interview invitations, rejections, and offers on SUBMITTED applications,
 * independent of the Application/Submission agents. Runs per-application via
 * queued tracking tasks; the scheduler enqueues one per active application.
 */
export class TrackingAgent extends BaseAgent {
  readonly name = "tracking_agent";
  private readonly emailConnector = new EmailConnector();

  protected async process(task: DequeuedTask, _runId: string): Promise<AgentOutcome> {
    if (!task.application_id) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: "tracking task missing application_id" } };
    }
    const { rows } = await getPool().query(
      "SELECT * FROM applications WHERE application_id = $1",
      [task.application_id]
    );
    const application = rows[0];
    if (!application) {
      return { error: { code: ErrorCode.ENGINEERING_ERROR, message: `Application ${task.application_id} not found` } };
    }

    if (!this.emailConnector.isConfigured()) {
      return { payload: { skipped: true, reason: "Email tracking not configured." } };
    }

    const sinceDate = new Date(application.submitted_at ?? application.created_at);
    const found = await this.emailConnector.searchConfirmation({
      company: application.company,
      title: application.title,
      sinceDate,
    });

    if (found.length === 0) {
      return { payload: { new_events: 0 } };
    }

    let latestClassification: EmailClassification = "UNKNOWN_REPLY";
    for (const email of found) {
      const classification = classifyEmail(email.subject, email.excerpt);
      await getPool().query(
        `INSERT INTO tracking_events (application_id, classification, detail, source) VALUES ($1,$2,$3,'email')`,
        [task.application_id, classification, `${email.subject} — ${email.excerpt.slice(0, 200)}`]
      );
      await getPool().query(
        `INSERT INTO email_events (application_id, message_id, sender, subject, received_at, classification, raw_excerpt)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [task.application_id, email.messageId, email.sender, email.subject, email.receivedAt, classification, email.excerpt]
      );
      latestClassification = classification;
    }

    const nextJobState = CLASSIFICATION_TO_JOB_STATE[latestClassification];
    return {
      nextState: nextJobState ?? undefined,
      payload: { new_events: found.length, latest_classification: latestClassification },
    };
  }
}
