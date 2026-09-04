import { Router } from "express";
import { ApplicationRecordAgent } from "@meshal/agents";
import { applicationsDb } from "@meshal/database";
import { enqueue } from "@meshal/orchestration";
import { QueueName, JobState } from "@meshal/shared";

export const applicationsRouter = Router();
const records = new ApplicationRecordAgent();

applicationsRouter.get("/applications", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const applications = await applicationsDb.listApplications({ status, limit, offset });
  res.json({ applications });
});

applicationsRouter.get("/applications/:id", async (req, res) => {
  const record = await records.getFullRecord(req.params.id);
  if (!record) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(record);
});

applicationsRouter.post("/applications/:id/retry", async (req, res) => {
  const application = await applicationsDb.getApplication(req.params.id);
  if (!application) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  await applicationsDb.updateApplication(application.application_id, { status: JobState.RETRY_PENDING, blocker: null });
  await enqueue({ queue: QueueName.APPLICATION, job_id: application.job_id, application_id: application.application_id, payload: {} });
  res.json({ ok: true, status: "RETRY_PENDING" });
});
