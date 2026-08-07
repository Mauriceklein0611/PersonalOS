import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const tableNames = [
  "settings",
  "tasks",
  "habits",
  "habitEntries",
  "journalEntries",
  "goals",
  "goalMilestones",
  "financeCategories",
  "transactions",
  "monthlyBudgets",
  "savingsGoals",
  "savingsContributions",
  "scoreSettings",
  "scoreSnapshots",
] as const;

test("previews a validated backup and downloads safety data before replace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/einstellungen");

  const emptyCollections = Object.fromEntries(
    tableNames.map((tableName) => [tableName, []]),
  );
  const zeroCounts = Object.fromEntries(
    tableNames.map((tableName) => [tableName, 0]),
  );
  const backup = {
    format: "personalos",
    formatVersion: 1,
    schemaVersion: 2,
    exportedAt: "2026-08-04T08:30:00.000Z",
    appVersion: "0.0.0",
    counts: zeroCounts,
    data: emptyCollections,
  };

  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "synthetic-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });

  await expect(page.getByText("synthetic-backup.json")).toBeVisible();
  await expect(page.getByText(/0 Datensätze/)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Lokale Daten durch Backup ersetzen" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Lokale Daten vollständig ersetzen?" }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Sicherheitsbackup laden und ersetzen" })
    .click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^personalos-backup-\d{8}T\d{9}Z\.json$/,
  );
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "vollständig wiederhergestellt" }),
  ).toBeVisible();
});

test("restores the stored theme after export, deletion and import", async ({
  page,
}) => {
  await page.goto("/einstellungen");
  await page.getByLabel("Farbschema").selectOption("dark");

  // Ohne den Spiegel kann das Theme nach dem Neuladen nur aus der lokalen
  // Datenbank stammen.
  await page.evaluate(() => localStorage.removeItem("personalos.theme.v1"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const exportPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Vollständigen Export herunterladen" })
    .click();
  const exportedBackup = await readFile(await (await exportPromise).path());

  await page
    .getByRole("button", { name: "Alle lokalen Daten löschen" })
    .click();
  const safetyPromise = page.waitForEvent("download");
  const reloadPromise = page.waitForEvent("load");
  await page
    .getByRole("button", { name: "Backup herunterladen und endgültig löschen" })
    .click();
  await safetyPromise;
  await reloadPromise;
  await expect(page.getByLabel("Farbschema")).toHaveValue("system");

  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "personalos-backup.json",
    mimeType: "application/json",
    buffer: exportedBackup,
  });
  await page
    .getByRole("button", { name: "Lokale Daten durch Backup ersetzen" })
    .click();
  const restoreSafetyPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Sicherheitsbackup laden und ersetzen" })
    .click();
  await restoreSafetyPromise;

  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "vollständig wiederhergestellt" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Farbschema")).toHaveValue("dark");
});

test("rejects invalid backup files without offering replacement", async ({
  page,
}) => {
  await page.goto("/einstellungen");
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("not-json"),
  });

  await expect(page.getByRole("alert")).toContainText("Backup ist ungültig");
  await expect(
    page.getByRole("button", { name: "Lokale Daten durch Backup ersetzen" }),
  ).toHaveCount(0);
});
