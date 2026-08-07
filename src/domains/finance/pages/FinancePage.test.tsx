import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createMemoryFinanceService } from "../../../test/factories/finance";
import { createMemorySavingsService } from "../../../test/factories/savings";
import type { FinanceService } from "../service";
import { FinancePage } from "./FinancePage";

const fixedNow = new Date("2026-08-04T10:00:00.000Z");

function renderPage(service: FinanceService) {
  return render(
    <FinancePage
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
    screen.getByRole("textbox", { name: /Betrag in Euro/ }),
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

  it("rejects an unreadable amount with a correction hint", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await user.type(
      screen.getByRole("textbox", { name: /Betrag in Euro/ }),
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
