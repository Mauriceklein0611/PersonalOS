import { expect, test } from "@playwright/test";

test("creates a habit, checks it in and reflects it in the week view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/gewohnheiten");

  await page.getByRole("button", { name: "Neue Gewohnheit" }).click();
  await page.getByRole("textbox", { name: /Name/ }).fill("Abendspaziergang");
  await page.getByRole("button", { name: "Gewohnheit anlegen" }).click();

  const card = page.getByRole("article", { name: "Abendspaziergang" });
  await expect(card).toBeVisible();

  await page.reload();
  await expect(card).toBeVisible();

  await page
    .getByRole("button", { name: "„Abendspaziergang“ heute erledigen" })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Heute schon erfasst" }),
  ).toBeVisible();
  await expect(card.getByText("Erledigt", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /^Woche/ }).click();
  const weekTable = page.getByRole("table");
  await expect(weekTable).toBeVisible();
  await expect(
    weekTable.getByRole("button", { name: /Abendspaziergang.*Erledigt/ }),
  ).toBeVisible();
  // Nicht fällige Tage sind keine Schaltfläche, nennen ihren Zustand aber als
  // Text für assistive Technik.
  await expect(weekTable.getByText(/: Nicht fällig$/).first()).toBeAttached();

  await page.getByRole("tab", { name: /^Fortschritt/ }).click();
  await expect(page.getByText(/Zeitraum: /)).toBeVisible();
  await expect(page.getByText(/Berechnungsbasis: /)).toBeVisible();

  await page.getByRole("tab", { name: /^Heute/ }).click();
  await page
    .getByRole("button", { name: "„Abendspaziergang“ archivieren" })
    .click();
  await expect(card).toBeHidden();
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(card).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
