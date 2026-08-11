import { expect, test } from "@playwright/test";

/*
 * #78: Vier Bereiche statt acht gleichrangiger Punkte. Die alten Pfade stehen
 * in Lesezeichen, im Verlauf und in PWA-Verknüpfungen — sie müssen erreichbar
 * bleiben, sonst kostet der Umbau Vertrauen in eine App, die sonst nie etwas
 * verliert.
 */
const redirects = [
  { from: "/aufgaben", heading: "Aufgaben", to: "/planen/aufgaben" },
  { from: "/ziele", heading: "Ziele", to: "/planen/ziele" },
  { from: "/gewohnheiten", heading: "Routinen", to: "/routinen/uebersicht" },
  { from: "/journal", heading: "Journal", to: "/routinen/journal" },
  { from: "/finanzen", heading: "Geld", to: "/geld" },
  { from: "/insights", heading: "Auswertung", to: "/auswertung/ueberblick" },
  {
    from: "/wochenrueckblick",
    heading: "Wochenrückblick",
    to: "/auswertung/wochenrueckblick",
  },
];

for (const { from, heading, to } of redirects) {
  test(`keeps the bookmark ${from} working`, async ({ page }) => {
    await page.goto(from);

    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${to}$`));
  });
}

test("offers exactly four areas in the mobile band", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const band = page.getByRole("navigation", { name: "Hauptnavigation mobil" });
  await expect(band.getByRole("link")).toHaveText([
    "Heute",
    "Planen",
    "Routinen",
    "Geld",
  ]);

  // Kein Überlaufmenü mehr: Vorher lagen vier von acht Bereichen dahinter,
  // darunter die Finanzen mit einer der häufigsten Erfassungsaktionen.
  await expect(band.getByRole("button")).toHaveCount(0);

  // Die Nebenbereiche stehen in der Kopfzeile und bleiben erreichbar.
  const secondary = page.getByRole("navigation", { name: "Nebenbereiche" });
  await expect(
    secondary.getByRole("link", { name: "Auswertung" }),
  ).toBeVisible();
  await expect(
    secondary.getByRole("link", { name: "Einstellungen" }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("reaches every sub-area from the band at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const band = page.getByRole("navigation", { name: "Hauptnavigation mobil" });

  // Planen führt auf Aufgaben und trägt Ziele als Reiter daneben.
  await band.getByRole("link", { name: "Planen" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Aufgaben" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Planen: Unterbereiche" })
    .getByRole("link", { name: "Ziele" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ziele" }),
  ).toBeVisible();

  await band.getByRole("link", { name: "Routinen" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Routinen" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Routinen: Unterbereiche" })
    .getByRole("link", { name: "Journal" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Journal" }),
  ).toBeVisible();

  // Geld ist ein Tap entfernt statt zwei; das war der Punkt des Umbaus.
  await band.getByRole("link", { name: "Geld" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Geld" }),
  ).toBeVisible();
});

/*
 * Ansichts-Reiter, Issue #119. Vor dem gemeinsamen Baustein scrollte die
 * Reihe waagerecht: 500 px Inhalt auf 343 px sichtbarer Breite bei den
 * Aufgaben, 480 auf 343 bei den Routinen. „Diese Woche“, „Fortschritt“ und
 * „Archiv“ lagen damit außerhalb des Sichtfelds.
 */
for (const width of [320, 375, 390]) {
  test(`shows every view tab without sideways scrolling at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 720, width });

    for (const [path, listName, tabCount] of [
      ["/planen/aufgaben", "Aufgabenansicht", 4],
      // Seit dem Monatsraster (#122) fünf Reiter: Heute, Woche, Monat,
      // Fortschritt, Archiv. Die Reihe bricht um, statt zu scrollen.
      ["/routinen/uebersicht", "Routinenansicht", 5],
    ] as const) {
      await page.goto(path);

      const tabs = page.getByRole("tablist", { name: listName });
      await expect(tabs).toBeVisible();
      await expect(tabs.getByRole("tab")).toHaveCount(tabCount);

      const scrolls = await tabs.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      );
      expect(scrolls).toBe(false);

      /*
       * Jeder Reiter liegt vollständig innerhalb der Reihe und bleibt ein
       * 44-px-Ziel. Waagerecht ist damit nichts abgeschnitten; senkrecht
       * darf die zweite Zeile unter der Falz liegen, das ist normales
       * Scrollen und kein verstecktes Bedienelement.
       */
      const list = await tabs.boundingBox();
      for (const tab of await tabs.getByRole("tab").all()) {
        await expect(tab).toBeVisible();
        const box = await tab.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(list!.x - 1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          list!.x + list!.width + 1,
        );
      }

      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
    }
  });
}

test("walks the view tabs with the keyboard following the ARIA pattern", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/planen/aufgaben");

  const tabs = page.getByRole("tablist", { name: "Aufgabenansicht" });
  const inbox = tabs.getByRole("tab", { name: /^Inbox/ });

  await inbox.focus();
  await expect(inbox).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: /^Heute/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab", { name: /^Erledigt/ })).toBeFocused();

  await page.keyboard.press("Home");
  await expect(inbox).toBeFocused();
  await expect(inbox).toHaveAttribute("aria-selected", "true");

  // Genau ein Reiter liegt im Tabulatorpfad.
  const inTabOrder = await tabs
    .getByRole("tab")
    .evaluateAll((elements) =>
      elements.filter((element) => element.getAttribute("tabindex") === "0"),
    );
  expect(inTabOrder).toHaveLength(1);
});
