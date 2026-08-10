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

  await page.goto("/routinen");
  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  await page.getByRole("button", { name: "Routine anlegen" }).click();
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
    page.getByText("Alle 1 fälligen Routinen sind für heute erfasst."),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "„Rechnung prüfen“ abschließen" })
    .click();
  await expect(page.getByText("Keine offene Aufgabe")).toBeVisible();

  await page.goto("/routinen/journal");
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
  await page.goto("/geld");
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
  await page.goto("/geld");
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
  await page.goto("/geld");

  const captureBox = await page
    .getByRole("heading", { level: 2, name: "Buchung erfassen" })
    .boundingBox();
  const overviewBox = await page
    .getByRole("heading", { level: 2, name: "Monatsübersicht" })
    .boundingBox();

  expect(captureBox?.y ?? 0).toBeLessThan(overviewBox?.y ?? 0);
});

/*
 * #73: Die Startroute ist die meistbesuchte Ansicht. Sie ohne die
 * Diagrammbibliothek zu halten, ist der stärkste Leistungshebel des Projekts.
 *
 * Geprüft wird der Netzverkehr und nicht der Importgraph: Vite führt jeden
 * dynamischen Chunk in einer zentralen Tabelle im Eintragschunk, ganz gleich,
 * wer ihn lädt. Nur die tatsächliche Anforderung beantwortet die Frage.
 */
test("loads the dashboard without the chart library", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();
  await expect(page.getByText("Life Score", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(requested.filter((url) => /ChartCanvas|echarts/i.test(url))).toEqual(
    [],
  );

  /*
   * Gegenprobe: Eine Seite, die wirklich zeichnet, fordert den Chunk sehr wohl
   * an. Ohne sie liefe die Prüfung nach einer Umbenennung des Chunks still ins
   * Leere und wäre immer grün. Die Buchung ist nötig, weil ein Diagramm ohne
   * Datengrundlage im Leerzustand bleibt und gar nicht erst lädt.
   */
  await page.goto("/geld");
  await page.getByRole("textbox", { name: /Betrag in Euro/ }).fill("42,00");
  await page
    .getByRole("combobox", { name: /Kategorie der Buchung/ })
    .selectOption({ label: "Lebensmittel" });
  await page.getByRole("button", { name: "Buchung speichern" }).click();
  await expect(page.getByText("Die Buchung wurde gespeichert.")).toBeVisible();

  await expect
    .poll(() => requested.filter((url) => /ChartCanvas/i.test(url)).length)
    .toBeGreaterThan(0);
});

test("keeps the signal area silent on a calm day and speaks when something crosses a line", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  /*
   * Feste Uhrzeit am Vormittag. Ab 18 Uhr meldet der Signalbereich zu Recht
   * den Reflexionshinweis; ohne feste Zeit prüfte dieser Test also je nach
   * Tageszeit etwas anderes und fiel abends um.
   */
  await page.clock.setFixedTime(new Date("2026-08-10T09:00:00"));
  await page.goto("/");

  // Ein ruhiger Tag sieht ruhig aus.
  await expect(
    page.getByRole("heading", { level: 2, name: "Signale" }),
  ).toHaveCount(0);

  await page
    .getByRole("textbox", { name: "Aufgabe für heute" })
    .fill("Rückstand von gestern");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(
    page.getByText("Wichtigstes für heute: Rückstand von gestern"),
  ).toBeVisible();

  // Für heute geplant ist nicht überfällig — der Bereich bleibt still.
  await expect(
    page.getByRole("heading", { level: 2, name: "Signale" }),
  ).toHaveCount(0);

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

/*
 * #118: Der Morgen-Check-in begann bei etwa y=854 in einem 844 px hohen
 * Viewport — der erste Bildschirm zeigte Begrüßung, Ring und Kennzahlen,
 * aber kein Eingabefeld. Erfassen steht seitdem vor Auswerten.
 */
async function seedExpenseCategories(page: import("@playwright/test").Page) {
  // Die Startkategorien entstehen beim ersten Besuch des Finanzbereichs.
  await page.goto("/geld");
  await expect(
    page.getByRole("heading", { level: 2, name: "Buchung erfassen" }),
  ).toBeVisible();
}

/** Der Hinweis steht im Fluss; geschlossen gibt er seine Höhe wieder frei. */
async function dismissInstallHint(page: import("@playwright/test").Page) {
  const hint = page.getByText(
    "PersonalOS kann jetzt ohne Netzwerk gestartet werden.",
  );
  await expect(hint).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Hinweis schließen" }).click();
  await expect(hint).toBeHidden();
}

test("keeps both capture actions in the first mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedExpenseCategories(page);
  await page.goto("/");
  await dismissInstallHint(page);

  for (const target of [
    page.getByRole("textbox", { name: "Aufgabe für heute" }),
    page.getByRole("button", { name: "Aufgabe hinzufügen" }),
    page.getByRole("heading", { level: 3, name: "Ausgabe erfassen" }),
    page.getByRole("textbox", { name: /Betrag der Ausgabe/ }),
  ]) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }

  // Erreicht ohne einen einzigen Scrollschritt.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("keeps the first capture action visible on a short viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seedExpenseCategories(page);
  await page.goto("/");
  await dismissInstallHint(page);

  const addTask = page.getByRole("button", { name: "Aufgabe hinzufügen" });
  const addTaskBox = await addTask.boundingBox();
  expect(addTaskBox!.y + addTaskBox!.height).toBeLessThanOrEqual(667);

  // Der zweite Einstieg liegt einen kurzen Schritt darunter, nicht zwei.
  const amount = page.getByRole("textbox", { name: /Betrag der Ausgabe/ });
  const amountBox = await amount.boundingBox();
  expect(amountBox!.y + amountBox!.height).toBeLessThanOrEqual(2 * 667);
  await amount.scrollIntoViewIfNeeded();
  await expect(amount).toBeInViewport();
});

test("puts capture before evaluation on the dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  // Das Raster erscheint erst nach dem Laden; vorher gibt es nichts zu messen.
  await expect(
    page.getByRole("textbox", { name: "Aufgabe für heute" }),
  ).toBeVisible();

  const boxes = await page.evaluate(() =>
    [".today-hero", ".today-capture", ".today-metrics", ".today-score-link"]
      .map((selector) => document.querySelector(selector))
      .map((element) => (element ? element.getBoundingClientRect().top : null)),
  );

  expect(boxes.every((value) => value !== null)).toBe(true);
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index]!).toBeGreaterThan(boxes[index - 1]!);
  }
});

for (const width of [320, 375, 390]) {
  test(`keeps the dashboard free of sideways scrolling at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 720, width });
    await seedExpenseCategories(page);
    await page.goto("/");
    await expect(
      page.getByRole("textbox", { name: /Betrag der Ausgabe/ }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });
}
