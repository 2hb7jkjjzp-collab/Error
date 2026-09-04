import { getPool } from "@meshal/database";
import type { QueueName } from "@meshal/shared";
import { logger } from "@meshal/shared";

const BACKOFF_BASE_MS = 30_000; // 30s
const BACKOFF_MAX_MS = 30 * 60_000; // 30min

export interface EnqueueInput {
  queue: QueueName;
  job_id?: string | null;
  application_id?: string | null;
  payload?: Record<string, unknown>;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
}

export interface DequeuedTask {
  id: string;
  queue: QueueName;
  job_id: string | null;
  application_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export async function enqueue(input: EnqueueInput): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO application_queue (queue, job_id, application_id, payload, priority, run_at, max_attempts)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      input.queue,
      input.job_id ?? null,
      input.application_id ?? null,
      JSON.stringify(input.payload ?? {}),
      input.priority ?? 100,
      input.runAt ?? new Date(),
      input.maxAttempts ?? 5,
    ]
  );
  return rows[0].id;
}

/**
 * Atomically claims up to `limit` due tasks from `queue` using
 * FOR UPDATE SKIP LOCKED so multiple worker processes can safely run
 * concurrently without double-processing the same task.
 */
export async function dequeue(
  queue: QueueName,
  workerId: string,
  limit = 1
): Promise<DequeuedTask[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id FROM application_queue
       WHERE queue = $1 AND status = 'PENDING' AND run_at <= now()
       ORDER BY priority ASC, run_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $2`,
      [queue, limit]
    );
    if (rows.length === 0) {
      await client.query("COMMIT");
      return [];
    }
    const ids = rows.map((r: { id: string }) => r.id);
    const { rows: claimed } = await client.query(
      `UPDATE application_queue
       SET status = 'RUNNING', locked_at = now(), locked_by = $2, attempts = attempts + 1, updated_at = now()
       WHERE id = ANY($1::uuid[])
       RETURNING id, queue, job_id, application_id, payload, attempts, max_attempts`,
      [ids, workerId]
    );
    await client.query("COMMIT");
    return claimed as DequeuedTask[];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function complete(taskId: string): Promise<void> {
  await getPool().query(
    "UPDATE application_queue SET status = 'DONE', updated_at = now() WHERE id = $1",
    [taskId]
  );
}

function backoffDelayMs(attempts: number): number {
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempts - 1);
  return Math.min(delay, BACKOFF_MAX_MS);
}

/**
 * Marks a task failed. If attempts remain, reschedules with exponential
 * backoff (status back to PENDING). Once max_attempts is exhausted, the task
 * moves to DEAD_LETTER — it is never silently dropped.
 */
export async function fail(
  taskId: string,
  error: Record<string, unknown>,
  attempts: number,
  maxAttempts: number
): Promise<"retry_scheduled" | "dead_letter"> {
  if (attempts < maxAttempts) {
    const delay = backoffDelayMs(attempts);
    await getPool().query(
      `UPDATE application_queue
       SET status = 'PENDING', run_at = now() + ($2 || ' milliseconds')::interval,
           last_error = $3, locked_at = NULL, locked_by = NULL, updated_at = now()
       WHERE id = $1`,
      [taskId, String(delay), JSON.stringify(error)]
    );
    logger.warn("Task failed, retry scheduled", {
      event: "queue.retry_scheduled",
      task_id: taskId,
      delay_ms: delay,
      error_code: error.code as string | undefined,
      error_message: error.message as string | undefined,
    });
    return "retry_scheduled";
  }
  await getPool().query(
    `UPDATE application_queue SET status = 'DEAD_LETTER', last_error = $2, updated_at = now() WHERE id = $1`,
    [taskId, JSON.stringify(error)]
  );
  logger.error("Task moved to dead letter", {
    event: "queue.dead_letter",
    task_id: taskId,
    error_code: error.code as string | undefined,
    error_message: error.message as string | undefined,
  });
  return "dead_letter";
}

export async function queueDepth(queue: QueueName): Promise<number> {
  const { rows } = await getPool().query<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM application_queue WHERE queue = $1 AND status = 'PENDING'",
    [queue]
  );
  return Number(rows[0].count);
}

export async function deadLetterTasks(queue?: QueueName) {
  const pool = getPool();
  if (queue) {
    const { rows } = await pool.query(
      "SELECT * FROM application_queue WHERE status = 'DEAD_LETTER' AND queue = $1 ORDER BY updated_at DESC",
      [queue]
    );
    return rows;
  }
  const { rows } = await pool.query(
    "SELECT * FROM application_queue WHERE status = 'DEAD_LETTER' ORDER BY updated_at DESC"
  );
  return rows;
}
