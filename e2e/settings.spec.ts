import { expect, test } from "@playwright/test";

/*
 * #26: Die Einstellungen waren der einzige Kernbereich ohne E2E. Sie sind
 * genau der Ort, an dem ein gespeicherter Wert die übrige App verändert —
 * eine Komponentenprüfung allein kann das nicht zeigen.
 */
test("stores the overview currency and the time zone for the whole app", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/einstellungen");

  const currency = page.getByRole("combobox", { name: /Übersichtswährung/ });
  await expect(currency).toHaveValue("EUR");

  await currency.selectOption("CHF");
  await expect(
    page.getByText("Die Übersichtswährung wurde gespeichert."),
  ).toBeVisible();

  const timeZone = page.getByRole("combobox", { name: /Zeitzone/ });
  await timeZone.selectOption("Pacific/Auckland");
  await expect(page.getByText("Die Zeitzone wurde gespeichert.")).toBeVisible();

  // Der Datensatz überlebt den Neustart; erkannte Vorgaben gelten nur, solange
  // nichts gespeichert ist.
  await page.reload();
  await expect(currency).toHaveValue("CHF");
  await expect(timeZone).toHaveValue("Pacific/Auckland");

  /*
   * Und er wirkt außerhalb seiner Seite: Die Monatsübersicht rechnet in der
   * gespeicherten Währung und nennt sie als Datenbasis. Eine Einstellung, die
   * nur auf ihrer eigenen Seite steht, wäre keine.
   *
   * Geprüft wird ein Zustand, den eine frische Datenbank sicher erreicht.
   * Die Schnellerfassung der Tagesübersicht taugt dafür nicht: Ohne
   * Ausgabenkategorie tritt an ihre Stelle ein Hinweis, und ihr Text wäre nur
   * während des Ladens zu sehen.
   */
  await page.goto("/geld");
  await expect(page.getByText(/, in CHF/).first()).toBeVisible();
});

test("keeps an optional daily budget optional", async ({ page }) => {
  await page.goto("/einstellungen");

  const capacity = page.getByRole("spinbutton", {
    name: /Tagesbudget in Minuten/,
  });
  await expect(capacity).toHaveValue("");

  // Eine unmögliche Angabe wird benannt und nicht gespeichert.
  await capacity.fill("0");
  await capacity.blur();
  await expect(
    page.getByText(/Gib eine ganze Zahl zwischen 1 und 1440 Minuten ein/),
  ).toBeVisible();

  await capacity.fill("300");
  await capacity.blur();
  await expect(
    page.getByText("Das Tagesbudget wurde gespeichert."),
  ).toBeVisible();

  await page.reload();
  await expect(capacity).toHaveValue("300");

  // Leer heißt „kein Budget", nicht „null Minuten".
  await capacity.fill("");
  await capacity.blur();
  await expect(page.getByText("Das Tagesbudget wurde entfernt.")).toBeVisible();
  await page.reload();
  await expect(capacity).toHaveValue("");
});
