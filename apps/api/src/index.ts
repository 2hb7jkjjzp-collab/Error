import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { runMigrations } from "@meshal/database";
import { logger } from "@meshal/shared";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { jobsRouter } from "./routes/jobs.js";
import { applicationsRouter } from "./routes/applications.js";
import { agentsRouter } from "./routes/agents.js";
import { pipelineRouter } from "./routes/pipeline.js";
import { profileRouter, resumeRouter } from "./routes/profile.js";
import { settingsRouter } from "./routes/settings.js";
import { requireAuth } from "./middleware/auth.js";

async function main() {
  await runMigrations();

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  const apiLimiter = rateLimit({ windowMs: 60_000, max: 120 });
  app.use("/api", apiLimiter);

  // Public
  app.use(healthRouter);
  app.use("/api/auth", authRouter);

  // Authenticated dashboard/API surface
  app.use("/api", requireAuth, dashboardRouter);
  app.use("/api", requireAuth, jobsRouter);
  app.use("/api", requireAuth, applicationsRouter);
  app.use("/api", requireAuth, agentsRouter);
  app.use("/api", requireAuth, pipelineRouter);
  app.use("/api", requireAuth, profileRouter);
  app.use("/api", requireAuth, resumeRouter);
  app.use("/api", requireAuth, settingsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, "0.0.0.0", () => {
    logger.info("API server listening", { event: "api.started", port });
  });
}

main().catch((err) => {
  logger.error("API failed to start", { event: "api.start_error", error: String(err) });
  process.exit(1);
});
