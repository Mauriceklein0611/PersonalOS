import { expect, test, type Page } from "@playwright/test";

import { buildLargeDataset } from "../src/test/fixtures/large-dataset";

/**
 * Start- und Interaktionsbudgets bei mehrjährigem Bestand, Issue #28.
 *
 * Die Abfragebudgets in `src/db/performance-budgets.test.ts` sind
 * deterministisch und die eigentliche Absicherung. Diese Prüfung ergänzt sie
 * um das, was nur ein echter Browser zeigt: dass die Seite mit dem Bestand
 * überhaupt erscheint und bedienbar bleibt.
 *
 * Die Zeitgrenzen sind bewusst großzügig. Sie sollen einen Einbruch um eine
 * Größenordnung fangen, nicht eine Millisekunde bewerten; ein geteilter Läufer
 * gibt eine feinere Aussage nicht her. Die gemessenen Werte stehen in
 * `docs/PERFORMANCE.md`.
 */
const dataset = buildLargeDataset({ days: 730, habitCount: 12 });

const seedTables = {
  financeCategories: dataset.categories,
  habits: dataset.habits,
  habitEntries: dataset.habitEntries,
  journalEntries: dataset.journalEntries,
  monthlyBudgets: dataset.monthlyBudgets,
  tasks: dataset.tasks,
  transactions: dataset.transactions,
};

/*
 * Lokal gemessen (11.08.2026): Tagesübersicht 108 ms, Check-in 95 ms,
 * Finanzbereich 255 ms. Die Grenzen liegen rund zehnfach darüber, weil ein
 * geteilter CI-Läufer deutlich langsamer sein darf, ohne dass daran etwas
 * kaputt ist.
 */
const startBudgetMs = 3_000;
const interactionBudgetMs = 2_000;

/** Schreibt den Bestand direkt in die geöffnete Datenbank der App. */
async function seed(page: Page): Promise<void> {
  // Erst besuchen: Dexie legt Datenbank und Tabellen beim ersten Start an.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();

  await page.evaluate(async (tables) => {
    const open = indexedDB.open("personalos");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });

    const names = Object.keys(tables);
    const transaction = database.transaction(names, "readwrite");
    for (const name of names) {
      const store = transaction.objectStore(name);
      for (const record of tables[name as keyof typeof tables]) {
        store.put(record);
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, seedTables);
}

test("opens the dashboard with several years of data", async ({ page }) => {
  await seed(page);

  const started = Date.now();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();
  // Der Ring steht erst, wenn Aufgaben, Routinen und Journal gelesen sind.
  await expect(page.getByText("Tagesfortschritt")).toBeVisible();
  const elapsed = Date.now() - started;

  expect(
    elapsed,
    `Die Tagesübersicht brauchte ${elapsed} ms für den Bestand.`,
  ).toBeLessThan(startBudgetMs);
});

test("keeps a check-in responsive with several years of data", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/routinen/uebersicht");
  await expect(
    page.getByRole("heading", { level: 1, name: "Routinen" }),
  ).toBeVisible();

  // Eine offene Routine des Tages; die Beschriftung nennt sie beim Namen.
  const checkIn = page
    .getByRole("button", { name: /heute (erledigen|doch erledigen)$/ })
    .first();
  await expect(checkIn).toBeVisible();

  const started = Date.now();
  await checkIn.click();
  await expect(
    page.getByRole("button", { name: /heute wieder öffnen$/ }).first(),
  ).toBeVisible();
  const elapsed = Date.now() - started;

  expect(
    elapsed,
    `Der Check-in brauchte ${elapsed} ms für den Bestand.`,
  ).toBeLessThan(interactionBudgetMs);
});

test("opens the finance month with several years of bookings", async ({
  page,
}) => {
  await seed(page);

  const started = Date.now();
  await page.goto("/geld");
  await expect(
    page.getByRole("heading", { level: 2, name: "Monatsübersicht" }),
  ).toBeVisible();
  const elapsed = Date.now() - started;

  expect(
    elapsed,
    `Der Finanzbereich brauchte ${elapsed} ms für den Bestand.`,
  ).toBeLessThan(startBudgetMs);
});
