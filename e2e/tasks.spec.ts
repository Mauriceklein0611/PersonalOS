import { expect, test } from "@playwright/test";

test("persists a task through editing, completion, reopening and archive undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/aufgaben");

  await page
    .getByRole("textbox", { name: "Neue Aufgabe" })
    .fill("Rechnung prüfen");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /bearbeiten$/ }).click();
  await page
    .getByRole("textbox", { name: "Notiz" })
    .fill("Vor der Frist kontrollieren");
  await page.getByRole("combobox", { name: "Priorität" }).selectOption("high");
  await page
    .getByRole("combobox", { name: "Kategorie" })
    .selectOption("00000000-0000-4000-8000-000000000903");
  await page
    .getByRole("spinbutton", { name: "Schätzung in Minuten" })
    .fill("20");
  await page.getByRole("button", { name: "Änderungen speichern" }).click();

  await expect(page.getByText("Vor der Frist kontrollieren")).toBeVisible();
  await expect(page.getByText("Erledigungen")).toBeVisible();
  await expect(page.getByText("20 Min.")).toBeVisible();

  // Wiederfinden: Die Suche greift über Titel und Notiz und nennt die Treffer.
  const search = page.getByRole("searchbox", { name: "Aufgaben durchsuchen" });
  await search.fill("frist");
  await expect(
    page.getByText("1 von 1 Aufgaben in dieser Ansicht"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeVisible();
  await search.fill("Segeltörn");
  await expect(page.getByText("Kein Treffer")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeHidden();
  await search.fill("");
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /abschließen$/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeHidden();
  await page.getByRole("tab", { name: /^Erledigt/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article", { name: "Rechnung prüfen" })
      .getByText("Erledigt", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: /wieder öffnen$/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeHidden();
  await page.getByRole("tab", { name: /^Inbox/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /abbrechen$/ }).click();
  await page.getByRole("tab", { name: /^Erledigt/ }).click();
  await expect(page.getByText("Abgebrochen", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /archivieren$/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
