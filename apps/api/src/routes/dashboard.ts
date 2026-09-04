import { Router } from "express";
import { PresentationAgent } from "@meshal/agents";
import { agentRunsDb } from "@meshal/database";

export const dashboardRouter = Router();
const presentation = new PresentationAgent();

dashboardRouter.get("/dashboard", async (_req, res) => {
  const [funnel, liveAgents, recentRuns] = await Promise.all([
    presentation.funnel(),
    presentation.liveAgentActivity(),
    agentRunsDb.listRecentRuns(20),
  ]);
  res.json({ funnel, live_agents: liveAgents, recent_runs: recentRuns });
});
