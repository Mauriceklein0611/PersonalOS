import { expect, test } from "@playwright/test";

test("shows the core component states and accessible form feedback", async ({
  page,
}) => {
  await page.goto("/komponenten");

  await expect(
    page.getByRole("heading", { level: 1, name: "Komponenten" }),
  ).toBeVisible();

  const loadingButton = page.getByRole("button", {
    name: "Wird geladen …",
  });
  await expect(loadingButton).toBeDisabled();
  await expect(loadingButton).toHaveAttribute("aria-busy", "true");

  const invalidInput = page.getByRole("textbox", { name: /Fehlerzustand/ });
  await expect(invalidInput).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Gib einen Titel mit mindestens einem Zeichen ein."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Dialog öffnen" }).click();
  const dialog = page.getByRole("dialog", { name: "Änderung bestätigen" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("keeps the component preview usable in dark mode at 320 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/komponenten");

  await page.getByLabel("Farbschema").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Speichern" }).first(),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("shows every dashboard value as text and keeps the tracker scrollable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/komponenten");

  await expect(page.getByText("249")).toBeVisible();
  await expect(page.getByText("71 %")).toBeVisible();
  await expect(
    page.getByText("Für diesen Zeitraum liegen keine Einträge vor."),
  ).toBeVisible();

  // Ohne Datenbasis steht überall der neutrale Text statt null Prozent.
  await expect(page.getByText("Keine Angabe").first()).toBeVisible();

  const tracker = page.getByRole("group", {
    name: "Wochenraster, Normalzustand",
  });
  await expect(tracker).toBeVisible();

  const trackerScrolls = await tracker.evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(trackerScrolls).toBe(true);

  // Das eigene Scrollen des Rasters darf das Dokument nicht überlaufen lassen.
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  // Der Scroll-Container ist per Tastatur erreichbar.
  await tracker.focus();
  await expect(tracker).toBeFocused();
});

/*
 * Quiet Density, Issue #117. Geprüft wird, was sich sonst leicht verliert:
 * dass die dichte Zeile trotz Dichte ein 44-px-Ziel bleibt und dass der
 * Zustand nicht allein an der Fläche hängt.
 */
test("keeps dense rows a full-size target and states readable as text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/komponenten");

  const list = page.getByRole("list", {
    exact: true,
    name: "Dichte Aufgabenliste",
  });
  const rows = list.getByRole("button");
  await expect(rows).toHaveCount(3);

  for (const row of await rows.all()) {
    const box = await row.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  // Die Auswahl trägt `aria-current`, nicht nur eine hellere Fläche.
  const first = rows.first();
  await expect(first).not.toHaveAttribute("aria-current", "true");
  await first.click();
  await expect(first).toHaveAttribute("aria-current", "true");
  await expect(list.locator('[aria-current="true"]')).toHaveCount(1);

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

/*
 * Der Kontrasttest rechnet mit einer deckenden Fläche ohne Blur. Diese
 * Prüfung stellt sicher, dass genau das im Browser ankommt — sonst hinge der
 * Kontrast wieder am Nebel darunter, ohne dass eine Prüfung es meldet.
 */
test("renders the dense panel opaque and without a backdrop filter", async ({
  page,
}) => {
  await page.goto("/komponenten");

  for (const theme of ["dark", "light"]) {
    await page.getByLabel("Farbschema").selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

    const surface = await page
      .locator(".ui-dense-panel")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backdropFilter: style.backdropFilter,
          backgroundColor: style.backgroundColor,
        };
      });

    expect(surface.backdropFilter).toBe("none");
    // Deckend heißt: keine Alphakomponente, also `rgb(…)` statt `rgba(…)`.
    expect(surface.backgroundColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  }
});

test("shows the density comparison side by side on a wide viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/komponenten");

  const before = page.getByText("Vorher", { exact: true });
  const after = page.getByText("Nachher", { exact: true });
  await expect(before).toBeVisible();
  await expect(after).toBeVisible();

  const beforeBox = await before.boundingBox();
  const afterBox = await after.boundingBox();
  expect(afterBox?.x ?? 0).toBeGreaterThan(beforeBox?.x ?? 0);
  expect(Math.abs((afterBox?.y ?? 0) - (beforeBox?.y ?? 0))).toBeLessThan(2);
});
