import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

/**
 * Canonical fingerprint used for idempotency: prevents applying twice to the
 * same vacancy even when discovered from multiple sources.
 */
export function jobFingerprint(input: {
  employer: string;
  externalJobId?: string | null;
  canonicalApplicationUrl?: string | null;
  atsTenant?: string | null;
}): string {
  const key = [
    normalize(input.employer),
    normalize(input.atsTenant ?? ""),
    normalize(input.externalJobId ?? ""),
    normalize(input.canonicalApplicationUrl ?? ""),
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\/+$/, "").replace(/\s+/g, " ");
}
