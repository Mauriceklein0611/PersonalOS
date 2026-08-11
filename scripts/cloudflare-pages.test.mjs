import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

const sortedPolicyDirectives = (policy) =>
  policy
    .replace(/^Content-Security-Policy:\s*/, "")
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean)
    .sort();

const pathDoesNotExist = async (path) => {
  try {
    await stat(path);
    return false;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return true;
    }
    throw error;
  }
};

test("pins the Cloudflare Pages build toolchain", async () => {
  const [nodeVersion, packageJson] = await Promise.all([
    readText(".nvmrc"),
    readText("package.json").then(JSON.parse),
  ]);

  assert.equal(nodeVersion.trim(), "24");
  assert.equal(packageJson.packageManager, "pnpm@11.20.0");
  assert.equal(packageJson.engines.node, ">=24.0.0 <25");
  assert.equal(packageJson.engines.pnpm, "11.20.0");
  assert.equal(packageJson.scripts.build, "tsc -b && vite build");
});

test("keeps the Cloudflare SPA fallback enabled", async () => {
  assert.equal(await pathDoesNotExist("public/404.html"), true);
  assert.equal(await pathDoesNotExist("public/_redirects"), true);
});

test("ships the production security policy as Pages headers", async () => {
  const [headers, indexHtml] = await Promise.all([
    readText("public/_headers"),
    readText("index.html"),
  ]);
  const headerLines = headers.split(/\r?\n/);
  const cspHeader = headerLines
    .find((line) => line.trimStart().startsWith("Content-Security-Policy:"))
    ?.trim();
  const metaPolicy = indexHtml.match(
    /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
  )?.[1];

  assert.ok(cspHeader);
  assert.ok(metaPolicy);
  assert.deepEqual(
    sortedPolicyDirectives(cspHeader),
    [...sortedPolicyDirectives(metaPolicy), "frame-ancestors 'none'"].sort(),
  );
  assert.match(headers, /^\/\*$/m);
  assert.match(headers, /^  Permissions-Policy: /m);
  assert.match(headers, /^  Referrer-Policy: no-referrer$/m);
  assert.match(headers, /^  Strict-Transport-Security: max-age=31536000$/m);
  assert.match(headers, /^  X-Content-Type-Options: nosniff$/m);
  assert.match(headers, /^  X-Frame-Options: DENY$/m);
  assert.equal(
    headerLines.every((line) => line.length <= 2_000),
    true,
  );
});
