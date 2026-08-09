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

  await mobileNavigation.getByRole("link", { name: "Gewohnheiten" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Gewohnheiten" }),
  ).toBeVisible();

  await mobileNavigation.getByRole("button", { name: "Mehr" }).click();
  await mobileNavigation.getByRole("link", { name: "Ziele" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ziele" }),
  ).toBeVisible();

  await mobileNavigation.getByRole("button", { name: "Mehr" }).click();
  await mobileNavigation.getByRole("link", { name: "Wochenrückblick" }).click();
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

test("closes the overflow menu on a tap outside and keeps 44 pixel targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const mobileNavigation = page.getByRole("navigation", {
    name: "Hauptnavigation mobil",
  });
  const moreButton = mobileNavigation.getByRole("button", { name: "Mehr" });

  await moreButton.click();
  await expect(
    mobileNavigation.getByRole("link", { name: "Ziele" }),
  ).toBeVisible();
  // Beim Öffnen steht der Fokus auf dem ersten Eintrag des Menüs.
  await expect(
    mobileNavigation.getByRole("link", { name: "Ziele" }),
  ).toBeFocused();

  // Ein Tap auf den Inhalt schließt das Menü, ohne den Bereich zu wechseln.
  await page.getByRole("heading", { level: 1, name: "Heute" }).click();
  await expect(
    mobileNavigation.getByRole("link", { name: "Ziele" }),
  ).toBeHidden();
  await expect(page).toHaveURL(/\/$/);

  // Escape gibt den Fokus an den Auslöser zurück.
  await moreButton.click();
  await page.keyboard.press("Escape");
  await expect(moreButton).toBeFocused();

  // Jedes Bedienelement der Kopfzeile und des Bandes hält die eigene
  // Mindestgröße von 44 CSS-Pixeln.
  const controls = [
    page.getByRole("link", { name: "PersonalOS – Heute" }),
    page.getByLabel("Farbschema"),
    mobileNavigation.getByRole("link", { name: "Gewohnheiten" }),
    moreButton,
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
