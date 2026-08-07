import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  financeMonthBudgets,
  financeMonthContributions,
  financeMonthSavingsGoals,
  financeMonthTransactions,
} from "../../../test/fixtures/finance-month";
import { buildMonthlyOverview, type MonthlyOverviewInput } from "../overview";
import { MonthOverview } from "./MonthOverview";

function renderOverview(overrides: Partial<MonthlyOverviewInput> = {}) {
  const overview = buildMonthlyOverview({
    budgets: financeMonthBudgets,
    contributions: financeMonthContributions,
    currency: "EUR",
    month: "2026-08",
    savingsGoals: financeMonthSavingsGoals,
    transactions: financeMonthTransactions,
    ...overrides,
  });

  return render(
    <MonthOverview
      categoriesById={new Map()}
      currency="EUR"
      monthLabel="August 2026"
      onNextMonth={() => undefined}
      onPreviousMonth={() => undefined}
      overview={overview}
    />,
  );
}

describe("MonthOverview figures", () => {
  it("keeps the monthly row to figures of the same scope", () => {
    renderOverview();

    for (const label of ["Einnahmen", "Ausgaben", "Saldo"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // „Budget übrig" misst nur die Kategorien mit Budget und steht deshalb
    // beim Budgetblock; der Gesamt-Sparstand zählt alle Beiträge und steht
    // bei den Sparzielen.
    expect(screen.queryByText("Restbudget")).not.toBeInTheDocument();
    expect(screen.queryByText("Budget übrig")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: "Gesamtstand" }),
    ).not.toBeInTheDocument();
  });
});

describe("MonthOverview savings flow", () => {
  it("separates the bound amount from what stays after saving", () => {
    const linkedExpense = financeMonthTransactions[2]!;
    renderOverview({
      contributions: [
        {
          ...financeMonthContributions[0]!,
          money: linkedExpense.money,
          sourceTransactionId: linkedExpense.id,
        },
      ],
    });

    expect(screen.getByText("Sparen in diesem Monat")).toBeInTheDocument();
    expect(screen.getByText("Davon als Ausgabe gebucht")).toBeInTheDocument();
    expect(screen.getAllByText("245,50 €")).not.toHaveLength(0);
    expect(
      screen.getByText(/Jeder Beitrag ist mit einer Ausgabe verknüpft/),
    ).toBeInTheDocument();
  });

  it("names an unlinked contribution as an extra deduction", () => {
    renderOverview({ contributions: [financeMonthContributions[0]!] });

    expect(
      screen.getByText(/Kein Beitrag ist mit einer Ausgabe verknüpft/),
    ).toBeInTheDocument();
    expect(screen.getByText(/250,00 € sind abgeflossen/)).toBeInTheDocument();
  });

  it("stays quiet in a month without any contribution", () => {
    renderOverview({ contributions: [] });

    expect(
      screen.queryByText("Sparen in diesem Monat"),
    ).not.toBeInTheDocument();
  });
});
