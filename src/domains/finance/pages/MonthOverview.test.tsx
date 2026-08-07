import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  financeMonthBudgets,
  financeMonthContributions,
  financeMonthSavingsGoals,
  financeMonthTransactions,
} from "../../../test/fixtures/finance-month";
import type { SavingsContribution, SavingsGoal } from "../model";
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

const yenGoal: SavingsGoal = {
  ...financeMonthSavingsGoals[1]!,
  status: "active",
  target: { amountMinor: 100_000, currency: "JPY" },
};

const yenContribution: SavingsContribution = {
  ...financeMonthContributions[2]!,
  money: { amountMinor: 50_000, currency: "JPY" },
};

describe("MonthOverview savings", () => {
  it("names a goal that another currency keeps out of the sum", () => {
    renderOverview({
      contributions: [
        financeMonthContributions[0]!,
        financeMonthContributions[1]!,
        yenContribution,
      ],
      savingsGoals: [financeMonthSavingsGoals[0]!, yenGoal],
    });

    expect(
      screen.getByText(
        /Ein Sparziel in einer anderen Währung ist nicht enthalten\./,
      ),
    ).toBeInTheDocument();
    // Die genannte Summe bleibt die des einen gezählten Ziels.
    expect(screen.getByText(/350,00 € von 1\.000,00 €/)).toBeInTheDocument();
  });

  it("stays silent about an exclusion when every goal shares the currency", () => {
    renderOverview();

    expect(screen.getByText(/1 aktives Sparziel in EUR/)).toBeInTheDocument();
    expect(
      screen.queryByText(/in einer anderen Währung/),
    ).not.toBeInTheDocument();
  });

  it("does not show a savings figure when no goal uses the currency", () => {
    renderOverview({
      contributions: [yenContribution],
      savingsGoals: [yenGoal],
    });

    expect(
      screen.getByText(/Kein aktives Sparziel in EUR\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/von 1\.000,00 €/)).not.toBeInTheDocument();
  });
});
