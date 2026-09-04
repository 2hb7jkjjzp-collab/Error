/**
 * Structured JSON logger. Every log line carries the fields required by the
 * observability spec: timestamp, run_id, agent, job_id, application_id,
 * event, status, duration, error_code. Secrets are never logged — callers
 * must pass only redacted/public fields.
 */

export interface LogFields {
  run_id?: string;
  agent?: string;
  job_id?: string;
  application_id?: string;
  event?: string;
  status?: string;
  duration_ms?: number;
  error_code?: string;
  [key: string]: unknown;
}

const SECRET_KEY_PATTERN = /(password|secret|token|credential|cookie|authorization|api_key)/i;

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = SECRET_KEY_PATTERN.test(k) ? "[REDACTED]" : v;
  }
  return out;
}

function emit(level: "info" | "warn" | "error" | "debug", message: string, fields: LogFields = {}) {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(fields),
  };
  const out = JSON.stringify(line);
  if (level === "error") process.stderr.write(out + "\n");
  else process.stdout.write(out + "\n");
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
  debug: (message: string, fields?: LogFields) => {
    if (process.env.LOG_LEVEL === "debug") emit("debug", message, fields);
  },
};
