import { Router } from "express";
import { employersDb } from "@meshal/database";
import { enqueue } from "@meshal/orchestration";
import { QueueName } from "@meshal/shared";

export const pipelineRouter = Router();

/**
 * "بحث وتقديم الآن" (search & apply now) manual trigger — Section 42.
 * Enqueues a discovery scan for every active employer in the registry. If
 * the registry is empty, seed it first via the employers table / a future
 * admin endpoint.
 */
pipelineRouter.post("/pipeline/run", async (_req, res) => {
  const employers = await employersDb.listEmployers(500);
  const leverEmployers = employers.filter((e) => e.ats_type === "lever" && e.active);

  for (const employer of leverEmployers) {
    await enqueue({
      queue: QueueName.DISCOVERY,
      payload: { tenant: employer.ats_tenant, company: employer.company_name },
    });
  }

  res.json({ ok: true, triggered: "manual", employers_scanned: leverEmployers.length });
});
