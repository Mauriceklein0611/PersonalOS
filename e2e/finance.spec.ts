import { expect, test } from "@playwright/test";

test("records income and expenses and protects used categories", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/finanzen");

  await expect(
    page.getByRole("heading", { level: 1, name: "Finanzen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Buchung erfassen" }),
  ).toBeVisible();

  // Eine unlesbare Eingabe nennt das Problem und die erwartete Korrektur.
  await page.getByRole("textbox", { name: /Betrag in Euro/ }).fill("12,345");
  await page.getByRole("button", { name: "Buchung speichern" }).click();
  await expect(
    page.getByText(
      "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 12,50.",
    ),
  ).toBeVisible();

  await page.getByRole("textbox", { name: /Betrag in Euro/ }).fill("12,50");
  await page
    .getByRole("combobox", { name: /Kategorie der Buchung/ })
    .selectOption({ label: "Lebensmittel" });
  await page.getByRole("button", { name: "Buchung speichern" }).click();

  await expect(page.getByText("Die Buchung wurde gespeichert.")).toBeVisible();

  // Exakt, weil die Saldo-Kachel den Kontext "Einnahmen abzüglich Ausgaben"
  // trägt und sonst mitmatchen würde.
  const expenseTile = page
    .locator(".ui-metric-tile")
    .filter({ has: page.getByText("Ausgaben", { exact: true }) });
  await expect(expenseTile).toContainText("12,50");

  // Einnahme gegenbuchen und den Saldo prüfen.
  await page
    .getByRole("combobox", { exact: true, name: "Art" })
    .selectOption("income");
  await page.getByRole("textbox", { name: /Betrag in Euro/ }).fill("20,00");
  await page
    .getByRole("combobox", { name: /Kategorie der Buchung/ })
    .selectOption({ label: "Einkommen" });
  await page.getByRole("button", { name: "Buchung speichern" }).click();

  const balanceTile = page
    .locator(".ui-metric-tile")
    .filter({ has: page.getByText("Saldo", { exact: true }) });
  await expect(balanceTile).toContainText("7,50");

  // Der Filter grenzt die Liste ein, ohne Daten zu verändern.
  await page
    .getByRole("combobox", { name: "Art der Buchung" })
    .selectOption("expense");
  const transactionList = page.locator("ul.finance-list").first();
  await expect(
    transactionList.getByRole("heading", { name: "Lebensmittel" }),
  ).toBeVisible();
  await expect(
    transactionList.getByRole("heading", { name: "Einkommen" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Art der Buchung" })
    .selectOption("all");

  // Eine benutzte Kategorie wird archiviert statt gelöscht.
  await page
    .getByRole("button", { name: "Kategorie „Lebensmittel“ entfernen" })
    .click();
  await expect(page.getByText(/wurde deshalb archiviert/)).toBeVisible();
  await expect(page.getByText(/Die Buchungen bleiben erhalten/)).toBeVisible();

  await page.reload();
  await expect(
    page
      .locator(".ui-metric-tile")
      .filter({ has: page.getByText("Ausgaben", { exact: true }) }),
  ).toContainText("12,50");

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
