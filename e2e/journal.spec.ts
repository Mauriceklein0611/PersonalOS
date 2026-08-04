import { expect, test } from "@playwright/test";

test("stores a short and a full evening reflection for the local day", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/journal");

  await expect(
    page.getByText("Für diesen Tag ist noch nichts gespeichert."),
  ).toBeVisible();

  const mood = page.getByRole("group", { name: "Stimmung" });
  await mood.getByRole("radio", { name: "4 von 5" }).check();
  await expect(page.getByText("Nicht gespeicherte Änderungen")).toBeVisible();
  await page.getByRole("button", { name: "Eintrag speichern" }).click();
  await expect(page.getByText(/^Gespeichert um /)).toBeVisible();

  await page.reload();
  await expect(mood.getByRole("radio", { name: "4 von 5" })).toBeChecked();
  await expect(
    page.getByRole("group", { name: "Stress" }).getByRole("radio", {
      name: "Keine Angabe",
    }),
  ).toBeChecked();
  await expect(
    page.getByText("Für diesen Tag ist ein Eintrag gespeichert."),
  ).toBeVisible();

  await page
    .getByRole("group", { name: "Energie" })
    .getByRole("radio", { name: "3 von 5" })
    .check();
  await page
    .getByRole("group", { name: "Stress" })
    .getByRole("radio", { name: "2 von 5" })
    .check();
  await page
    .getByRole("group", { name: "Produktivität" })
    .getByRole("radio", { name: "5 von 5" })
    .check();
  await page
    .getByRole("textbox", { name: "Highlight des Tages" })
    .fill("Langer Spaziergang");
  await page
    .getByRole("textbox", { name: "Was möchtest du anders machen?" })
    .fill("Früher Feierabend");
  await page
    .getByRole("textbox", { name: "Wofür bist du dankbar?" })
    .fill("Ruhige Stunde");
  await page
    .getByRole("textbox", { name: "Freitext" })
    .fill("Der Tag war insgesamt ruhig.");

  await expect(
    page.getByRole("button", { name: "Vorheriger Tag" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Eintrag speichern" }).click();
  await expect(page.getByText(/^Gespeichert um /)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vorheriger Tag" }),
  ).toBeEnabled();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Freitext" })).toHaveValue(
    "Der Tag war insgesamt ruhig.",
  );
  await expect(
    page.getByRole("button", { name: /^Eintrag vom .+ bearbeiten$/ }),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "Vorheriger Tag" }).click();
  await expect(
    page.getByText("Für diesen Tag ist noch nichts gespeichert."),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Freitext" })).toHaveValue("");

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
