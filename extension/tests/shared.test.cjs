const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeApiUrl,
  hasAcceptedSignal,
  problemSlug,
} = require("../shared.js");

test("normalizes tracker API URLs", () => {
  assert.equal(normalizeApiUrl(" https://tracker.example.com/// "), "https://tracker.example.com");
});

test("detects platform-specific acceptance signals", () => {
  assert.equal(hasAcceptedSignal("Result: Accepted", "leetcode"), true);
  assert.equal(hasAcceptedSignal("Correct Answer", "gfg"), true);
  assert.equal(hasAcceptedSignal("Wrong Answer", "leetcode"), false);
});

test("extracts a canonical problem slug", () => {
  assert.equal(problemSlug("/problems/two-sum/description/"), "two-sum");
  assert.equal(problemSlug("/contest/weekly"), null);
});