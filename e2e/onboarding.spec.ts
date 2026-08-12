import { expect, test } from "@playwright/test";

test("guides, skips and completes the local first run", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const guide = page.getByRole("region", {
    name: "PersonalOS lokal einrichten",
  });
  await expect(guide).toBeVisible();
  await expect(
    guide.getByText(/Exerivo-Adresse synchronisiert deine Daten nicht/),
  ).toBeVisible();
  await expect(
    guide.getByRole("button", { name: "Einrichtung abschließen" }),
  ).toBeDisabled();

  // Native Schaltfläche: Fokus und Enter reichen aus, keine Maus ist nötig.
  const skip = guide.getByRole("button", { name: "Überspringen" });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(guide).toBeHidden();
  await expect.poll(() => readDismissedAt(page)).not.toBeNull();
  await page.reload();
  await page.getByRole("heading", { level: 1, name: "Heute" }).waitFor();
  await expect(guide).toBeHidden();

  await page.goto("/einstellungen");
  await page
    .getByRole("button", { name: "Ersteinrichtung erneut anzeigen" })
    .click();
  await expect(
    page.getByText("Die Ersteinrichtung wird auf „Heute“ wieder angezeigt."),
  ).toBeVisible();
  await expect.poll(() => readDismissedAt(page)).toBeNull();
  await page.goto("/");
  await expect(guide).toBeVisible();

  await page
    .getByRole("textbox", { name: "Aufgabe für heute" })
    .fill("Erster lokaler Schritt");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(guide.getByText("1 von 2 Grundlagen")).toBeVisible();

  await guide.getByRole("link", { name: "Routine anlegen" }).click();
  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Morgenroutine");
  await page
    .getByRole("dialog", { name: "Routine anlegen" })
    .getByRole("button", { name: "Routine anlegen" })
    .click();
  await expect(page.getByText("Morgenroutine", { exact: true })).toBeVisible();
  await page.goto("/");

  await expect(guide.getByText("2 von 2 Grundlagen")).toBeVisible();
  await expect(guide.getByText(/ersten Export/)).toBeVisible();
  await guide.getByRole("button", { name: "Einrichtung abschließen" }).click();
  await expect(guide).toBeHidden();
  await expect.poll(() => readDismissedAt(page)).not.toBeNull();
  await page.reload();
  await expect(guide).toBeHidden();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

async function readDismissedAt(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve, reject) => {
        const request = indexedDB.open("personalos");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("settings", "readonly");
          const records = transaction.objectStore("settings").getAll();
          records.onerror = () => reject(records.error);
          records.onsuccess = () => {
            const dismissedAt = records.result[0]?.onboardingDismissedAt;
            database.close();
            resolve(typeof dismissedAt === "string" ? dismissedAt : null);
          };
        };
      }),
  );
}
