import { randomUUID } from "node:crypto";
import { runMigrations, employersDb, agentRunsDb } from "@meshal/database";
import { Orchestrator, enqueue, startScheduler } from "@meshal/orchestration";
import { QueueName, logger } from "@meshal/shared";
import {
  DiscoveryAgent,
  VerificationAgent,
  MatchingAgent,
  ApplicationAgent,
  SubmissionVerificationAgent,
  TrackingAgent,
} from "@meshal/agents";

const WORKER_ID = process.env.HOSTNAME ?? `worker-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);

async function runFullPipeline(trigger: "schedule" | "manual") {
  const runId = await agentRunsDb.startAgentRun("orchestrator", trigger);
  try {
    const employers = await employersDb.listEmployers(500);
    const leverEmployers = employers.filter((e) => e.ats_type === "lever" && e.active);
    for (const employer of leverEmployers) {
      await enqueue({
        queue: QueueName.DISCOVERY,
        payload: { tenant: employer.ats_tenant, company: employer.company_name },
      });
    }
    await agentRunsDb.finishAgentRun(runId, "SUCCEEDED", { employers_scanned: leverEmployers.length });
  } catch (err) {
    await agentRunsDb.finishAgentRun(runId, "FAILED", { error: String(err) });
    throw err;
  }
}

async function runTracking(trigger: "schedule" | "manual") {
  const runId = await agentRunsDb.startAgentRun("tracking_scheduler", trigger);
  try {
    const { getPool } = await import("@meshal/database");
    const { rows } = await getPool().query("SELECT application_id FROM applications WHERE status = 'SUBMITTED'");
    for (const row of rows as Array<{ application_id: string }>) {
      await enqueue({ queue: QueueName.TRACKING, application_id: row.application_id, payload: {} });
    }
    await agentRunsDb.finishAgentRun(runId, "SUCCEEDED", { applications_checked: rows.length });
  } catch (err) {
    await agentRunsDb.finishAgentRun(runId, "FAILED", { error: String(err) });
    throw err;
  }
}

async function main() {
  await runMigrations();

  const orchestrator = new Orchestrator();
  orchestrator.register(QueueName.DISCOVERY, new DiscoveryAgent());
  orchestrator.register(QueueName.VERIFICATION, new VerificationAgent());
  orchestrator.register(QueueName.MATCHING, new MatchingAgent());
  orchestrator.register(QueueName.APPLICATION, new ApplicationAgent());
  orchestrator.register(QueueName.SUBMISSION_VERIFICATION, new SubmissionVerificationAgent());
  orchestrator.register(QueueName.TRACKING, new TrackingAgent());

  if (process.env.SCHEDULER_ENABLED !== "false") {
    startScheduler({ runFullPipeline, runTracking });
  }

  logger.info("Worker started", { event: "worker.started", worker_id: WORKER_ID });

  let shuttingDown = false;
  process.on("SIGTERM", () => { shuttingDown = true; });
  process.on("SIGINT", () => { shuttingDown = true; });

  while (!shuttingDown) {
    try {
      await orchestrator.runAllQueuesOnce(WORKER_ID);
    } catch (err) {
      logger.error("Worker loop iteration failed", { event: "worker.loop_error", error: String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  logger.info("Worker shutting down", { event: "worker.stopped" });
  process.exit(0);
}

main().catch((err) => {
  logger.error("Worker failed to start", { event: "worker.start_error", error: String(err) });
  process.exit(1);
});
