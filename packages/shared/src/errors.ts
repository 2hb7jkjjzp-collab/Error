/**
 * Explicit error taxonomy for the whole platform.
 * Every failure raised by an agent MUST map to one of these codes so the
 * orchestrator, dashboard, and audit trail can reason about it precisely.
 * Never invent a vague ad-hoc error string as the final diagnosis.
 */
export const ErrorCode = {
  JOB_CLOSED: "JOB_CLOSED",
  DUPLICATE_JOB: "DUPLICATE_JOB",
  LOCATION_REJECTED: "LOCATION_REJECTED",
  SALARY_BELOW_MINIMUM: "SALARY_BELOW_MINIMUM",
  MATCH_REJECTED: "MATCH_REJECTED",
  ATS_UNSUPPORTED: "ATS_UNSUPPORTED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  ACCOUNT_VERIFICATION_REQUIRED: "ACCOUNT_VERIFICATION_REQUIRED",
  REQUIRED_UNKNOWN_FIELD: "REQUIRED_UNKNOWN_FIELD",
  LEGAL_ANSWER_REQUIRED: "LEGAL_ANSWER_REQUIRED",
  HUMAN_VERIFICATION_REQUIRED: "HUMAN_VERIFICATION_REQUIRED",
  NAVIGATION_TIMEOUT: "NAVIGATION_TIMEOUT",
  ATS_TEMPORARY_ERROR: "ATS_TEMPORARY_ERROR",
  SUBMISSION_UNVERIFIED: "SUBMISSION_UNVERIFIED",
  ENGINEERING_ERROR: "ENGINEERING_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Codes that represent ordinary, retryable technical failures. */
export const RETRYABLE_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.NAVIGATION_TIMEOUT,
  ErrorCode.ATS_TEMPORARY_ERROR,
  ErrorCode.SESSION_EXPIRED,
  ErrorCode.ENGINEERING_ERROR,
]);

/** Codes that require a human ("needs action") rather than a retry. */
export const NEEDS_ACTION_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.ACCOUNT_VERIFICATION_REQUIRED,
  ErrorCode.REQUIRED_UNKNOWN_FIELD,
  ErrorCode.LEGAL_ANSWER_REQUIRED,
  ErrorCode.HUMAN_VERIFICATION_REQUIRED,
  ErrorCode.LOGIN_REQUIRED,
]);

export class MeshalError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "MeshalError";
    this.code = code;
    this.details = details;
    this.retryable = RETRYABLE_ERROR_CODES.has(code);
  }

  get needsAction(): boolean {
    return NEEDS_ACTION_ERROR_CODES.has(this.code);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details ?? null,
      retryable: this.retryable,
      needsAction: this.needsAction,
    };
  }
}
