import { jobsDb, employersDb } from "@meshal/database";
import { jobFingerprint, QueueName } from "@meshal/shared";
import type { AgentOutcome } from "@meshal/orchestration";
import type { DequeuedTask } from "@meshal/orchestration";
import { LeverDiscoveryAdapter } from "@meshal/ats";
import { BaseAgent } from "./BaseAgent.js";

/**
 * Discovery Agent — finds potential jobs ONLY. It never submits an
 * application. It builds the employer registry progressively rather than
 * depending exclusively on search engines: each known Lever tenant is
 * scanned directly against Lever's public API.
 *
 * Payload for a "discovery.scan_tenant" task: { tenant: string, company: string }
 */
export class DiscoveryAgent extends BaseAgent {
  readonly name = "discovery_agent";
  private readonly lever = new LeverDiscoveryAdapter();

  protected async process(task: DequeuedTask, _runId: string): Promise<AgentOutcome> {
    const { tenant, company } = task.payload as { tenant?: string; company?: string };
    if (!tenant || !company) {
      return { error: { code: "ENGINEERING_ERROR", message: "discovery.scan_tenant task missing tenant/company" } };
    }

    const postings = await this.lever.fetchPostings(tenant);

    const employerId = await employersDb.upsertEmployer({
      company_name: company,
      career_url: `https://jobs.lever.co/${tenant}`,
      country: null,
      city: null,
      ats_type: "lever",
      ats_tenant: tenant,
      ats_base_url: `https://api.lever.co/v0/postings/${tenant}`,
      active: true,
      discovery_method: "LeverDiscoveryAdapter",
    });

    let discovered = 0;
    const newJobIds: string[] = [];
    for (const posting of postings) {
      const normalized = this.lever.normalize(tenant, posting, company);
      const fingerprint = jobFingerprint({
        employer: company,
        externalJobId: normalized.external_job_id,
        canonicalApplicationUrl: normalized.original_application_url,
        atsTenant: tenant,
      });
      const { job_id, inserted } = await jobsDb.upsertJob(fingerprint, normalized);
      if (inserted) {
        discovered++;
        newJobIds.push(job_id);
      }
    }

    return {
      // Discovery has no single job_id (it produces many); follow-up
      // verification tasks are enqueued individually per new job.
      enqueueNext: newJobIds.map((job_id) => ({ queue: QueueName.VERIFICATION, job_id, payload: {} })),
      payload: { employer_id: employerId, tenant, discovered, total_postings: postings.length },
    };
  }
}
