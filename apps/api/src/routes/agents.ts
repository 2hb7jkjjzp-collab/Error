import { Router } from "express";
import { agentRunsDb } from "@meshal/database";

export const agentsRouter = Router();

agentsRouter.get("/agents", async (_req, res) => {
  const activity = await agentRunsDb.currentAgentActivity();
  res.json({ agents: activity });
});

agentsRouter.get("/runs", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const runs = await agentRunsDb.listRecentRuns(limit);
  res.json({ runs });
});
