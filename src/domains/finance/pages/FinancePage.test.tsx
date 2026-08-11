import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createMemoryFinanceService } from "../../../test/factories/finance";
import { createMemorySavingsService } from "../../../test/factories/savings";
import type { FinanceService } from "../service";
import { FinancePage } from "./FinancePage";

const fixedNow = new Date("2026-08-04T10:00:00.000Z");

function renderPage(service: FinanceService, currency?: string) {
  return render(
    <FinancePage
      currency={currency}
      now={() => fixedNow}
      savingsService={createMemorySavingsService()}
      service={service}
      timeZone="Europe/Berlin"
    />,
  );
}

async function addExpense(amount: string, category: string, note?: string) {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByRole("combobox", { name: "Art" }), [
    "expense",
  ]);
  await user.type(
    screen.getByRole("textbox", { name: /Betrag in EUR/ }),
    amount,
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: /Kategorie der Buchung/ }),
    [category],
  );
  if (note) {
    await user.type(screen.getByRole("textbox", { name: /Notiz/ }), note);
  }
  await user.click(screen.getByRole("button", { name: "Buchung speichern" }));
}

describe("FinancePage", () => {
  it("offers editable default categories on first use", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);

    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });
    expect(await screen.findAllByText("Lebensmittel")).not.toHaveLength(0);
    expect(screen.getAllByText("Einkommen").length).toBeGreaterThan(0);
  });

  it("stores a German amount exactly and sums it into the totals", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel");

    const expenseTile = screen
      .getByText("Ausgaben")
      .closest(".ui-metric-tile") as HTMLElement;
    expect(within(expenseTile).getByText(/12,50/)).toBeInTheDocument();

    const balanceTile = screen
      .getByText("Saldo")
      .closest(".ui-metric-tile") as HTMLElement;
    expect(within(balanceTile).getByText(/−.*12,50/)).toBeInTheDocument();
  });

  it("names period and currency on every figure of the month", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Monatsübersicht" });

    await addExpense("12,50", "Lebensmittel");

    // Jede Kennzahl nennt Zeitraum und Währung in ihrem Kontexthinweis.
    for (const label of ["Einnahmen", "Ausgaben", "Saldo"]) {
      const tile = screen
        .getByText(label)
        .closest(".ui-metric-tile") as HTMLElement;
      expect(within(tile).getByText(/August 2026, in EUR/)).toBeVisible();
    }
  });

  it("puts the remaining budget with the budgets, not in the monthly row", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Monatsübersicht" });

    await addExpense("12,50", "Lebensmittel");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Kategorie für das Budget/ }),
      ["Lebensmittel"],
    );
    await user.type(
      screen.getByRole("textbox", { name: /Budget in Euro/ }),
      "50,00",
    );
    await user.click(screen.getByRole("button", { name: "Budget speichern" }));

    const tile = (await screen.findByText("Budget übrig")).closest(
      ".ui-metric-tile",
    ) as HTMLElement;
    expect(within(tile).getByText(/37,50/)).toBeVisible();
    // Der Umfang steht am Wert: Er gilt nur für Kategorien mit Budget.
    expect(
      within(tile).getByText(/August 2026, in EUR · 1 Kategorie mit Budget/),
    ).toBeVisible();
    // Die Monatsreihe bleibt bei gleichartigen Zahlen.
    expect(screen.queryByText("Restbudget")).not.toBeInTheDocument();
  });

  // Ohne Vormonatsdaten wird der Grund genannt statt 0 Prozent erfunden.
  it("explains a missing comparison instead of showing zero percent", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Monatsübersicht" });

    await addExpense("12,50", "Lebensmittel");

    expect(
      screen.getByText(
        /Kein Vormonatsvergleich: Für den Vormonat ist keine Buchung erfasst\./,
      ),
    ).toBeVisible();
  });

  it("offers the expense categories as an accessible table", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Monatsübersicht" });

    await addExpense("12,50", "Lebensmittel");

    const table = await screen.findByRole("table", {
      name: "Größte Ausgabenkategorien: Werte als Tabelle",
    });
    const row = within(table).getByRole("row", { name: /Lebensmittel/ });
    expect(within(row).getByRole("cell")).toHaveTextContent(/12,50/);
  });

  it("moves the whole month when the period changes", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Monatsübersicht" });

    await addExpense("12,50", "Lebensmittel");
    await user.click(screen.getByRole("button", { name: "Vorheriger Monat" }));

    const expenseTile = screen
      .getByText("Ausgaben")
      .closest(".ui-metric-tile") as HTMLElement;
    expect(within(expenseTile).getByText(/0,00/)).toBeVisible();
    expect(screen.getByText(/Budgets für Juli 2026/)).toBeVisible();
  });

  // Die Beschriftung muss die Währung nennen, in der tatsächlich gebucht wird.
  it("labels the amount with the configured overview currency", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service, "CHF");
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    expect(
      screen.queryByRole("textbox", { name: /Betrag in Euro/ }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Art" }), [
      "expense",
    ]);
    await user.type(
      screen.getByRole("textbox", { name: /Betrag in CHF/ }),
      "12,50",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Kategorie der Buchung/ }),
      ["Lebensmittel"],
    );
    await user.click(screen.getByRole("button", { name: "Buchung speichern" }));

    const [transaction] = await service.listTransactions();
    expect(transaction?.money).toEqual({ amountMinor: 1250, currency: "CHF" });
  });

  it("rejects an unreadable amount with a correction hint", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await user.type(
      screen.getByRole("textbox", { name: /Betrag in EUR/ }),
      "-5",
    );
    await user.click(screen.getByRole("button", { name: "Buchung speichern" }));

    expect(
      screen.getByText(
        "Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 12,50.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Wähle eine Kategorie.")).toBeInTheDocument();
  });

  it("filters the list by kind", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel");
    expect(screen.queryByText("Keine Buchung")).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Art der Buchung" }),
      ["income"],
    );

    expect(screen.getByText("Keine Buchung")).toBeInTheDocument();
  });

  it("finds a booking by its note and names the match count", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel", "Wocheneinkauf");
    await addExpense("30,00", "Freizeit", "Kinobesuch");

    await user.type(
      screen.getByRole("searchbox", { name: "Buchungen durchsuchen" }),
      "kino",
    );

    expect(
      await screen.findByText("1 von 2 Buchungen in dieser Auswahl"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Kinobesuch/)).toBeInTheDocument();
    expect(screen.queryByText(/Wocheneinkauf/)).not.toBeInTheDocument();
  });

  it("separates an empty result from a selection without bookings", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel", "Wocheneinkauf");
    await user.type(
      screen.getByRole("searchbox", { name: "Buchungen durchsuchen" }),
      "Segeltörn",
    );

    expect(await screen.findByText("Kein Treffer")).toBeInTheDocument();
    expect(screen.queryByText("Keine Buchung")).not.toBeInTheDocument();
  });

  it("shows consumption, remainder and a text summary for a budget", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Kategorie für das Budget/ }),
      ["Lebensmittel"],
    );
    await user.type(
      screen.getByRole("textbox", { name: /Budget in Euro/ }),
      "50,00",
    );
    await user.click(screen.getByRole("button", { name: "Budget speichern" }));

    expect(
      await screen.findByText("Ein Teil des Budgets ist noch offen."),
    ).toBeInTheDocument();
    expect(screen.getByText(/12,50.*von.*50,00/)).toBeInTheDocument();
    expect(screen.getByText(/Rest: .*37,50/)).toBeInTheDocument();
  });

  it("names an exceeded budget without any shaming text", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("60,00", "Lebensmittel");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Kategorie für das Budget/ }),
      ["Lebensmittel"],
    );
    await user.type(
      screen.getByRole("textbox", { name: /Budget in Euro/ }),
      "50,00",
    );
    await user.click(screen.getByRole("button", { name: "Budget speichern" }));

    expect(
      await screen.findByText(
        "Das Budget ist aufgebraucht; darüber hinaus sind weitere Ausgaben gebucht.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Darüber hinaus: .*10,00/)).toBeInTheDocument();
  });

  it("explains the empty state for a month without a budget", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);

    expect(await screen.findByText("Kein Budget")).toBeInTheDocument();
  });

  it("archives a used category instead of breaking its bookings", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel");
    await user.click(
      screen.getByRole("button", {
        name: "Kategorie „Lebensmittel“ entfernen",
      }),
    );

    expect(
      await screen.findByText(/wurde deshalb archiviert/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Die Buchungen bleiben erhalten/)).toBeVisible();
  });
});

describe("FinancePage – wiederkehrende Buchungen", () => {
  async function createTemplate(day: string) {
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Name der Vorlage" }),
      "Miete",
    );
    await user.type(
      screen.getByRole("textbox", { name: /Betrag der Vorlage/ }),
      "950,00",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Kategorie der Vorlage" }),
      ["Wohnen"],
    );
    const dayField = screen.getByRole("spinbutton", { name: "Monatstag" });
    await user.clear(dayField);
    await user.type(dayField, day);
    await user.click(screen.getByRole("button", { name: "Vorlage anlegen" }));
  }

  /**
   * Der Kern von ADR 0013: Eine Vorlage bucht nie von selbst. Das Anlegen
   * allein darf keine Buchung erzeugen — auch nicht, wenn der Monatstag
   * längst erreicht ist.
   */
  it("creates no booking from a template on its own", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await createTemplate("1");

    expect(await screen.findByText(/Die Vorlage wurde angelegt/)).toBeVisible();
    expect(await service.listTransactions()).toEqual([]);
    // Der Vorschlag steht da und wartet.
    expect(
      screen.getByRole("button", { name: /„Miete“ als Buchung übernehmen/ }),
    ).toBeInTheDocument();
  });

  it("writes the booking only once the suggestion is confirmed", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });
    await createTemplate("1");

    await user.click(
      await screen.findByRole("button", {
        name: /„Miete“ als Buchung übernehmen/,
      }),
    );

    expect(
      await screen.findByText(/„Miete“ wurde als Buchung übernommen/),
    ).toBeVisible();
    const [booked] = await service.listTransactions();
    expect(booked?.money.amountMinor).toBe(95_000);
    // Erkennbar als aus einer Vorlage entstanden.
    expect(booked?.recurringTransactionId).toBeDefined();
  });

  it("stops proposing a template that was confirmed this month", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });
    await createTemplate("1");

    await user.click(
      await screen.findByRole("button", {
        name: /„Miete“ als Buchung übernehmen/,
      }),
    );

    expect(
      await screen.findByText("In diesem Monat ist keine Vorlage offen."),
    ).toBeVisible();
  });

  // Der Monatstag liegt in der Zukunft: noch kein Vorschlag, aber die Vorlage
  // steht in der Liste.
  it("waits for the day of month before proposing", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await createTemplate("20");

    expect(
      await screen.findByText("In diesem Monat ist keine Vorlage offen."),
    ).toBeVisible();
    expect(screen.getByText(/Miete · Ausgabe über/)).toBeInTheDocument();
  });
});

describe("FinancePage – frei verfügbar", () => {
  // Ohne gepflegte Fixkosten erscheint die Zahl nicht, statt eine falsche.
  it("shows no figure while no category is kept as a fixed cost", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);

    await screen.findByRole("heading", { level: 2, name: "Monatsübersicht" });
    expect(screen.queryByText("Frei verfügbar")).not.toBeInTheDocument();
  });

  it("names the whole calculation once a fixed cost category exists", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("950,00", "Wohnen");
    await user.click(
      await screen.findByRole("checkbox", { name: /„Wohnen“ sind Fixkosten/ }),
    );

    const tile = (await screen.findByText("Frei verfügbar")).closest(
      ".ui-metric-tile",
    ) as HTMLElement;
    // Keine Empfehlung, keine Bewertung — nur der Rechenweg.
    expect(
      within(tile).getByText(/Einnahmen .* minus gebuchte Fixkosten/),
    ).toBeInTheDocument();
    for (const word of ["solltest", "zu viel", "Achtung", "Empfehlung"]) {
      expect(tile.textContent).not.toContain(word);
    }
  });
});

describe("FinancePage – Monatsschätzung", () => {
  // Ohne zwei abgeschlossene Monate erscheint keine Prognose, sondern der
  // Grund dafür.
  it("names the missing basis instead of guessing", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Schätzung zum Monatsende",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Keine Schätzung: Für eine Schätzung fehlt/),
    ).toBeInTheDocument();
  });

  it("marks the figures as an estimate and offers the calculation path", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    const category = await service.createCategory({
      kind: "expense",
      name: "Lebensmittel",
    });
    for (const bookedOn of ["2026-06-10", "2026-07-10"]) {
      await service.createTransaction({
        bookedOn,
        categoryId: category.id,
        kind: "expense",
        money: { amountMinor: 40_000, currency: "EUR" },
      });
    }
    renderPage(service);

    const section = (
      await screen.findByRole("heading", {
        level: 2,
        name: "Schätzung zum Monatsende",
      })
    ).closest("section") as HTMLElement;

    expect(
      within(section).getByText(/Eine Schätzung, kein Ist-Wert/),
    ).toBeInTheDocument();
    // Keine Zahl ohne Zeitraum.
    expect(
      within(section).getByText(/Erwartete Ausgaben, August 2026/),
    ).toBeInTheDocument();

    await user.click(
      within(section).getByRole("button", { name: "Rechenweg anzeigen" }),
    );
    expect(within(section).getByText("Grundlage")).toBeInTheDocument();
    expect(
      within(section).getByText("Juni 2026, Juli 2026"),
    ).toBeInTheDocument();
  });
});

describe("FinancePage – Ausgabenentwicklung", () => {
  it("summarises the trend in words and shows the line on request", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    const category = await service.createCategory({
      kind: "expense",
      name: "Lebensmittel",
    });
    for (const [bookedOn, amountMinor] of [
      ["2026-06-05", 10_000],
      ["2026-08-05", 12_000],
    ] as const) {
      await service.createTransaction({
        bookedOn,
        categoryId: category.id,
        kind: "expense",
        money: { amountMinor, currency: "EUR" },
      });
    }
    renderPage(service);

    const section = (
      await screen.findByRole("heading", {
        level: 2,
        name: "Ausgabenentwicklung",
      })
    ).closest("section") as HTMLElement;

    // Die Zusammenfassung steht immer, auch ohne die Grafik.
    expect(
      within(section).getByText(/höher als Juni 2026/),
    ).toBeInTheDocument();
    // Zehn der zwölf Monate haben keine Buchung und sind Lücken, keine Nullen.
    expect(
      within(section).getByText(/10 Monate haben keine Grundlage/),
    ).toBeInTheDocument();

    await user.click(
      within(section).getByRole("button", { name: "Linie anzeigen" }),
    );
    expect(
      within(section).getByRole("button", { name: "Linie ausblenden" }),
    ).toBeInTheDocument();
  });
});
