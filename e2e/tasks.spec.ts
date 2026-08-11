import { expect, test } from "@playwright/test";

test("persists a task through editing, completion, reopening and archive undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/planen/aufgaben");

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

  await page.getByLabel(/^Weitere Aktionen für/).click();
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
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Rechnung prüfen" }) })
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

  await page.getByLabel(/^Weitere Aktionen für/).click();
  await page.getByRole("button", { name: /abbrechen$/ }).click();
  await page.getByRole("tab", { name: /^Erledigt/ }).click();
  await expect(page.getByText("Abgebrochen", { exact: true })).toBeVisible();

  await page.getByLabel(/^Weitere Aktionen für/).click();
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

/*
 * #120: Aus vier gleich schweren Schaltflächen je Aufgabe wurde eine
 * sichtbare primäre Aktion; der Rest liegt hinter einer Ausklappfläche.
 * Geprüft wird hier, was jsdom nicht auslöst: die native Tastaturbedienung
 * von `<summary>` und die Fokusrückgabe danach.
 */
test("opens the secondary task actions from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planen/aufgaben");

  await page
    .getByRole("textbox", { name: "Neue Aufgabe" })
    .fill("Unterlagen sortieren");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();

  const toggle = page.getByLabel("Weitere Aktionen für „Unterlagen sortieren“");
  const edit = page.getByRole("button", {
    name: "„Unterlagen sortieren“ bearbeiten",
  });
  await expect(edit).toBeHidden();

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(edit).toBeVisible();

  // Escape schließt die Fläche und der Fokus bleibt auf der Schaltfläche.
  await page.keyboard.press("Escape");
  await expect(edit).toBeHidden();
  await expect(toggle).toBeFocused();
});

/*
 * #123: Der Wochenplan zeigt geplante Aufgaben je Tag. Auf Mobil steht genau
 * ein Tag im Fluss, erreichbar über den Wochentagsstreifen; bei 1280 px
 * stehen alle sieben nebeneinander, ohne das Dokument breiter zu machen.
 */
test("plans a week and shows exactly one day on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planen/aufgaben");

  await page
    .getByRole("textbox", { name: "Neue Aufgabe" })
    .fill("Unterlagen sortieren");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();

  // Das Plandatum entsteht in der Bearbeitung; der Plan liest es nur.
  await page.getByLabel("Weitere Aktionen für „Unterlagen sortieren“").click();
  await page
    .getByRole("button", { name: "„Unterlagen sortieren“ bearbeiten" })
    .click();
  const today = new Date();
  const plannedDate = isoDay(today);
  await page.getByLabel("Plandatum").fill(plannedDate);
  await page.getByRole("button", { name: "Änderungen speichern" }).click();

  await page.getByRole("tab", { name: /^Wochenliste/ }).click();
  await expect(
    page.getByRole("note", { name: "Zweck dieser Ansicht" }),
  ).toContainText("Was muss ich diese Woche im Blick behalten?");

  await page.getByRole("tab", { name: /^Wochenplan/ }).click();
  await expect(
    page.getByRole("note", { name: "Zweck dieser Ansicht" }),
  ).toContainText("Was habe ich an welchem Tag eingeplant?");

  /*
   * Genau ein Tagesbereich steht im Fluss. Die übrigen sind `display: none`
   * und damit auch für assistive Technik nicht vorhanden — kein verstecktes
   * Bedienelement, das man nur nicht sieht.
   */
  // Wochentag und Datum; „Mittwoch“ endet nicht auf „tag“.
  const sections = page.getByRole("region", {
    name: /^\w+, \d{2}\.\d{2}\.\d{4}/,
  });
  await expect(sections).toHaveCount(1);

  const strip = page.getByRole("list", { name: "Wochentag wählen" });
  await expect(strip.getByRole("button")).toHaveCount(7);
  const otherDay = strip
    .getByRole("button", { name: /nichts geplant/ })
    .first();
  const otherDayName = (await otherDay.getAttribute("aria-label")) ?? "";
  await otherDay.click();
  const selected = page.getByRole("region", {
    name: otherDayName.split(":")[0],
  });
  await expect(selected).toBeVisible();
  await expect(sections).toHaveCount(1);
  await expect(
    selected.getByText("Für diesen Tag ist nichts geplant."),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);

  // Bei 1280 px steht die ganze Woche nebeneinander, ohne Streifen.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(sections).toHaveCount(7);
  await expect(strip).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

/*
 * #124: Liste und Wochenplan sind die primären Arbeitsflächen der Aufgaben.
 * Sie zeigen Zustand und Quote über `TrackerCell`, `ProgressBar` und CSS —
 * die Diagrammbibliothek hat dort nichts zu suchen. Die Gegenprobe, dass der
 * Chunk überhaupt noch so heißt, steht in `e2e/today.spec.ts`; zusätzlich
 * fordert `pnpm check:bundle` seine Existenz ein.
 */
test("keeps the task views free of the chart library", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  await page.goto("/planen/aufgaben");
  await page
    .getByRole("textbox", { name: "Neue Aufgabe" })
    .fill("Unterlagen sortieren");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Unterlagen sortieren" }),
  ).toBeVisible();

  for (const view of [/^Heute/, /^Wochenliste/, /^Wochenplan/, /^Erledigt/]) {
    await page.getByRole("tab", { name: view }).click();
  }
  await page.waitForLoadState("networkidle");

  expect(requested.filter((url) => /ChartCanvas|echarts/i.test(url))).toEqual(
    [],
  );
});

/** Der Kalendertag von heute als `YYYY-MM-DD` für ein Datumsfeld. */
function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test("keeps three task rows recognisable at 390 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planen/aufgaben");

  const field = page.getByRole("textbox", { name: "Neue Aufgabe" });
  const submit = page.getByRole("button", { name: "Aufgabe hinzufügen" });
  for (const title of [
    "Synthetische Aufgabe mit einem sehr langen Titel zum Umbrechen",
    "Zweite synthetische Aufgabe",
    "Dritte synthetische Aufgabe",
  ]) {
    await field.fill(title);
    await submit.click();
    await expect(
      page.getByRole("heading", { level: 2, name: title }),
    ).toBeVisible();
  }

  const rows = page
    .getByRole("list", { name: "Aufgaben dieser Ansicht" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(3);

  // Die drei Zeilen stehen gemeinsam in einem Bildschirm, ohne Karten dazwischen.
  const boxes = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height),
  );
  expect(boxes.every((height) => height >= 44)).toBe(true);
  expect(boxes.reduce((sum, height) => sum + height, 0)).toBeLessThan(400);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
