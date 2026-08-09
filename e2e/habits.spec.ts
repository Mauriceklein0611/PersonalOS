import { expect, test } from "@playwright/test";

test("creates a habit, checks it in and reflects it in the week view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/gewohnheiten");

  await page.getByRole("button", { name: "Neue Gewohnheit" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  // Genau der heutige Wochentag: Damit ist die Gewohnheit heute fällig, und
  // die übrigen sechs Tage der Woche sind es nicht — an jedem Wochentag.
  // Mit dem täglichen Vorgaberhythmus wären die nicht fälligen Tage nur die
  // vor dem Startdatum, an einem Montag also keiner (Issue #102).
  await page
    .getByRole("combobox", { name: /Rhythmus/ })
    .selectOption("weekdays");
  await page.getByRole("checkbox", { name: weekdayName(new Date()) }).check();
  await page.getByRole("button", { name: "Gewohnheit anlegen" }).click();

  const card = page.getByRole("article", { name: "Abendspaziergang" });
  await expect(card).toBeVisible();

  await page.reload();
  await expect(card).toBeVisible();

  await page
    .getByRole("button", { name: "„Abendspaziergang“ heute erledigen" })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Heute schon erfasst" }),
  ).toBeVisible();
  await expect(card.getByText("Erledigt", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /^Woche/ }).click();
  // Das Wochendiagramm bringt seine Werte als eigene Tabelle mit; gemeint ist
  // hier das Raster.
  const weekTable = page.getByRole("table", {
    name: /Zeichen und als Text in der Zelle/,
  });
  await expect(weekTable).toBeVisible();
  await expect(
    weekTable.getByRole("button", { name: /Abendspaziergang.*Erledigt/ }),
  ).toBeVisible();
  // Nicht fällige Tage sind keine Schaltfläche, nennen ihren Zustand aber als
  // Text für assistive Technik.
  await expect(weekTable.getByText(/: Nicht fällig$/).first()).toBeAttached();

  await page.getByRole("tab", { name: /^Fortschritt/ }).click();
  await expect(page.getByText(/Zeitraum: /)).toBeVisible();
  await expect(page.getByText(/Berechnungsbasis: /)).toBeVisible();
  // Die Karte erklärt den Unterschied zwischen übersprungen und nicht erfasst.
  await expect(
    page.getByText(/Ein geplanter Tag ohne Eintrag gilt als nicht erfasst/),
  ).toBeVisible();

  await page.getByRole("tab", { name: /^Heute/ }).click();
  await page
    .getByRole("button", { name: "„Abendspaziergang“ archivieren" })
    .click();
  await expect(card).toBeHidden();
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(card).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

/** Der deutsche Wochentagsname, wie ihn der Gewohnheits-Editor beschriftet. */
function weekdayName(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(date);
}
