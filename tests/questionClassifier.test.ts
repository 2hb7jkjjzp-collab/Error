import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyQuestion, resolveAnswer } from "../packages/browser/src/questionClassifier.js";
import { AnswerCategory } from "../packages/shared/src/types.js";

test("classifies work authorization questions", () => {
  assert.equal(classifyQuestion("Are you legally authorized to work in Saudi Arabia?"), AnswerCategory.WORK_AUTHORIZATION);
});

test("classifies salary questions", () => {
  assert.equal(classifyQuestion("What is your expected salary?"), AnswerCategory.SALARY);
});

test("never fabricates a required legal answer with no known match", () => {
  const result = resolveAnswer("Have you ever been convicted of a criminal offense?", true, []);
  assert.equal(result.canAutoAnswer, false);
  assert.equal(result.answer, null);
});

test("leaves optional unknown fields blank instead of guessing", () => {
  const result = resolveAnswer("Any additional comments?", false, []);
  assert.equal(result.canAutoAnswer, true);
  assert.equal(result.answer, null);
});

test("uses a known allowed answer when the pattern matches", () => {
  const result = resolveAnswer("What is your notice period?", true, [
    { id: "1", question_pattern: "notice period", category: AnswerCategory.PROFESSIONAL, answer: "30 days", confidence: 1, source: "user", allowed_for_auto_answer: true },
  ]);
  assert.equal(result.canAutoAnswer, true);
  assert.equal(result.answer, "30 days");
});
