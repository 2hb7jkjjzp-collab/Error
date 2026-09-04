import { MeshalError, ErrorCode, type NormalizedJob, type ATSType } from "@meshal/shared";

/**
 * Lever exposes a real, public, unauthenticated JSON postings API at
 * https://api.lever.co/v0/postings/{tenant} for every company using Lever's
 * standard job board (jobs.lever.co/{tenant}). This is the CANONICAL,
 * original-employer source — no scraping of third-party aggregators needed.
 */
export interface LeverPosting {
  id: string;
  text: string; // title
  categories?: { location?: string; team?: string; commitment?: string };
  descriptionPlain?: string;
  lists?: Array<{ text: string; content: string }>;
  hostedUrl: string;
  applyUrl: string;
  country?: string;
  salaryRange?: { min?: number; max?: number; currency?: string };
}

export class LeverDiscoveryAdapter {
  readonly atsType: ATSType = "lever";

  async fetchPostings(tenant: string): Promise<LeverPosting[]> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(tenant)}?mode=json`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" } });
    } catch (err) {
      throw new MeshalError(ErrorCode.ATS_TEMPORARY_ERROR, `Lever postings fetch failed for tenant ${tenant}: ${err}`, { tenant });
    }
    if (res.status === 404) {
      // Tenant does not use Lever, or has no public board — not an error, just empty.
      return [];
    }
    if (!res.ok) {
      throw new MeshalError(ErrorCode.ATS_TEMPORARY_ERROR, `Lever API returned ${res.status} for tenant ${tenant}`, { tenant, status: res.status });
    }
    return (await res.json()) as LeverPosting[];
  }

  normalize(tenant: string, posting: LeverPosting, company: string): Omit<NormalizedJob, "job_id" | "status" | "verified_at"> {
    const requirements = (posting.lists ?? []).map((l) => `${l.text}: ${l.content}`).join("\n");
    return {
      title: posting.text,
      company,
      location: posting.categories?.location ?? null,
      city: posting.categories?.location ?? null,
      country: posting.country ?? null,
      description: posting.descriptionPlain ?? null,
      requirements: requirements || null,
      salary_min: posting.salaryRange?.min ?? null,
      salary_max: posting.salaryRange?.max ?? null,
      currency: posting.salaryRange?.currency ?? null,
      employment_type: posting.categories?.commitment ?? null,
      experience_level: null,
      source: "lever_direct",
      source_url: posting.hostedUrl,
      original_application_url: posting.applyUrl,
      application_email: null,
      ats_type: "lever",
      ats_tenant: tenant,
      external_job_id: posting.id,
      discovered_at: new Date().toISOString(),
    };
  }
}
