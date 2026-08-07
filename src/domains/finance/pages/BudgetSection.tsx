import { useState, type FormEvent } from "react";

import {
  Button,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
  Select,
} from "../../../components/ui";
import {
  createMoney,
  formatMoney,
  parseMoneyInput,
} from "../../../lib/money/money";
import type { BudgetUsage } from "../budget";
import type {
  FinanceCategory,
  MonthlyBudget,
  MonthlyBudgetDetails,
} from "../model";
import { formatMonth } from "./format";

export type BudgetEntry = {
  budget: MonthlyBudget;
  error?: string;
  usage?: BudgetUsage;
};

export type BudgetSectionProps = {
  categories: readonly FinanceCategory[];
  categoriesById: ReadonlyMap<string, FinanceCategory>;
  currency: string;
  entries: readonly BudgetEntry[];
  /** Der Monat kommt aus der Übersicht und gilt hier mit. */
  month: string;
  onRemove: (budget: MonthlyBudget) => void;
  onSave: (details: MonthlyBudgetDetails) => Promise<boolean>;
};

export function BudgetSection({
  categories,
  categoriesById,
  currency,
  entries,
  month,
  onRemove,
  onSave,
}: BudgetSectionProps) {
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (categoryId.length === 0) {
      setError("Wähle eine Kategorie.");
      return;
    }

    const limit = parseMoneyInput(amount, currency);
    if (!limit.ok) {
      setError(
        limit.reason === "precision"
          ? "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 250,00."
          : "Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 250,00.",
      );
      return;
    }

    setError(undefined);
    if (await onSave({ categoryId, limit: limit.money, month })) {
      setAmount("");
    }
  }

  return (
    <section className="page-section">
      <h2>Budgets</h2>
      <p className="finance-hint">Budgets für {formatMonth(month)}.</p>

      <form
        className="finance-category-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <Select
          label="Kategorie für das Budget"
          onChange={(event) => {
            setCategoryId(event.currentTarget.value);
            setError(undefined);
          }}
          value={categoryId}
        >
          <option value="">Bitte wählen</option>
          {categories
            .filter((category) => category.kind === "expense")
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </Select>
        <Input
          error={error}
          hint="Monatlicher Betrag, zum Beispiel 250,00."
          inputMode="decimal"
          label="Budget in Euro"
          onChange={(event) => {
            setAmount(event.currentTarget.value);
            setError(undefined);
          }}
          value={amount}
        />
        <Button type="submit" variant="secondary">
          Budget speichern
        </Button>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          description="Für diesen Monat ist kein Budget gesetzt."
          title="Kein Budget"
        />
      ) : (
        <ul className="finance-budget-list">
          {entries.map(({ budget, error: usageError, usage }) => (
            <li key={budget.id}>
              <div className="finance-budget-head">
                <h3>
                  {categoriesById.get(budget.categoryId)?.name ??
                    "Entfernte Kategorie"}
                </h3>
                <IconButton
                  label={`Budget für ${
                    categoriesById.get(budget.categoryId)?.name ??
                    "entfernte Kategorie"
                  } entfernen`}
                  onClick={() => onRemove(budget)}
                >
                  ×
                </IconButton>
              </div>
              {usageError ? (
                <p className="finance-error">{usageError}</p>
              ) : usage ? (
                <>
                  <ProgressBar
                    caption={usage.summary}
                    label="Verbraucht"
                    value={usage.ratio}
                    valueText={`${formatMoney(
                      createMoney(usage.spentMinor, usage.currency),
                    )} von ${formatMoney(budget.limit)}`}
                  />
                  <p className="finance-hint">
                    {usage.remainingMinor >= 0
                      ? `Rest: ${formatMoney(
                          createMoney(usage.remainingMinor, usage.currency),
                        )}`
                      : `Darüber hinaus: ${formatMoney(
                          createMoney(
                            Math.abs(usage.remainingMinor),
                            usage.currency,
                          ),
                        )}`}{" "}
                    · {usage.transactionCount}{" "}
                    {usage.transactionCount === 1 ? "Buchung" : "Buchungen"}
                  </p>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
