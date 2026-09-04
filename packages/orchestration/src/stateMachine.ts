import { JOB_STATE_TRANSITIONS, type JobState } from "@meshal/shared";

export class InvalidTransitionError extends Error {
  constructor(from: JobState, to: JobState) {
    super(`Invalid job state transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * The orchestrator is the ONLY place allowed to move a job between states.
 * Agents never mutate job.status directly — they request a transition here,
 * which validates it against the allowed-transitions table and persists it.
 * This guarantees a job can never silently disappear from the pipeline.
 */
export function assertValidTransition(from: JobState, to: JobState): void {
  const allowed = JOB_STATE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function isTerminalState(state: JobState): boolean {
  return (JOB_STATE_TRANSITIONS[state] ?? []).length === 0;
}
