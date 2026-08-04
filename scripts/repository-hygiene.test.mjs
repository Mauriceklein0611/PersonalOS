import assert from "node:assert/strict";
import test from "node:test";

import { findRepositoryHygieneIssues } from "./repository-hygiene.mjs";

test("detects PersonalOS exports by path and JSON envelope", () => {
  const issues = findRepositoryHygieneIssues([
    { path: "personalos-backup-20260804T120000000Z.json", content: "{}" },
    {
      path: "fixtures/innocent-name.json",
      content: JSON.stringify({ format: "personalos" }),
    },
  ]);

  assert.deepEqual(
    issues.map((issue) => issue.rule),
    ["PersonalOS export file", "PersonalOS export content"],
  );
});

test("detects representative provider tokens without printing their values", () => {
  const simulatedAccessKey = "AKIA" + "A".repeat(16);
  const issues = findRepositoryHygieneIssues([
    { path: "src/config.ts", content: simulatedAccessKey },
  ]);

  assert.deepEqual(issues, [{ path: "src/config.ts", rule: "AWS access key" }]);
});

test("rejects raw application logging and unsafe HTML escape hatches", () => {
  const rawLog = "console" + ".log(entry)";
  const rawHtml = "dangerously" + "SetInnerHTML";
  const issues = findRepositoryHygieneIssues([
    { path: "src/example.tsx", content: `${rawLog} ${rawHtml}` },
  ]);

  assert.deepEqual(
    issues.map((issue) => issue.rule),
    [
      "raw console logging in application code",
      "unreviewed raw HTML rendering",
    ],
  );
});

test("allows documented environment templates", () => {
  assert.deepEqual(
    findRepositoryHygieneIssues([
      { path: ".env.example", content: "SETTING=synthetic" },
    ]),
    [],
  );
});
