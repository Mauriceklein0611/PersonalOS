import { expect, test } from "@playwright/test";

test("creates a habit, checks it in and reflects it in the week view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/routinen");

  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  // Genau der heutige Wochentag: Damit ist die Routine heute fällig, und
  // die übrigen sechs Tage der Woche sind es nicht — an jedem Wochentag.
  // Mit dem täglichen Vorgaberhythmus wären die nicht fälligen Tage nur die
  // vor dem Startdatum, an einem Montag also keiner (Issue #102).
  await page
    .getByRole("combobox", { name: /Rhythmus/ })
    .selectOption("weekdays");
  await page.getByRole("checkbox", { name: weekdayName(new Date()) }).check();
  await page.getByRole("button", { name: "Routine anlegen" }).click();

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

/** Der deutsche Wochentagsname, wie ihn der Routinen-Editor beschriftet. */
function weekdayName(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(date);
}

/*
 * #121: Vorher standen Diagramm, Tageswerte und Serien vor dem Raster. Auf
 * Mobil lag damit das einzige interaktive Element der Wochenansicht weit
 * unter dem ersten Bildschirm — „Erfassen vor Auswerten“ galt hier nicht.
 */
test("puts the check-in grid before the evaluation in the week view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const chartRequests: string[] = [];
  page.on("request", (request) => {
    if (/ChartCanvas|echarts/i.test(request.url())) {
      chartRequests.push(request.url());
    }
  });

  await page.goto("/routinen/uebersicht");

  // Der Installationshinweis steht im Fluss und verschiebt sonst die Messung.
  const installHint = page.getByText(
    "PersonalOS kann jetzt ohne Netzwerk gestartet werden.",
  );
  await expect(installHint).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Hinweis schließen" }).click();

  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  await page.getByRole("button", { name: "Routine anlegen" }).click();

  await page.getByRole("tab", { name: /^Woche/ }).click();
  const grid = page.getByRole("region", {
    name: "Wochenstatus, horizontal scrollbar",
  });
  await expect(grid).toBeVisible();

  // Das Raster beginnt im ersten Bildschirm, ohne an einem Diagramm vorbei.
  const gridBox = await grid.boundingBox();
  expect(gridBox!.y).toBeLessThan(844);

  const analysis = page.getByText("Auswertung dieser Woche");
  const analysisBox = await analysis.boundingBox();
  expect(analysisBox!.y).toBeGreaterThan(gridBox!.y);

  // Solange die Auswertung zu ist, wird die Diagrammbibliothek nicht geholt.
  expect(chartRequests).toHaveLength(0);

  await analysis.click();
  await expect(page.getByText("Wochenverlauf", { exact: true })).toBeVisible();
  await expect
    .poll(() => chartRequests.length, { timeout: 10_000 })
    .toBeGreaterThan(0);
});

/*
 * #122: Das Monatsraster rechnet nach der bestehenden Semantik und lädt keine
 * Diagrammbibliothek. Es ist die Ansicht selbst, nicht ihre Auswertung.
 */
test("tracks a month without a chart and keeps it available offline", async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });

  const chartRequests: string[] = [];
  page.on("request", (request) => {
    if (/ChartCanvas|echarts/i.test(request.url())) {
      chartRequests.push(request.url());
    }
  });

  await page.goto("/routinen/uebersicht");
  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  await page.getByRole("button", { name: "Routine anlegen" }).click();
  await expect(
    page.getByRole("article", { name: "Abendspaziergang" }),
  ).toBeVisible();

  // Überspringen bleibt neutral und wird im Raster als eigener Zustand geführt.
  await page
    .getByRole("button", { name: "„Abendspaziergang“ heute überspringen" })
    .click();
  await page
    .getByRole("button", { name: "„Abendspaziergang“ heute doch erledigen" })
    .click();

  await page.getByRole("tab", { name: /^Monat/ }).click();
  const grid = page.getByRole("region", {
    name: "Monatsstatus, horizontal scrollbar",
  });
  await expect(grid).toBeVisible();

  const today = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(),
  );
  const todayCell = page.getByRole("button", {
    name: `Abendspaziergang am ${today}: Erledigt. Check-in entfernen`,
  });
  await expect(todayCell).toBeVisible();

  // Das Raster scrollt in sich selbst; das Dokument bleibt schmal.
  expect(
    await grid.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
  await grid.focus();
  await expect(grid).toBeFocused();

  // Ein Monat ohne Routine zeigt keine erfundene Nullquote.
  await page.getByRole("button", { name: "Vorheriger Monat" }).click();
  await expect(
    page.getByText("In diesem Monat war keine Routine aktiv."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nächster Monat" }).click();
  await expect(todayCell).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /^Monat/ }).click();
  await expect(todayCell).toBeVisible();

  expect(chartRequests).toHaveLength(0);

  await waitForServiceWorker(page);
  await context.setOffline(true);
  try {
    await page.reload();
    await page.getByRole("tab", { name: /^Monat/ }).click();
    await expect(todayCell).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

async function waitForServiceWorker(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration?.active);
      }),
    )
    .toBe(true);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
}

test("keeps the week grid scrolling inside itself at 320 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/routinen/uebersicht");
  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page
    .getByRole("textbox", { name: /Name/ })
    .fill("Synthetische Routine mit langem Namen");
  await page.getByRole("button", { name: "Routine anlegen" }).click();
  await page.getByRole("tab", { name: /^Woche/ }).click();

  const grid = page.getByRole("region", {
    name: "Wochenstatus, horizontal scrollbar",
  });
  expect(
    await grid.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);

  // Der Scroller ist per Tastatur erreichbar.
  await grid.focus();
  await expect(grid).toBeFocused();
});
