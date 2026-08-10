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
