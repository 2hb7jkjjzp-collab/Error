import { eventsDb } from "@meshal/database";
import { logger, type MeshalError } from "@meshal/shared";

export interface EmitEventInput {
  job_id?: string | null;
  application_id?: string | null;
  agent: string;
  event_type: string;
  run_id: string;
  payload?: Record<string, unknown>;
  error?: MeshalError | Error | null;
}

/**
 * Append-only event bus backed by the application_events table. This is the
 * single audit trail every dashboard timeline and agent decision reads from.
 */
export async function emit(input: EmitEventInput): Promise<string> {
  const errorPayload = input.error
    ? "toJSON" in input.error && typeof (input.error as MeshalError).toJSON === "function"
      ? (input.error as MeshalError).toJSON()
      : { message: input.error.message }
    : null;

  const eventId = await eventsDb.recordEvent({
    job_id: input.job_id,
    application_id: input.application_id,
    agent: input.agent,
    event_type: input.event_type,
    run_id: input.run_id,
    payload: input.payload,
    error: errorPayload,
  });

  logger.info(input.event_type, {
    run_id: input.run_id,
    agent: input.agent,
    job_id: input.job_id ?? undefined,
    application_id: input.application_id ?? undefined,
    event: input.event_type,
    error_code: (input.error as MeshalError)?.code,
    error_message: input.error?.message,
  });

  return eventId;
}
