import cron from "node-cron";
import { logger } from "@meshal/shared";

export interface SchedulerHandlers {
  runFullPipeline: (trigger: "schedule" | "manual") => Promise<void>;
  runTracking: (trigger: "schedule" | "manual") => Promise<void>;
}

let pipelineRunning = false;
let trackingRunning = false;

/**
 * Section 42: 06:00 and 08:00 weekdays (Asia/Riyadh) run full discovery +
 * application pipeline; tracking every 2 hours. Overlapping runs of the same
 * kind are prevented with an in-process guard.
 */
export function startScheduler(handlers: SchedulerHandlers): void {
  const tz = process.env.SCHEDULER_TIMEZONE ?? "Asia/Riyadh";

  const guardedPipeline = async () => {
    if (pipelineRunning) {
      logger.warn("Pipeline run skipped: already running", { event: "scheduler.skip_overlap" });
      return;
    }
    pipelineRunning = true;
    try {
      await handlers.runFullPipeline("schedule");
    } catch (err) {
      logger.error("Scheduled pipeline run failed", { event: "scheduler.pipeline_error", error: String(err) });
    } finally {
      pipelineRunning = false;
    }
  };

  const guardedTracking = async () => {
    if (trackingRunning) {
      logger.warn("Tracking run skipped: already running", { event: "scheduler.skip_overlap" });
      return;
    }
    trackingRunning = true;
    try {
      await handlers.runTracking("schedule");
    } catch (err) {
      logger.error("Scheduled tracking run failed", { event: "scheduler.tracking_error", error: String(err) });
    } finally {
      trackingRunning = false;
    }
  };

  cron.schedule("0 6 * * 1-5", guardedPipeline, { timezone: tz });
  cron.schedule("0 8 * * 1-5", guardedPipeline, { timezone: tz });
  cron.schedule("0 */2 * * *", guardedTracking, { timezone: tz });

  logger.info("Scheduler started", { event: "scheduler.started", timezone: tz });
}

export async function isPipelineRunning(): Promise<boolean> {
  return pipelineRunning;
}
