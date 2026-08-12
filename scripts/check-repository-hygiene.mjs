import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

import { findRepositoryHygieneIssues } from "./repository-hygiene.mjs";

const maximumTextFileBytes = 1_000_000;
const paths = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter((path) => path && existsSync(path));

const files = paths.map((path) => {
  if (statSync(path).size > maximumTextFileBytes) {
    return { path };
  }

  const buffer = readFileSync(path);
  return buffer.includes(0) ? { path } : { path, content: buffer.toString() };
});
const issues = findRepositoryHygieneIssues(files);

if (issues.length > 0) {
  const summary = issues
    .map((issue) => `- ${issue.path}: ${issue.rule}`)
    .join("\n");
  process.stderr.write(
    `Repository hygiene check failed. Matched values are intentionally hidden.\n${summary}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Repository hygiene check passed for ${files.length} tracked or unignored files.\n`,
  );
}
