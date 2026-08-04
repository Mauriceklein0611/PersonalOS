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

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
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
