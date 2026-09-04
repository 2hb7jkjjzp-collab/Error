import { jobsDb, applicationsDb, agentRunsDb } from "@meshal/database";

/**
 * Presentation Agent — Section 28/29/30. Aggregates real, persisted pipeline
 * state for the dashboard. It never simulates progress: every number comes
 * from a SELECT against jobs/applications/agent_runs.
 */
export class PresentationAgent {
  readonly name = "presentation_agent";

  async funnel() {
    const jobCounts = await jobsDb.countJobsByStatus();
    const appCounts = await applicationsDb.countApplicationsByStatus();
    return {
      found: Object.values(jobCounts).reduce((a, b) => a + b, 0),
      verified: (jobCounts.VERIFIED ?? 0) + (jobCounts.MATCHING ?? 0) + (jobCounts.MATCHED ?? 0) + (jobCounts.QUEUED_FOR_APPLICATION ?? 0) + (jobCounts.APPLYING ?? 0) + (jobCounts.SUBMISSION_PENDING_VERIFICATION ?? 0) + (jobCounts.SUBMITTED ?? 0),
      matched: (jobCounts.MATCHED ?? 0) + (jobCounts.QUEUED_FOR_APPLICATION ?? 0) + (jobCounts.APPLYING ?? 0) + (jobCounts.SUBMISSION_PENDING_VERIFICATION ?? 0) + (jobCounts.SUBMITTED ?? 0),
      queued: jobCounts.QUEUED_FOR_APPLICATION ?? 0,
      attempted: (appCounts.APPLYING ?? 0) + (appCounts.SUBMISSION_PENDING_VERIFICATION ?? 0) + (appCounts.SUBMITTED ?? 0) + (appCounts.NEEDS_ACTION ?? 0),
      submitted: appCounts.SUBMITTED ?? 0,
      needs_action: appCounts.NEEDS_ACTION ?? 0,
      job_status_breakdown: jobCounts,
      application_status_breakdown: appCounts,
    };
  }

  async liveAgentActivity() {
    return agentRunsDb.currentAgentActivity();
  }
}
