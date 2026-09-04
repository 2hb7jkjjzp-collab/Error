import { test } from "node:test";
import assert from "node:assert/strict";
import { jobFingerprint } from "../packages/shared/src/ids.js";

test("same job from two sources produces the same fingerprint", () => {
  const a = jobFingerprint({ employer: "Acme Corp", externalJobId: "123", canonicalApplicationUrl: "https://jobs.lever.co/acme/123", atsTenant: "acme" });
  const b = jobFingerprint({ employer: "acme corp", externalJobId: "123", canonicalApplicationUrl: "https://jobs.lever.co/acme/123/", atsTenant: "ACME" });
  assert.equal(a, b);
});

test("different postings produce different fingerprints", () => {
  const a = jobFingerprint({ employer: "Acme Corp", externalJobId: "123", canonicalApplicationUrl: "https://jobs.lever.co/acme/123", atsTenant: "acme" });
  const b = jobFingerprint({ employer: "Acme Corp", externalJobId: "456", canonicalApplicationUrl: "https://jobs.lever.co/acme/456", atsTenant: "acme" });
  assert.notEqual(a, b);
});
