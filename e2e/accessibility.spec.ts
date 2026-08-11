import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automatisierter Teil des Accessibility-Audits (#27).
 *
 * axe findet nur einen Teil der Barrieren. Die Prüfung ist deshalb bewusst
 * hart eingestellt: Jeder Verstoß der Stufen `serious` und `critical` lässt den
 * Lauf fallen. Die manuellen Schritte, die axe nicht abdecken kann, stehen in
 * `docs/audits/accessibility-audit.md`.
 */
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

/** Nur diese Stufen blockieren; `moderate`/`minor` werden im Audit geführt. */
const blockingImpacts = new Set(["critical", "serious"]);

/**
 * Zwei Regeln unterhalb dieser Schwelle, die das Audit trotzdem behoben hat:
 * eine doppelt vergebene Landmarke und eine übersprungene Überschriftenebene.
 * Ohne diesen Zusatz fiele beides beim nächsten Umbau still zurück.
 */
const guardedRules = new Set(["heading-order", "landmark-unique"]);

type AxeViolation = Awaited<
  ReturnType<AxeBuilder["analyze"]>
>["violations"][number];

const corePages = [
  { heading: "Heute", name: "Tagesübersicht", path: "/" },
  { heading: "Aufgaben", name: "Aufgaben", path: "/planen/aufgaben" },
  { heading: "Ziele", name: "Ziele", path: "/planen/ziele" },
  { heading: "Routinen", name: "Routinen", path: "/routinen/uebersicht" },
  { heading: "Journal", name: "Journal", path: "/routinen/journal" },
  { heading: "Geld", name: "Geld", path: "/geld" },
  { heading: "Auswertung", name: "Auswertung", path: "/auswertung/ueberblick" },
  {
    heading: "Wochenrückblick",
    name: "Wochenrückblick",
    path: "/auswertung/wochenrueckblick",
  },
  { heading: "Einstellungen", name: "Einstellungen", path: "/einstellungen" },
] as const;

async function scan(page: Page): Promise<AxeViolation[]> {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  return results.violations.filter(
    (violation) =>
      blockingImpacts.has(violation.impact ?? "") ||
      guardedRules.has(violation.id),
  );
}

/** Nennt Regel, Wirkung und betroffene Stelle, damit ein Fehlschlag reparierbar ist. */
function describe(violations: readonly AxeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help} – ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    )
    .join("\n");
}

for (const corePage of corePages) {
  test(`keeps ${corePage.name} free of serious axe violations`, async ({
    page,
  }) => {
    await page.goto(corePage.path);
    await expect(
      page.getByRole("heading", { level: 1, name: corePage.heading }),
    ).toBeVisible();

    const violations = await scan(page);
    expect(describe(violations)).toBe("");
  });
}

/**
 * Der Leerzustand zeigt weder Diagramme noch Listen. Erst mit Daten entstehen
 * die Flächen, auf denen Kontrast und Textalternativen tatsächlich zählen.
 */
test("keeps the dashboard accessible once it carries data", async ({
  page,
}) => {
  await page.goto("/planen/aufgaben");
  await page.getByRole("textbox", { name: "Neue Aufgabe" }).fill("Testaufgabe");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();

  await page.goto("/geld");
  await page
    .getByRole("textbox", { name: /Betrag in/ })
    .first()
    .fill("42,00");
  await page
    .getByRole("combobox", { name: /Kategorie der Buchung/ })
    .selectOption({ label: "Lebensmittel" });
  await page.getByRole("button", { name: "Buchung speichern" }).click();
  await expect(page.getByRole("table").first()).toBeVisible();

  expect(describe(await scan(page))).toBe("");

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();
  expect(describe(await scan(page))).toBe("");
});

/**
 * Beide Themes sind gleichwertig zu prüfen: Sie teilen die Struktur, aber nicht
 * die Farbwerte. Der aktive Navigationslink war in beiden zu blass.
 */
for (const theme of ["light", "dark"] as const) {
  test(`keeps the ${theme} theme free of serious axe violations`, async ({
    page,
  }) => {
    await page.goto("/einstellungen");
    await page.getByLabel("Farbschema").selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

    for (const path of [
      "/einstellungen",
      "/",
      "/geld",
      "/routinen/uebersicht",
      "/routinen/journal",
      "/planen/aufgaben",
    ]) {
      await page.goto(path);
      expect(describe(await scan(page)), `${theme}: ${path}`).toBe("");
    }
  });
}

/**
 * 200 Prozent Zoom entspricht der halben Breite bei gleicher Textgröße. Nichts
 * darf dabei seitwärts verschwinden.
 */
test("reflows at 200 percent zoom without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 512 });

  for (const path of ["/", "/planen/aufgaben", "/geld", "/einstellungen"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow, `${path} scrollt bei 200 % Zoom seitwärts`).toBe(false);
  }
});

/** Der Dialog ist der Ort, an dem verlorener Fokus am teuersten ist. */
test("moves and traps the focus inside the delete dialog", async ({ page }) => {
  await page.goto("/einstellungen");
  const opener = page.getByRole("button", {
    name: "Alle lokalen Daten löschen",
  });
  await opener.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(describe(await scan(page))).toBe("");

  // Der Fokus steht im Dialog, nicht mehr auf der Seite dahinter.
  await expect(dialog.locator(":focus")).toHaveCount(1);

  // Escape schließt und gibt den Fokus an den Auslöser zurück.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

/** Kernaktionen ohne Maus: erfassen, speichern, prüfen. */
test("captures a task with the keyboard alone", async ({ page }) => {
  await page.goto("/planen/aufgaben");
  await page.getByRole("textbox", { name: "Neue Aufgabe" }).focus();
  await page.keyboard.type("Tastaturaufgabe");
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { level: 2, name: "Tastaturaufgabe" }),
  ).toBeVisible();
});

/**
 * Tabbt vom Startpunkt bis zum Ziel und meldet, nach wie vielen Schritten es
 * erreichbar war. Bleibt das Ziel aus, sitzt der Fokus in einer Falle.
 */
async function tabTo(
  page: Page,
  target: ReturnType<Page["getByRole"]>,
  maxSteps = 12,
): Promise<number> {
  for (let step = 1; step <= maxSteps; step += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((node) => node === document.activeElement)) {
      return step;
    }
  }
  throw new Error("Das Ziel war per Tabulator nicht erreichbar.");
}

/** Der Tagesablauf: Ausgabe erfassen, ohne die Maus anzufassen. */
test("books the daily expense with the keyboard alone", async ({ page }) => {
  // Die Startkategorien entstehen beim ersten Besuch des Finanzbereichs.
  await page.goto("/geld");
  await expect(
    page.getByRole("heading", { level: 2, name: "Buchung erfassen" }),
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("textbox", { name: /Betrag der Ausgabe/ }).focus();
  await page.keyboard.type("12,50");

  await page.keyboard.press("Tab");
  await page.keyboard.type("Lebensmittel");
  await expect(
    page.getByRole("combobox", { name: /Kategorie der Ausgabe/ }),
  ).toHaveValue(/.+/);

  const submit = page.getByRole("button", { name: "Ausgabe buchen" });
  await tabTo(page, submit, 4);
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Die Ausgabe über 12,50 wurde gebucht."),
  ).toBeVisible();
});

/** Der Finanzbereich: dieselbe Buchung über die vollständige Erfassung. */
test("books a transaction with the keyboard alone", async ({ page }) => {
  await page.goto("/geld");
  await page.getByRole("textbox", { name: /Betrag in/ }).focus();
  await page.keyboard.type("20,00");

  await page.keyboard.press("Tab");
  await page.keyboard.type("Lebensmittel");

  const submit = page.getByRole("button", { name: "Buchung speichern" });
  await tabTo(page, submit, 6);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("table").first()).toContainText("20,00");
});

/** Das Backup: Export und Löschdialog sind ohne Maus erreichbar. */
test("reaches export and deletion with the keyboard alone", async ({
  page,
}) => {
  await page.goto("/einstellungen");
  const exportButton = page.getByRole("button", {
    name: "Vollständigen Export herunterladen",
  });
  await exportButton.focus();

  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.json$/);

  const opener = page.getByRole("button", {
    name: "Alle lokalen Daten löschen",
  });
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();

  // Abbrechen ist per Tastatur erreichbar und lässt die Daten unberührt.
  const cancel = page.getByRole("button", { name: "Abbrechen" });
  await tabTo(page, cancel, 6);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
