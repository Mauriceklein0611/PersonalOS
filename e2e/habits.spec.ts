import { expect, test } from "@playwright/test";

test("creates, checks in, skips and restores a routine on one surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/routinen/uebersicht");

  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  await page
    .getByRole("dialog", { name: "Routine anlegen" })
    .getByRole("button", { name: "Routine anlegen" })
    .click();

  await expect(page.getByRole("tablist")).toHaveCount(0);
  const grid = page.getByRole("region", {
    name: "Routinen-Tracker, horizontal scrollbar",
  });
  await expect(grid).toBeVisible();

  const today = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(),
  );
  const openCell = page.getByRole("button", {
    name: `Abendspaziergang am ${today}: Offen. Als erledigt eintragen`,
  });
  await expect(openCell).toBeVisible();
  await openCell.click();

  const doneCell = page.getByRole("button", {
    name: `Abendspaziergang am ${today}: Erledigt. Check-in entfernen`,
  });
  await expect(doneCell).toBeVisible();
  await page.reload();
  await expect(doneCell).toBeVisible();

  // Überspringen ist eine sekundäre Zeilenaktion, der primäre Check-in bleibt
  // eine direkte Zellenaktion.
  await doneCell.click();
  await page
    .getByRole("button", { name: "„Abendspaziergang“ verwalten" })
    .click();
  await page.getByRole("button", { name: "Heute überspringen" }).click();
  await expect(
    page.getByRole("button", {
      name: `Abendspaziergang am ${today}: Übersprungen. Als erledigt eintragen`,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "„Abendspaziergang“ verwalten" })
    .click();
  await page.getByRole("button", { name: "Archivieren" }).click();
  await expect(
    page.getByText("Abendspaziergang", { exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(
    page.getByText("Abendspaziergang", { exact: true }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("centers today inside the full-surface tracker without loading charts", async ({
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
  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Morgenroutine");
  await page
    .getByRole("dialog", { name: "Routine anlegen" })
    .getByRole("button", { name: "Routine anlegen" })
    .click();

  const grid = page.getByRole("region", {
    name: "Routinen-Tracker, horizontal scrollbar",
  });
  await expect(grid).toBeVisible();
  const gridBox = await grid.boundingBox();
  expect(gridBox!.y).toBeLessThan(page.viewportSize()!.height);
  expect(
    await grid.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  expect(await grid.evaluate((element) => element.scrollLeft)).toBeGreaterThan(
    0,
  );
  await grid.focus();
  await expect(grid).toBeFocused();
  expect(chartRequests).toHaveLength(0);

  const todayHeader = grid.locator('thead [data-today="true"]');
  await expect(todayHeader).toBeVisible();
  expect(
    await todayHeader.evaluate((element) => element.textContent),
  ).toBeTruthy();
});

test("keeps the tracker wide on desktop and restores from the archive offline", async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/routinen/uebersicht");
  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Lesen");
  await page
    .getByRole("dialog", { name: "Routine anlegen" })
    .getByRole("button", { name: "Routine anlegen" })
    .click();

  const routeWidth = await page
    .locator(".habits-page")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(routeWidth).toBeGreaterThan(900);

  await page.getByRole("button", { name: "„Lesen“ verwalten" }).click();
  await page.getByRole("button", { name: "Archivieren" }).click();
  await page
    .getByRole("combobox", { name: /Routinen anzeigen/ })
    .selectOption("archived");
  await expect(page.getByText("Lesen", { exact: true })).toBeVisible();

  await waitForServiceWorker(page);
  await context.setOffline(true);
  try {
    await page.reload();
    await page
      .getByRole("combobox", { name: /Routinen anzeigen/ })
      .selectOption("archived");
    await expect(page.getByText("Lesen", { exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }

  await page.getByRole("button", { name: "„Lesen“ verwalten" }).click();
  await page.getByRole("button", { name: "Wiederherstellen" }).click();
  await expect(page.getByText("Nichts archiviert")).toBeVisible();
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
