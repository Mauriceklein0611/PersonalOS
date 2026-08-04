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
