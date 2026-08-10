import { expect, test } from "@playwright/test";

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

test("completes the whole daily loop offline after the first load", async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();

  await page.goto("/routinen");
  await page.getByRole("button", { name: "Neue Routine" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  await page.getByRole("button", { name: "Routine anlegen" }).click();
  await expect(
    page.getByRole("article", { name: "Abendspaziergang" }),
  ).toBeVisible();

  await page.goto("/");
  await waitForServiceWorker(page);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Heute" }),
    ).toBeVisible();
    await expect(page.getByText("Offline", { exact: true })).toBeVisible();

    // Planen
    await page
      .getByRole("textbox", { name: "Aufgabe für heute" })
      .fill("Rechnung prüfen");
    await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
    await expect(
      page.getByText("Wichtigstes für heute: Rechnung prüfen"),
    ).toBeVisible();

    // Habit-Check-in mit Undo und erneutem Check-in
    await page
      .getByRole("button", { name: "„Abendspaziergang“ heute erledigen" })
      .click();
    await expect(
      page.getByText("Alle 1 fälligen Routinen sind für heute erfasst."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Rückgängig" }).click();
    await expect(
      page.getByRole("button", { name: "„Abendspaziergang“ heute erledigen" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "„Abendspaziergang“ heute erledigen" })
      .click();
    await expect(
      page.getByText("Alle 1 fälligen Routinen sind für heute erfasst."),
    ).toBeVisible();

    // Aufgabe abschließen
    await page
      .getByRole("button", { name: "„Rechnung prüfen“ abschließen" })
      .click();
    await expect(page.getByText("Keine offene Aufgabe")).toBeVisible();

    // Abendreflexion
    await page.goto("/routinen/journal");
    await page
      .getByRole("group", { name: "Stimmung" })
      .getByRole("radio", { name: "4 von 5" })
      .check();
    await page
      .getByRole("textbox", { name: "Highlight des Tages" })
      .fill("Langer Spaziergang");
    await page.getByRole("button", { name: "Eintrag speichern" }).click();
    await expect(page.getByText(/^Gespeichert um /)).toBeVisible();

    // Nichts geht bei Navigation oder Reload verloren
    await page.goto("/");
    await page.reload();
    await expect(
      page.getByText("Für heute ist eine Reflexion gespeichert."),
    ).toBeVisible();
    await expect(
      page.getByText("Heute erfasste Stimmung: 4 von 5."),
    ).toBeVisible();
    await expect(
      page.getByText("Alle 1 fälligen Routinen sind für heute erfasst."),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
  } finally {
    await context.setOffline(false);
  }
});

test("drives the primary daily actions with the keyboard only", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();

  const quickCapture = page.getByRole("textbox", { name: "Aufgabe für heute" });
  await quickCapture.focus();
  await page.keyboard.type("Unterlagen sortieren");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Wichtigstes für heute: Unterlagen sortieren"),
  ).toBeVisible();

  const complete = page.getByRole("button", {
    name: "„Unterlagen sortieren“ abschließen",
  });
  await complete.focus();
  await expect(complete).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Keine offene Aufgabe")).toBeVisible();

  const undo = page.getByRole("button", { name: "Rückgängig" });
  await undo.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 3, name: "Unterlagen sortieren" }),
  ).toBeVisible();

  // Jede primäre Aktion trägt einen eindeutigen, sprechenden Namen.
  for (const name of [
    "Aufgabe hinzufügen",
    "„Unterlagen sortieren“ abschließen",
  ]) {
    await expect(page.getByRole("button", { name })).toHaveCount(1);
  }
});
