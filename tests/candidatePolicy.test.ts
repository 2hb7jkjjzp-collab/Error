import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLocation, checkSalary, DEFAULT_CANDIDATE_POLICY } from "../packages/matching/src/candidatePolicy.js";

test("accepts Riyadh location", () => {
  const result = checkLocation({ city: "Riyadh", location: "Riyadh, Saudi Arabia", country: "Saudi Arabia" });
  assert.equal(result.pass, true);
});

test("rejects Jeddah under strict Riyadh policy", () => {
  const result = checkLocation({ city: "Jeddah", location: "Jeddah", country: "Saudi Arabia" });
  assert.equal(result.pass, false);
});

test("rejects salary explicitly below 15,000 SAR", () => {
  const result = checkSalary({ salary_min: 8000, salary_max: 10000, currency: "SAR" });
  assert.equal(result.pass, false);
});

test("does not reject on missing salary", () => {
  const result = checkSalary({ salary_min: null, salary_max: null, currency: null }, DEFAULT_CANDIDATE_POLICY);
  assert.equal(result.pass, true);
});

test("accepts salary at or above the floor", () => {
  const result = checkSalary({ salary_min: 15000, salary_max: 18000, currency: "SAR" });
  assert.equal(result.pass, true);
});
