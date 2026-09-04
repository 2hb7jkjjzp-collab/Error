import { randomUUID } from "node:crypto";
import { jobsDb } from "@meshal/database";
import type { JobState, QueueName } from "@meshal/shared";
import { logger } from "@meshal/shared";
import { assertValidTransition } from "./stateMachine.js";
import { emit } from "./eventBus.js";
import { enqueue, dequeue, complete, fail, type DequeuedTask } from "./queue.js";

/**
 * Duck-typed agent contract. Deliberately does NOT import @meshal/agents to
 * avoid a circular package dependency — apps/worker wires concrete agent
 * instances into the Orchestrator at startup.
 */
export interface PipelineAgent {
  readonly name: string;
  handle(task: DequeuedTask, runId: string): Promise<AgentOutcome>;
}

export interface AgentOutcome {
  /** Next job state to transition to, if any. */
  nextState?: JobState;
  /** Follow-up queue tasks to enqueue as part of this outcome. */
  enqueueNext?: Array<{ queue: QueueName; job_id?: string; application_id?: string; payload?: Record<string, unknown> }>;
  /** Structured error, if the task failed. When set, the queue task is failed/retried. */
  error?: { code: string; message: string; details?: Record<string, unknown> };
  payload?: Record<string, unknown>;
}

/**
 * Standalone transition helper. This is the ONLY code path allowed to write
 * jobs.status — it validates the move against JOB_STATE_TRANSITIONS and
 * appends an audit event. Exported standalone (not just as an Orchestrator
 * method) so an agent that legitimately needs to walk a job through more
 * than one state within a single run (e.g. ApplicationAgent moving
 * MATCHED -> QUEUED_FOR_APPLICATION -> APPLYING before it starts filling a
 * form) can do so explicitly and traceably, instead of mutating status
 * directly.
 */
export async function transitionJobState(
  jobId: string,
  to: JobState,
  agent: string,
  runId: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const job = await jobsDb.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  assertValidTransition(job.status as JobState, to);
  await jobsDb.setJobStatus(jobId, to);
  await emit({ job_id: jobId, agent, event_type: `job.${to.toLowerCase()}`, run_id: runId, payload: extra });
}

/**
 * The central orchestrator. It owns the workflow: it pulls due tasks off the
 * durable queue, dispatches them to the responsible agent, validates and
 * persists the resulting job-state transition, and enqueues whatever comes
 * next. Agents themselves never write job.status directly.
 */
export class Orchestrator {
  private agents = new Map<QueueName, PipelineAgent>();

  register(queue: QueueName, agent: PipelineAgent): void {
    this.agents.set(queue, agent);
  }

  async transitionJob(jobId: string, to: JobState, agent: string, runId: string, extra: Record<string, unknown> = {}): Promise<void> {
    return transitionJobState(jobId, to, agent, runId, extra);
  }

  /** Processes one batch of due tasks for a single queue. Returns tasks processed. */
  async runQueueOnce(queue: QueueName, workerId: string, batchSize = 5): Promise<number> {
    const agent = this.agents.get(queue);
    if (!agent) {
      logger.warn("No agent registered for queue", { event: "orchestrator.no_agent", queue });
      return 0;
    }
    const tasks = await dequeue(queue, workerId, batchSize);
    for (const task of tasks) {
      const runId = randomUUID();
      const startedAt = Date.now();
      try {
        const outcome = await agent.handle(task, runId);
        if (outcome.error) {
          await fail(task.id, outcome.error, task.attempts, task.max_attempts);
          if (task.job_id) {
            await emit({
              job_id: task.job_id,
              application_id: task.application_id,
              agent: agent.name,
              event_type: "application.needs_action",
              run_id: runId,
              payload: { queue },
              error: { code: outcome.error.code, message: outcome.error.message } as any,
            });
          }
        } else {
          if (task.job_id && outcome.nextState) {
            await this.transitionJob(task.job_id, outcome.nextState, agent.name, runId, outcome.payload);
          }
          for (const next of outcome.enqueueNext ?? []) {
            await enqueue({
              queue: next.queue,
              job_id: next.job_id ?? task.job_id ?? undefined,
              application_id: next.application_id ?? task.application_id ?? undefined,
              payload: next.payload,
            });
          }
          await complete(task.id);
        }
      } catch (err) {
        const error = { code: "ENGINEERING_ERROR", message: err instanceof Error ? err.message : String(err) };
        await fail(task.id, error, task.attempts, task.max_attempts);
        await emit({
          job_id: task.job_id,
          application_id: task.application_id,
          agent: agent.name,
          event_type: "agent.error",
          run_id: runId,
          error: error as any,
        });
      } finally {
        logger.debug("Task processed", { event: "orchestrator.task_processed", queue, duration_ms: Date.now() - startedAt });
      }
    }
    return tasks.length;
  }

  async runAllQueuesOnce(workerId: string): Promise<void> {
    for (const queue of this.agents.keys()) {
      await this.runQueueOnce(queue, workerId);
    }
  }
}
