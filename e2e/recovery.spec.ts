import { expect, test } from "@playwright/test";

test("blocks the normal app and explains recovery when IndexedDB cannot open", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const failingIndexedDb = Object.create(window.indexedDB) as IDBFactory;
    Object.defineProperty(failingIndexedDb, "open", {
      value: () => {
        throw new DOMException("Simulierter Fehler", "UnknownError");
      },
    });
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: failingIndexedDb,
    });
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Die lokalen Daten konnten nicht aktualisiert werden.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeHidden();
  await expect(page.getByText(/vorhandenen Export/)).toBeVisible();

  await page.getByRole("button", { name: "Lokale Daten zurücksetzen" }).click();
  await expect(
    page.getByRole("dialog", {
      name: "Lokale Daten wirklich zurücksetzen?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
