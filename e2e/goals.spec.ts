import { expect, test } from "@playwright/test";

test("takes a goal from creation through milestones to completion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/planen/ziele");

  await expect(
    page.getByRole("heading", { level: 1, name: "Ziele" }),
  ).toBeVisible();
  await expect(page.getByText("Noch kein Ziel")).toBeVisible();

  // Ein leerer Titel nennt Problem und Korrektur.
  await page.getByRole("button", { name: "Ziel anlegen" }).click();
  await expect(
    page.getByText("Gib einen Titel mit mindestens einem Zeichen ein."),
  ).toBeVisible();

  await page.getByRole("textbox", { name: /Titel/ }).fill("Synthetisches Ziel");
  await page.getByRole("button", { name: "Ziel anlegen" }).click();

  const detail = page.getByRole("region", { name: "Synthetisches Ziel" });
  await expect(detail).toBeVisible();
  // Ohne Meilenstein bleibt der Fortschritt neutral statt null Prozent.
  await expect(detail.getByText("Keine Angabe")).toBeVisible();

  for (const title of ["Erster Schritt", "Zweiter Schritt"]) {
    await page.getByRole("textbox", { name: /Neuer Meilenstein/ }).fill(title);
    await page.getByRole("button", { name: "Meilenstein hinzufügen" }).click();
    await expect(page.getByRole("checkbox", { name: title })).toBeVisible();
  }

  await page.getByRole("checkbox", { name: "Erster Schritt" }).click();
  await expect(
    detail.getByText("1 von 2 Meilensteinen abgeschlossen."),
  ).toBeVisible();
  await expect(
    detail.getByRole("progressbar", { name: "Fortschritt" }),
  ).toHaveJSProperty("value", 50);

  await page.getByRole("checkbox", { name: "Zweiter Schritt" }).click();
  await expect(
    detail.getByText("2 von 2 Meilensteinen abgeschlossen."),
  ).toBeVisible();

  await detail.getByRole("button", { name: "Abgeschlossen" }).click();
  await expect(
    page.getByText("Der Status ist jetzt „Abgeschlossen“."),
  ).toBeVisible();

  // Aus einem Endzustand führt der Weg zuerst zurück in "Aktiv".
  await expect(
    detail.getByRole("button", { name: "Nicht weiterverfolgt" }),
  ).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Aktiv" })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("region", { name: "Synthetisches Ziel" }),
  ).toBeVisible();
  await expect(
    page.getByText("2 von 2 Meilensteinen abgeschlossen."),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
