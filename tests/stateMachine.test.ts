import { test } from "node:test";
import assert from "node:assert/strict";
import { assertValidTransition, InvalidTransitionError, isTerminalState } from "../packages/orchestration/src/stateMachine.js";
import { JobState } from "../packages/shared/src/types.js";

test("allows DISCOVERED -> VERIFYING", () => {
  assert.doesNotThrow(() => assertValidTransition(JobState.DISCOVERED, JobState.VERIFYING));
});

test("rejects skipping straight to SUBMITTED", () => {
  assert.throws(() => assertValidTransition(JobState.DISCOVERED, JobState.SUBMITTED), InvalidTransitionError);
});

test("rejects leaving a terminal state", () => {
  assert.ok(isTerminalState(JobState.REJECTED_BY_FILTER));
  assert.throws(() => assertValidTransition(JobState.REJECTED_BY_FILTER, JobState.VERIFYING), InvalidTransitionError);
});

test("SUBMITTED can move to REPLIED/INTERVIEW/OFFER/REJECTED", () => {
  assert.doesNotThrow(() => assertValidTransition(JobState.SUBMITTED, JobState.INTERVIEW));
  assert.doesNotThrow(() => assertValidTransition(JobState.SUBMITTED, JobState.REJECTED));
});
