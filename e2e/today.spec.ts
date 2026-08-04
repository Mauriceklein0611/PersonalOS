import { expect, test } from "@playwright/test";

test("walks through a complete synthetic day on the dashboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  await expect(
    page.getByText(
      "Für heute steht keine Aufgabe an. Du kannst den Tag frei einteilen.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Keine offene Aufgabe")).toBeVisible();
  await expect(page.getByText("Nichts fällig")).toBeVisible();

  await page
    .getByRole("textbox", { name: "Aufgabe für heute" })
    .fill("Rechnung prüfen");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(
    page.getByText("Wichtigstes für heute: Rechnung prüfen"),
  ).toBeVisible();

  await page.goto("/gewohnheiten");
  await page.getByRole("button", { name: "Neue Gewohnheit" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  await page.getByRole("button", { name: "Gewohnheit anlegen" }).click();
  await expect(
    page.getByRole("article", { name: "Abendspaziergang" }),
  ).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 3, name: "Abendspaziergang" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "„Abendspaziergang“ heute erledigen" })
    .click();
  await expect(
    page.getByText("Alle 1 fälligen Gewohnheiten sind für heute erfasst."),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "„Rechnung prüfen“ abschließen" })
    .click();
  await expect(page.getByText("Keine offene Aufgabe")).toBeVisible();

  await page.goto("/journal");
  await page
    .getByRole("group", { name: "Stimmung" })
    .getByRole("radio", { name: "4 von 5" })
    .check();
  await page.getByRole("button", { name: "Eintrag speichern" }).click();
  await expect(page.getByText(/^Gespeichert um /)).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByText("Für heute ist eine Reflexion gespeichert."),
  ).toBeVisible();
  await expect(
    page.getByText("Heute erfasste Stimmung: 4 von 5."),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
