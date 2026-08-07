import assert from "node:assert/strict";
import test from "node:test";

import {
  bundleBudgets,
  findBundleBudgetIssues,
  summariseMeasurements,
} from "./bundle-budgets.mjs";

const budgets = [
  {
    label: "Startroute",
    pattern: /^index-[^/]+\.js$/,
    maximumGzipBytes: 1_000,
  },
];

test("accepts a chunk inside its budget", () => {
  const issues = findBundleBudgetIssues(
    [{ name: "index-abc123.js", gzipBytes: 999 }],
    budgets,
  );

  assert.deepEqual(issues, []);
});

test("reports a chunk above its budget with both values", () => {
  const issues = findBundleBudgetIssues(
    [{ name: "index-abc123.js", gzipBytes: 1_001 }],
    budgets,
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "exceeded");
  assert.match(issues[0].message, /1\.00 kB/);
});

test("sums every file a budget covers", () => {
  const issues = findBundleBudgetIssues(
    [
      { name: "index-abc123.js", gzipBytes: 600 },
      { name: "index-def456.js", gzipBytes: 600 },
    ],
    budgets,
  );

  assert.equal(issues.length, 1);
});

/*
 * Eine Umbenennung des Chunks darf die Prüfung nicht still ins Leere laufen
 * lassen — sonst bewacht sie nichts mehr.
 */
test("treats a budget without any matching file as a failure", () => {
  const issues = findBundleBudgetIssues(
    [{ name: "renamed-abc123.js", gzipBytes: 100 }],
    budgets,
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, "missing");
});

test("keeps the documented budgets matchable against a real build", () => {
  const summary = summariseMeasurements(
    [
      { name: "index-abc123.js", gzipBytes: 149_070 },
      { name: "index-abc123.css", gzipBytes: 7_000 },
      { name: "ChartCanvas-def456.js", gzipBytes: 179_150 },
      { name: "TodayPage-ghi789.js", gzipBytes: 3_620 },
    ],
    bundleBudgets,
  );

  assert.deepEqual(
    summary.map((entry) => entry.gzipBytes),
    [156_070, 179_150],
  );
  assert.deepEqual(
    findBundleBudgetIssues(
      [
        { name: "index-abc123.js", gzipBytes: 149_070 },
        { name: "index-abc123.css", gzipBytes: 7_000 },
        { name: "ChartCanvas-def456.js", gzipBytes: 179_150 },
      ],
      bundleBudgets,
    ),
    [],
  );
});
