import { test } from "node:test";
import assert from "node:assert/strict";
import { professionalPreFilter } from "../packages/matching/src/professionalFilter.js";

test("accepts a Senior Accountant role", () => {
  const result = professionalPreFilter("Senior Accountant", "Manage general ledger and financial reporting.");
  assert.equal(result.pass, true);
});

test("accepts Financial Controller", () => {
  const result = professionalPreFilter("Financial Controller", null);
  assert.equal(result.pass, true);
});

test("rejects Pilates Coach", () => {
  const result = professionalPreFilter("Pilates Coach", "Lead group fitness classes.");
  assert.equal(result.pass, false);
});

test("rejects Software Developer with no finance context", () => {
  const result = professionalPreFilter("Software Developer", "Build React apps.");
  assert.equal(result.pass, false);
});

test("accepts a hybrid role only when finance context appears", () => {
  const result = professionalPreFilter("Finance Systems Developer", "Maintain the finance reporting ERP and tax compliance systems.");
  assert.equal(result.pass, true);
});
