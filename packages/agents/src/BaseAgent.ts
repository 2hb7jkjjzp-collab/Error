import type { PipelineAgent, AgentOutcome } from "@meshal/orchestration";
import type { DequeuedTask } from "@meshal/orchestration";
import { emit } from "@meshal/orchestration";
import { MeshalError, ErrorCode } from "@meshal/shared";

/**
 * Shared base: every concrete agent is independently executable, observable
 * (emits events), retryable (throws MeshalError -> queue retry/backoff), and
 * replaceable (implements the same PipelineAgent contract). A failure in one
 * agent never crashes the process — errors are caught by the orchestrator's
 * runQueueOnce loop and turned into a retry or dead-letter outcome.
 */
export abstract class BaseAgent implements PipelineAgent {
  abstract readonly name: string;

  async handle(task: DequeuedTask, runId: string): Promise<AgentOutcome> {
    await emit({
      job_id: task.job_id,
      application_id: task.application_id,
      agent: this.name,
      event_type: `${this.name}.started`,
      run_id: runId,
      payload: { queue: task.queue, attempt: task.attempts },
    });
    try {
      const outcome = await this.process(task, runId);
      await emit({
        job_id: task.job_id,
        application_id: task.application_id,
        agent: this.name,
        event_type: `${this.name}.finished`,
        run_id: runId,
        payload: { ok: !outcome.error },
      });
      return outcome;
    } catch (err) {
      const meshalErr =
        err instanceof MeshalError ? err : new MeshalError(ErrorCode.ENGINEERING_ERROR, err instanceof Error ? err.message : String(err));
      return { error: { code: meshalErr.code, message: meshalErr.message, details: meshalErr.details } };
    }
  }

  protected abstract process(task: DequeuedTask, runId: string): Promise<AgentOutcome>;
}
