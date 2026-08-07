import { expect, test } from "@playwright/test";

test("walks through a complete synthetic day on the dashboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  await expect(
    page.getByText(
      "Für heute steht keine Aufgabe an. Du kannst den Tag frei einteilen.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Keine offene Aufgabe")).toBeVisible();
  await expect(page.getByText("Nichts fällig")).toBeVisible();

  await page
    .getByRole("textbox", { name: "Aufgabe für heute" })
    .fill("Rechnung prüfen");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(
    page.getByText("Wichtigstes für heute: Rechnung prüfen"),
  ).toBeVisible();

  await page.goto("/gewohnheiten");
  await page.getByRole("button", { name: "Neue Gewohnheit" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  await page.getByRole("button", { name: "Gewohnheit anlegen" }).click();
  await expect(
    page.getByRole("article", { name: "Abendspaziergang" }),
  ).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 3, name: "Abendspaziergang" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "„Abendspaziergang“ heute erledigen" })
    .click();
  await expect(
    page.getByText("Alle 1 fälligen Gewohnheiten sind für heute erfasst."),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "„Rechnung prüfen“ abschließen" })
    .click();
  await expect(page.getByText("Keine offene Aufgabe")).toBeVisible();

  await page.goto("/journal");
  await page
    .getByRole("group", { name: "Stimmung" })
    .getByRole("radio", { name: "4 von 5" })
    .check();
  await page.getByRole("button", { name: "Eintrag speichern" }).click();
  await expect(page.getByText(/^Gespeichert um /)).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByText("Für heute ist eine Reflexion gespeichert."),
  ).toBeVisible();
  await expect(
    page.getByText("Heute erfasste Stimmung: 4 von 5."),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("names the truncation instead of dropping tasks silently", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const quickCapture = page.getByRole("textbox", { name: "Aufgabe für heute" });
  const submit = page.getByRole("button", { name: "Aufgabe hinzufügen" });
  for (let index = 1; index <= 6; index += 1) {
    await quickCapture.fill(`Synthetische Aufgabe ${index}`);
    await submit.click();
    await expect(
      page.getByRole("heading", {
        level: 3,
        name: `Synthetische Aufgabe ${index}`,
      }),
    ).toHaveCount(index <= 5 ? 1 : 0);
  }

  // Die Kachel nennt sechs, die Liste zeigt fünf — und sagt das auch.
  const taskTile = page
    .locator(".ui-metric-tile")
    .filter({ has: page.getByText("Aufgaben heute", { exact: true }) });
  await expect(taskTile).toContainText("6 offen");
  await expect(page.getByText("5 von 6 gezeigt.")).toBeVisible();

  await page.getByRole("link", { name: "Alle Aufgaben ansehen" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Aufgaben" }),
  ).toBeVisible();
  // Die Schnellerfassung plant für heute; dort steht die sechste Aufgabe.
  await page.getByRole("tab", { name: "Heute" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Synthetische Aufgabe 6" }),
  ).toBeVisible();
});

test("books an expense from the dashboard in a few steps", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });

  // Die Startkategorien entstehen beim ersten Besuch des Finanzbereichs.
  await page.goto("/finanzen");
  await expect(
    page.getByRole("heading", { level: 2, name: "Buchung erfassen" }),
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("textbox", { name: /Betrag der Ausgabe/ }).fill("12,50");
  await page
    .getByRole("combobox", { name: /Kategorie der Ausgabe/ })
    .selectOption({ label: "Lebensmittel" });
  await page.getByRole("button", { name: "Ausgabe buchen" }).click();
  await expect(
    page.getByText("Die Ausgabe über 12,50 wurde gebucht."),
  ).toBeVisible();

  // Dieselbe Buchung steht im Finanzbereich, mit heutigem Datum.
  await page.goto("/finanzen");
  const expenseTile = page
    .locator(".ui-metric-tile")
    .filter({ has: page.getByText("Ausgaben", { exact: true }) });
  await expect(expenseTile).toContainText("12,50");

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("puts capture before evaluation on the finance page", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/finanzen");

  const captureBox = await page
    .getByRole("heading", { level: 2, name: "Buchung erfassen" })
    .boundingBox();
  const overviewBox = await page
    .getByRole("heading", { level: 2, name: "Monatsübersicht" })
    .boundingBox();

  expect(captureBox?.y ?? 0).toBeLessThan(overviewBox?.y ?? 0);
});
