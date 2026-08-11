import { expect, test } from "@playwright/test";

test("records income and expenses and protects used categories", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/geld");

  await expect(
    page.getByRole("heading", { level: 1, name: "Geld" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Buchung erfassen" }),
  ).toBeVisible();

  // Eine unlesbare Eingabe nennt das Problem und die erwartete Korrektur.
  await page.getByRole("textbox", { name: /Betrag in EUR/ }).fill("12,345");
  await page.getByRole("button", { name: "Buchung speichern" }).click();
  await expect(
    page.getByText(
      "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 12,50.",
    ),
  ).toBeVisible();

  await page.getByRole("textbox", { name: /Betrag in EUR/ }).fill("12,50");
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
  await page.getByRole("textbox", { name: /Betrag in EUR/ }).fill("20,00");
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

  // Budget setzen und Verbrauch prüfen.
  await page
    .getByRole("combobox", { name: /Kategorie für das Budget/ })
    .selectOption({ label: "Sonstige Ausgaben" });
  await page.getByRole("textbox", { name: /Budget in EUR/ }).fill("20,00");
  await page.getByRole("button", { name: "Budget speichern" }).click();
  await expect(page.getByText("Das Budget wurde gespeichert.")).toBeVisible();
  await expect(
    page.getByText("Für diese Kategorie ist kein Betrag vorgesehen."),
  ).toHaveCount(0);

  // Ein Monatswechsel zeigt den Leerzustand statt fremder Zahlen.
  const emptyBudget = page.getByRole("heading", {
    level: 3,
    name: "Kein Budget",
  });
  await page.getByRole("button", { name: "Vorheriger Monat" }).click();
  await expect(emptyBudget).toBeVisible();
  await page.getByRole("button", { name: "Nächster Monat" }).click();
  await expect(emptyBudget).toHaveCount(0);

  // Die Monatsübersicht nennt Zeitraum und Währung und erklärt den fehlenden
  // Vormonatsvergleich, statt ihn als 0 Prozent zu erfinden.
  await expect(
    page.getByRole("heading", { level: 2, name: "Monatsübersicht" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Kein Vormonatsvergleich: Für den Vormonat/),
  ).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: "Größte Ausgabenkategorien: Werte als Tabelle",
    }),
  ).toBeAttached();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("counts a linked contribution once and names the bound amount", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/geld");

  // Eine Ausgabe, die eine Sparbewegung ist: Sie verlässt das Konto einmal.
  await page.getByRole("textbox", { name: /Betrag in EUR/ }).fill("250,00");
  await page
    .getByRole("combobox", { name: /Kategorie der Buchung/ })
    .selectOption({ label: "Sonstige Ausgaben" });
  await page.getByRole("button", { name: "Buchung speichern" }).click();
  await expect(page.getByText("Die Buchung wurde gespeichert.")).toBeVisible();

  const balanceTile = page
    .locator(".ui-metric-tile")
    .filter({ has: page.getByText("Saldo", { exact: true }) });
  await expect(balanceTile).toContainText("250,00");

  await page
    .getByRole("textbox", { name: /Name des Sparziels/ })
    .fill("Synthetische Rücklage");
  await page
    .getByRole("textbox", { name: /Zielbetrag in EUR/ })
    .fill("1.000,00");
  await page.getByRole("button", { name: "Sparziel anlegen" }).click();
  await page
    .getByRole("button", {
      name: "Verlauf von „Synthetische Rücklage“ anzeigen",
    })
    .click();

  await page.getByRole("textbox", { name: /Beitrag in EUR/ }).fill("250,00");
  await page
    .getByRole("combobox", { name: /Belegende Ausgabe/ })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Beitrag hinzufügen" }).click();
  await expect(page.getByText("Der Beitrag wurde gespeichert.")).toBeVisible();
  await expect(
    page.getByText(/Mit einer Ausgabe verknüpft/).first(),
  ).toBeVisible();

  // Der Betrag steckt in den Ausgaben und wird nicht ein zweites Mal
  // abgezogen: „Nach Sparen übrig" bleibt gleich dem Saldo.
  const flow = page.locator(".finance-savings-flow");
  await expect(flow.getByText("Davon als Ausgabe gebucht")).toBeVisible();
  await expect(flow).toContainText("250,00");
  await expect(
    flow.getByText(/Jeder Beitrag ist mit einer Ausgabe verknüpft/),
  ).toBeVisible();
  await expect(
    flow.locator("div").filter({ hasText: "Nach Sparen übrig" }),
  ).toContainText("250,00");

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("tracks a savings goal only through its contributions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/geld");

  // Der Gesamtstand steht seit #71 hier und nicht mehr in der Monatsreihe.
  const panel = page.locator(".savings-panel");
  await expect(
    panel.getByRole("heading", { level: 2, name: "Sparziele" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Kein Sparziel" }),
  ).toBeVisible();

  // Ein Sparziel ohne Frist ist ein gültiger Zustand.
  await page
    .getByRole("textbox", { name: /Name des Sparziels/ })
    .fill("Synthetische Rücklage");
  await page
    .getByRole("textbox", { name: /Zielbetrag in EUR/ })
    .fill("1.000,00");
  await page.getByRole("button", { name: "Sparziel anlegen" }).click();
  await expect(page.getByText("Das Sparziel wurde angelegt.")).toBeVisible();
  await expect(page.getByText(/0 Beiträge · Ohne Frist/)).toBeVisible();

  await page
    .getByRole("button", {
      name: "Verlauf von „Synthetische Rücklage“ anzeigen",
    })
    .click();
  await page.getByRole("textbox", { name: /Beitrag in EUR/ }).fill("250,00");
  await page.getByRole("button", { name: "Beitrag hinzufügen" }).click();

  // Zweimal: als Gesamtstand über alle Ziele und am Ziel selbst.
  await expect(panel.getByText(/250,00.*von.*1\.000,00/)).toHaveCount(2);
  await expect(
    panel.getByRole("progressbar", { name: "Gesamtstand" }),
  ).toBeVisible();
  await expect(panel.getByText(/Noch offen: .*750,00/)).toBeVisible();

  // Der Stand kommt aus den Beiträgen und überlebt einen Neustart.
  await page.reload();
  await expect(panel.getByText(/250,00.*von.*1\.000,00/)).toHaveCount(2);

  await page
    .getByRole("button", {
      name: "Verlauf von „Synthetische Rücklage“ anzeigen",
    })
    .click();
  await page
    .getByRole("button", { name: /Beitrag vom .* zurücknehmen/ })
    .click();
  await expect(panel.getByText(/0,00.*von.*1\.000,00/)).toHaveCount(2);
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(panel.getByText(/250,00.*von.*1\.000,00/)).toHaveCount(2);

  // Endgültiges Löschen nennt vorher die betroffenen Beiträge.
  await page
    .getByRole("button", { name: "Sparziel endgültig löschen" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Sparziel endgültig löschen",
  });
  await expect(dialog).toContainText("1 Beitrag wird mitgelöscht");
  await dialog.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(
    page.getByRole("heading", { level: 3, name: "Kein Sparziel" }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

/*
 * #107: Zwei gleichzeitig gezeichnete Diagramme galten als Ursache dafür, dass
 * die Finanzseite unbedienbar wurde. Sie waren es nicht — ein `formatValue`,
 * das an einem berechneten Achsen-Teilstrich warf, riss die ganze Route in die
 * Fehlergrenze, und der Test klickte auf eine Seite, die gerade verschwand.
 *
 * Der Test hält beides fest: Zwei Zeichenflächen kommen nebeneinander an, und
 * die Seite bleibt danach bedienbar.
 */
test("stays operable while two charts are drawn at once", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/geld");

  await page.getByRole("textbox", { name: /Betrag in EUR/ }).fill("250,00");
  await page
    .getByRole("combobox", { name: /Kategorie der Buchung/ })
    .selectOption({ label: "Lebensmittel" });
  await page.getByRole("button", { name: "Buchung speichern" }).click();
  await expect(page.getByText("Die Buchung wurde gespeichert.")).toBeVisible();

  // Erst die Monatsübersicht allein, dann die Ausgabenlinie dazu.
  const plots = page.locator(".ui-chart-plot svg");
  await expect(plots).toHaveCount(1);
  await page.getByRole("button", { name: "Linie anzeigen" }).click();
  await expect(plots).toHaveCount(2);

  // Keine Fehlergrenze: Die Ansicht steht noch, samt beider Wertetabellen.
  await expect(page.getByText("Unerwarteter Darstellungsfehler")).toHaveCount(
    0,
  );
  await expect(page.getByText(/konnte nicht gezeichnet werden/)).toHaveCount(0);
  await expect(
    page.getByRole("table", { name: /Werte als Tabelle/ }),
  ).toHaveCount(2);

  // Bedienbar heißt: Ein Klick kommt an, während beide Diagramme stehen.
  await page
    .getByRole("textbox", { name: /Name des Sparziels/ })
    .fill("Synthetische Rücklage");
  await page.getByRole("textbox", { name: /Zielbetrag in EUR/ }).fill("500,00");
  await page.getByRole("button", { name: "Sparziel anlegen" }).click();
  await expect(page.getByText("Das Sparziel wurde angelegt.")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Verlauf von „Synthetische Rücklage“ anzeigen",
    })
    .click();
  await page.getByRole("textbox", { name: /Beitrag in EUR/ }).fill("100,00");
  await page.getByRole("button", { name: "Beitrag hinzufügen" }).click();
  await expect(page.getByText("Der Beitrag wurde gespeichert.")).toBeVisible();

  await expect(plots).toHaveCount(2);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
