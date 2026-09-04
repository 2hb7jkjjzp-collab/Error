import { Router } from "express";
import { jobsDb, eventsDb, matchesDb } from "@meshal/database";

export const jobsRouter = Router();

jobsRouter.get("/jobs", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const jobs = await jobsDb.listJobs({ status, limit, offset });
  res.json({ jobs });
});

jobsRouter.get("/jobs/:id", async (req, res) => {
  const job = await jobsDb.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const [events, match] = await Promise.all([
    eventsDb.listEventsForJob(job.job_id),
    matchesDb.getLatestMatch(job.job_id),
  ]);
  res.json({ job, events, match });
});
