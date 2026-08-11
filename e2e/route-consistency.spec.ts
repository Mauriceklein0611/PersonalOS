import { expect, test } from "@playwright/test";

const routes = [
  { heading: "Heute", path: "/", surface: "overview" },
  { heading: "Aufgaben", path: "/planen/aufgaben", surface: "work" },
  { heading: "Ziele", path: "/planen/ziele", surface: "work" },
  { heading: "Routinen", path: "/routinen/uebersicht", surface: "work" },
  { heading: "Journal", path: "/routinen/journal", surface: "editor" },
  { heading: "Geld", path: "/geld", surface: "work" },
  {
    heading: "Auswertung",
    path: "/auswertung/ueberblick",
    surface: "overview",
  },
  {
    heading: "Wochenrückblick",
    path: "/auswertung/wochenrueckblick",
    surface: "overview",
  },
  { heading: "Einstellungen", path: "/einstellungen", surface: "settings" },
] as const;

const viewports = [
  { height: 720, width: 320 },
  { height: 760, width: 375 },
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1280 },
  { height: 960, width: 1440 },
] as const;

for (const viewport of viewports) {
  test(`keeps every core route consistent at ${viewport.width} pixels`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    for (const route of routes) {
      await page.goto(route.path);
      await expect(
        page.getByRole("heading", { level: 1, name: route.heading }),
      ).toBeVisible();

      const pageSurface = page.locator(
        `.route-page[data-surface="${route.surface}"]`,
      );
      await expect(pageSurface).toBeVisible();
      await expect(pageSurface.locator("header").first()).toBeVisible();
      if (route.path !== "/") {
        await expect(
          pageSurface.locator(
            `.ui-page-toolbar[data-surface="${route.surface}"]`,
          ),
        ).toBeVisible();
      }
      await expect(page.getByRole("tablist")).toHaveCount(0);

      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow, `${route.path} darf nicht überlaufen`).toBe(
        false,
      );

      const undersizedButtons = await page
        .locator(".ui-button:visible, .ui-icon-button:visible")
        .evaluateAll((buttons) =>
          buttons
            .map((button) => {
              const rect = button.getBoundingClientRect();
              return {
                height: rect.height,
                label:
                  button.getAttribute("aria-label") ??
                  button.textContent?.trim() ??
                  "Unbenannte Aktion",
                width: rect.width,
              };
            })
            .filter(({ height, width }) => height < 44 || width < 44),
        );
      expect(undersizedButtons, `${route.path}: zu kleine Ziele`).toEqual([]);
    }
  });
}

test("removes decorative motion and translucent work surfaces on request", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/routinen/uebersicht");
  await expect(
    page.getByRole("heading", { level: 1, name: "Routinen" }),
  ).toBeVisible();

  const styles = await page.locator(".ui-page-toolbar").evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      backdropFilter: computed.backdropFilter,
      backgroundColor: computed.backgroundColor,
      transitionDuration: computed.transitionDuration,
    };
  });
  expect(styles.backdropFilter).toBe("none");
  expect(styles.backgroundColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  expect(Number.parseFloat(styles.transitionDuration)).toBeLessThanOrEqual(
    0.000_01,
  );

  const buttonTransitions = await page
    .locator(".ui-button:visible")
    .evaluateAll((buttons) =>
      buttons.map((button) => getComputedStyle(button).transitionDuration),
    );
  expect(
    buttonTransitions.every(
      (duration) => Number.parseFloat(duration) <= 0.000_01,
    ),
  ).toBe(true);
});
