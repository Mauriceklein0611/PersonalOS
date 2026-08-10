import { expect, test } from "@playwright/test";

test("navigates the lazy shell and persists the theme on desktop", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("PersonalOS");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Farbschema")).toHaveValue("system");

  const desktopNavigation = page.getByRole("navigation", {
    name: "Hauptnavigation",
  });
  await desktopNavigation.getByRole("link", { name: "Aufgaben" }).click();

  await expect(page).toHaveURL(/\/aufgaben$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Aufgaben" }),
  ).toBeVisible();
  await expect(
    desktopNavigation.getByRole("link", { name: "Aufgaben" }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByLabel("Farbschema").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("keeps every shell route reachable at 320 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const mobileNavigation = page.getByRole("navigation", {
    name: "Hauptnavigation mobil",
  });

  await mobileNavigation.getByRole("link", { name: "Routinen" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Routinen" }),
  ).toBeVisible();

  // Ziele liegen als Reiter im Bereich Planen, nicht mehr hinter einem Menü.
  await mobileNavigation.getByRole("link", { name: "Planen" }).click();
  await page
    .getByRole("navigation", { name: "Planen: Unterbereiche" })
    .getByRole("link", { name: "Ziele" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ziele" }),
  ).toBeVisible();

  // Der Wochenrückblick gehört zur Auswertung und hängt in der Kopfzeile.
  await page
    .getByRole("navigation", { name: "Nebenbereiche" })
    .getByRole("link", { name: "Auswertung" })
    .click();
  await page
    .getByRole("navigation", { name: "Auswertung: Unterbereiche" })
    .getByRole("link", { name: "Wochenrückblick" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Wochenrückblick" }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("keeps 44 pixel targets across the band and the header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const mobileNavigation = page.getByRole("navigation", {
    name: "Hauptnavigation mobil",
  });
  const secondaryNavigation = page.getByRole("navigation", {
    name: "Nebenbereiche",
  });

  // Jedes Bedienelement der Kopfzeile und des Bandes hält die eigene
  // Mindestgröße von 44 CSS-Pixeln.
  const controls = [
    page.getByRole("link", { name: "PersonalOS – Heute" }),
    page.getByLabel("Farbschema"),
    mobileNavigation.getByRole("link", { name: "Routinen" }),
    mobileNavigation.getByRole("link", { name: "Geld" }),
    secondaryNavigation.getByRole("link", { name: "Auswertung" }),
    secondaryNavigation.getByRole("link", { name: "Einstellungen" }),
  ];
  for (const control of controls) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  // Mit der Offline-Anzeige steht ein drittes Element in der Kopfzeile. Sie
  // bricht dann um, statt die Seite breiter zu machen.
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("renders the not-found contract for unknown paths", async ({ page }) => {
  await page.goto("/unbekannter-bereich");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Diese Seite gibt es nicht.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Zur Tagesübersicht" }),
  ).toBeVisible();
});
