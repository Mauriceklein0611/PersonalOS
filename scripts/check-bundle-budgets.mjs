import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import {
  findBundleBudgetIssues,
  formatKilobytes,
  summariseMeasurements,
} from "./bundle-budgets.mjs";

const assetDirectory = join("dist", "assets");

let entries;
try {
  entries = readdirSync(assetDirectory, { withFileTypes: true });
} catch {
  process.stderr.write(
    `Kein Build gefunden. Erwartet wird ${assetDirectory}; führe zuerst „pnpm build" aus.\n`,
  );
  process.exitCode = 1;
  entries = undefined;
}

if (entries !== undefined) {
  const measurements = entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      gzipBytes: gzipSync(readFileSync(join(assetDirectory, entry.name)), {
        level: 9,
      }).byteLength,
    }));

  const summary = summariseMeasurements(measurements)
    .map(
      (entry) =>
        `- ${entry.label}: ${formatKilobytes(entry.gzipBytes)} von ${formatKilobytes(entry.maximumGzipBytes)} gzip`,
    )
    .join("\n");
  const issues = findBundleBudgetIssues(measurements);

  if (issues.length > 0) {
    process.stderr.write(
      `Bundle-Budget verletzt.\n${issues.map((issue) => `- ${issue.message}`).join("\n")}\n\nGemessen:\n${summary}\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(`Bundle-Budgets eingehalten.\n${summary}\n`);
  }
}
