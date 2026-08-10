import { expect, test } from "@playwright/test";

test("links a task to a goal and keeps it when the goal is deleted", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });

  // Ziel anlegen.
  await page.goto("/planen/ziele");
  await page.getByRole("textbox", { name: /Titel/ }).fill("Synthetisches Ziel");
  await page.getByRole("button", { name: "Ziel anlegen" }).click();
  await expect(
    page.getByRole("region", { name: "Synthetisches Ziel" }),
  ).toBeVisible();
  await expect(
    page.getByText("Noch nichts mit diesem Ziel verknüpft."),
  ).toBeVisible();

  // Aufgabe anlegen und mit dem Ziel verknüpfen.
  await page.goto("/planen/aufgaben");
  await page
    .getByRole("textbox", { name: "Neue Aufgabe" })
    .fill("Synthetische Aufgabe");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Synthetische Aufgabe" }),
  ).toBeVisible();

  await page.getByLabel(/^Weitere Aktionen für/).click();
  await page.getByRole("button", { name: /bearbeiten$/ }).click();
  const goalSelect = page.getByRole("combobox", { exact: true, name: "Ziel" });
  await expect(goalSelect).toBeVisible();
  await goalSelect.selectOption({ label: "Synthetisches Ziel" });
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  // Erst weiternavigieren, wenn der Schreibvorgang abgeschlossen ist.
  await expect(
    page.getByRole("dialog", { name: /Aufgabe bearbeiten|bearbeiten/ }),
  ).toBeHidden();

  // Die Zielseite zeigt die Verknüpfung.
  await page.goto("/planen/ziele");
  await expect(
    page.getByText("Verknüpft: 1 Aufgabe, davon 0 erledigt."),
  ).toBeVisible();
  await expect(page.getByText("Aufgaben: Synthetische Aufgabe")).toBeVisible();

  // Endgültiges Löschen nennt vorher, was passiert.
  await page.getByRole("button", { name: "Ziel endgültig löschen" }).click();
  const dialog = page.getByRole("dialog", { name: "Ziel endgültig löschen" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("1 Aufgaben und 0 Routinen");
  await dialog.getByRole("button", { name: "Endgültig löschen" }).click();

  await expect(
    page.getByText("Aufgaben und Routinen sind erhalten geblieben."),
  ).toBeVisible();
  await expect(page.getByText("Noch kein Ziel")).toBeVisible();

  // Die Aufgabe existiert weiterhin, nur ohne Zielbezug.
  await page.goto("/planen/aufgaben");
  await expect(page.getByText("Synthetische Aufgabe")).toBeVisible();
});
