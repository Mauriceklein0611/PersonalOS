import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Button,
  EmptyState,
  IconButton,
  Input,
  MetricTile,
  ProgressBar,
  Select,
  Textarea,
  Toast,
} from "../../../components/ui";
import {
  calculateBudgetUsage,
  MixedCurrencyError,
  shiftMonth,
  type BudgetUsage,
} from "../budget";
import { calendarDayForInstant } from "../../../lib/dates/calendar-days";
import type { CalendarDay } from "../../../lib/dates/date-values";
import {
  createMoney,
  formatMoney,
  formatSignedMinorUnits,
  parseMoneyInput,
} from "../../../lib/money/money";
import { defaultFinanceCategories } from "../default-categories";
import {
  createTransactionFormValues,
  isCategoryNameValid,
  toTransactionDetails,
  type TransactionFormErrors,
  type TransactionFormValues,
} from "../finance-form-values";
import {
  financeKindLabels,
  financeKinds,
  type FinanceCategory,
  type FinanceKind,
  type MonthlyBudget,
  type Transaction,
} from "../model";
import { monthOf } from "../repository";
import {
  calculateTotals,
  personalOsFinanceService,
  type FinanceService,
} from "../service";
import "./finance-page.css";

/** Währungsumrechnung ist nicht im Scope; das MVP rechnet in einer Währung. */
const currency = "EUR";

type FinanceUndoAction = {
  message: string;
  run: () => Promise<unknown>;
};

export type FinancePageProps = {
  now?: () => Date;
  service?: FinanceService;
  timeZone?: string;
};

export function FinancePage({
  now = () => new Date(),
  service = personalOsFinanceService,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: FinancePageProps) {
  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [undo, setUndo] = useState<FinanceUndoAction>();

  const [values, setValues] = useState<TransactionFormValues>(() =>
    createTransactionFormValues(today),
  );
  const [formErrors, setFormErrors] = useState<TransactionFormErrors>({});
  const [categoryName, setCategoryName] = useState("");
  const [categoryKind, setCategoryKind] = useState<FinanceKind>("expense");
  const [categoryError, setCategoryError] = useState<string>();

  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [budgetMonth, setBudgetMonth] = useState<string>(() => monthOf(today));
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetError, setBudgetError] = useState<string>();

  const [monthFilter, setMonthFilter] = useState<string>(() => monthOf(today));
  const [kindFilter, setKindFilter] = useState<FinanceKind | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const reload = useCallback(async () => {
    const [storedCategories, storedTransactions, storedBudgets] =
      await Promise.all([
        service.listCategories(),
        service.listTransactions(),
        service.listBudgets(budgetMonth),
      ]);
    setCategories(storedCategories);
    setTransactions(storedTransactions);
    setBudgets(storedBudgets);
  }, [budgetMonth, service]);

  // Ein Monatswechsel lädt die Budgets dieses Monats nach.
  useEffect(() => {
    let isCurrent = true;
    void service
      .listBudgets(budgetMonth)
      .then((stored) => {
        if (isCurrent) setBudgets(stored);
      })
      .catch(() => {
        if (isCurrent) setBudgets([]);
      });
    return () => {
      isCurrent = false;
    };
  }, [budgetMonth, service]);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const storedCategories = await service.listCategories();
      // Ohne Kategorie ist keine Buchung möglich. Die Startwerte sind
      // synthetisch und vollständig editierbar.
      if (storedCategories.length === 0) {
        for (const details of defaultFinanceCategories) {
          await service.createCategory(details);
        }
      }
      const [freshCategories, storedTransactions] = await Promise.all([
        service.listCategories(),
        service.listTransactions(),
      ]);
      if (!isCurrent) return;
      setCategories(freshCategories);
      setTransactions(storedTransactions);
      setIsLoading(false);
    };

    void load().catch(() => {
      if (!isCurrent) return;
      setError("Die Finanzübersicht konnte nicht geladen werden.");
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [service]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const months = useMemo(() => {
    const known = new Set(transactions.map((entry) => monthOf(entry.bookedOn)));
    known.add(monthOf(today));
    return [...known].sort().reverse();
  }, [today, transactions]);

  const visibleTransactions = useMemo(
    () =>
      transactions.filter((entry) => {
        if (monthFilter !== "all" && monthOf(entry.bookedOn) !== monthFilter) {
          return false;
        }
        if (kindFilter !== "all" && entry.kind !== kindFilter) return false;
        if (categoryFilter !== "all" && entry.categoryId !== categoryFilter) {
          return false;
        }
        return true;
      }),
    [categoryFilter, kindFilter, monthFilter, transactions],
  );

  const totals = useMemo(
    () => calculateTotals(visibleTransactions, currency),
    [visibleTransactions],
  );

  // Gemischte Währungen werden nicht umgerechnet, sondern benannt.
  const budgetUsages = useMemo(
    () =>
      budgets.map((budget) => {
        try {
          return { budget, usage: calculateBudgetUsage(budget, transactions) };
        } catch (thrown) {
          return {
            budget,
            error:
              thrown instanceof MixedCurrencyError
                ? thrown.message
                : "Das Budget konnte nicht berechnet werden.",
          };
        }
      }) as Array<{
        budget: MonthlyBudget;
        error?: string;
        usage?: BudgetUsage;
      }>,
    [budgets, transactions],
  );

  const runAction = useCallback(
    async (action: () => Promise<unknown>, failure: string) => {
      setError(undefined);
      try {
        await action();
        await reload();
        return true;
      } catch {
        setError(failure);
        return false;
      }
    },
    [reload],
  );

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = toTransactionDetails(values, currency);
    if (!result.ok) {
      setFormErrors(result.errors);
      return;
    }

    setFormErrors({});
    const saved = await runAction(
      () => service.createTransaction(result.details),
      "Die Buchung konnte nicht gespeichert werden.",
    );
    if (saved) {
      setValues(createTransactionFormValues(today, values.kind));
      setNotice("Die Buchung wurde gespeichert.");
      setUndo(undefined);
    }
  }

  async function archiveTransaction(entry: Transaction) {
    const archived = await runAction(
      () => service.archiveTransaction(entry.id),
      "Die Buchung konnte nicht archiviert werden.",
    );
    if (archived) {
      setNotice("Die Buchung wurde archiviert.");
      setUndo({
        message: "Die Buchung ist wieder sichtbar.",
        run: () => service.restoreTransaction(entry.id),
      });
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCategoryNameValid(categoryName)) {
      setCategoryError("Gib einen Namen mit mindestens einem Zeichen ein.");
      return;
    }

    setCategoryError(undefined);
    const created = await runAction(
      () =>
        service.createCategory({
          kind: categoryKind,
          name: categoryName.trim(),
        }),
      "Die Kategorie konnte nicht gespeichert werden.",
    );
    if (created) {
      setCategoryName("");
      setNotice("Die Kategorie wurde angelegt.");
      setUndo(undefined);
    }
  }

  async function removeCategory(category: FinanceCategory) {
    setError(undefined);
    try {
      const removal = await service.removeCategory(category.id);
      await reload();
      if (removal.kind === "archived") {
        setNotice(
          `„${category.name}“ wird noch von ${removal.usageCount} Buchung${
            removal.usageCount === 1 ? "" : "en"
          } genutzt und wurde deshalb archiviert. Die Buchungen bleiben erhalten.`,
        );
        setUndo({
          message: "Die Kategorie ist wieder aktiv.",
          run: () => service.restoreCategory(category.id),
        });
      } else {
        setNotice(`„${category.name}“ wurde entfernt.`);
        setUndo(undefined);
      }
    } catch {
      setError("Die Kategorie konnte nicht entfernt werden.");
    }
  }

  async function submitBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (budgetCategoryId.length === 0) {
      setBudgetError("Wähle eine Kategorie.");
      return;
    }

    const amount = parseMoneyInput(budgetAmount, currency);
    if (!amount.ok) {
      setBudgetError(
        amount.reason === "precision"
          ? "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 250,00."
          : "Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 250,00.",
      );
      return;
    }

    setBudgetError(undefined);
    const saved = await runAction(
      () =>
        service.setBudget({
          categoryId: budgetCategoryId,
          limit: amount.money,
          month: budgetMonth,
        }),
      "Das Budget konnte nicht gespeichert werden.",
    );
    if (saved) {
      setBudgetAmount("");
      setNotice("Das Budget wurde gespeichert.");
      setUndo(undefined);
    }
  }

  async function removeBudget(budget: MonthlyBudget) {
    const removed = await runAction(
      () => service.removeBudget(budget.id),
      "Das Budget konnte nicht entfernt werden.",
    );
    if (removed) {
      setNotice("Das Budget wurde entfernt.");
      setUndo({
        message: "Das Budget ist wieder gesetzt.",
        // Ein Budget ist eine Einstellung; derselbe Stand lässt sich exakt
        // wiederherstellen, auch wenn der Datensatz neu angelegt wird.
        run: () =>
          service.setBudget({
            categoryId: budget.categoryId,
            limit: budget.limit,
            month: budget.month,
          }),
      });
    }
  }

  async function runUndo(action: FinanceUndoAction) {
    setUndo(undefined);
    const done = await runAction(
      action.run,
      "Die Aktion konnte nicht rückgängig gemacht werden.",
    );
    if (done) setNotice(action.message);
  }

  const selectableCategories = categories.filter(
    (category) => category.kind === values.kind,
  );

  return (
    <section aria-labelledby="page-title" className="route-page finance-page">
      <p className="page-eyebrow">Überblick</p>
      <h1 id="page-title">Finanzen</h1>
      <p className="page-description">
        Erfasse Einnahmen und Ausgaben manuell und vollständig lokal. Diese
        Ansicht ist keine Buchhaltung und keine Finanzberatung.
      </p>

      {error ? (
        <p className="finance-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="finance-status" role="status">
          Finanzübersicht wird geladen …
        </p>
      ) : (
        <>
          <div className="finance-metrics">
            <MetricTile
              context="Im gewählten Zeitraum"
              label="Einnahmen"
              value={formatMoney(totals.income)}
            />
            <MetricTile
              context="Im gewählten Zeitraum"
              label="Ausgaben"
              value={formatMoney(totals.expense)}
            />
            <MetricTile
              context="Einnahmen abzüglich Ausgaben"
              label="Saldo"
              value={formatSignedMinorUnits(totals.balanceMinor, currency)}
            />
          </div>

          <h2>Buchung erfassen</h2>
          {/* Die eigene Prüfung nennt Problem und Korrektur; die native
              Browsermeldung würde sie nur verdecken. */}
          <form
            className="finance-form"
            noValidate
            onSubmit={(event) => void submitTransaction(event)}
          >
            <Select
              label="Art"
              onChange={(event) => {
                const kind = event.currentTarget.value as FinanceKind;
                setValues((current) => ({ ...current, categoryId: "", kind }));
              }}
              value={values.kind}
            >
              {financeKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {financeKindLabels[kind]}
                </option>
              ))}
            </Select>
            <Input
              error={formErrors.amount}
              hint="Zum Beispiel 12,50. Die Richtung ergibt sich aus der Art."
              inputMode="decimal"
              label="Betrag in Euro"
              onChange={(event) => {
                const amount = event.currentTarget.value;
                setValues((current) => ({ ...current, amount }));
              }}
              required
              value={values.amount}
            />
            <Select
              error={formErrors.categoryId}
              label="Kategorie der Buchung"
              onChange={(event) => {
                const categoryId = event.currentTarget.value;
                setValues((current) => ({ ...current, categoryId }));
              }}
              required
              value={values.categoryId}
            >
              <option value="">Bitte wählen</option>
              {selectableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Input
              error={formErrors.bookedOn}
              label="Datum"
              onChange={(event) => {
                const bookedOn = event.currentTarget.value;
                setValues((current) => ({ ...current, bookedOn }));
              }}
              required
              type="date"
              value={values.bookedOn}
            />
            <Textarea
              hint="Optional, zum Beispiel ein kurzer Verwendungszweck."
              label="Notiz"
              onChange={(event) => {
                const description = event.currentTarget.value;
                setValues((current) => ({ ...current, description }));
              }}
              value={values.description}
            />
            <Button type="submit">Buchung speichern</Button>
          </form>

          <h2>Buchungen</h2>
          <div className="finance-filters">
            <Select
              label="Monat"
              onChange={(event) => setMonthFilter(event.currentTarget.value)}
              value={monthFilter}
            >
              <option value="all">Alle Monate</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </Select>
            <Select
              label="Art der Buchung"
              onChange={(event) =>
                setKindFilter(event.currentTarget.value as FinanceKind | "all")
              }
              value={kindFilter}
            >
              <option value="all">Alle Arten</option>
              {financeKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {financeKindLabels[kind]}
                </option>
              ))}
            </Select>
            <Select
              label="Kategoriefilter"
              onChange={(event) => setCategoryFilter(event.currentTarget.value)}
              value={categoryFilter}
            >
              <option value="all">Alle Kategorien</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          {visibleTransactions.length === 0 ? (
            <EmptyState
              description="Für diese Auswahl ist keine Buchung erfasst."
              title="Keine Buchung"
            />
          ) : (
            <ul className="finance-list">
              {visibleTransactions.map((entry) => (
                <li key={entry.id}>
                  <div className="finance-list-copy">
                    <h3>
                      {categoriesById.get(entry.categoryId)?.name ??
                        "Entfernte Kategorie"}
                    </h3>
                    <p>
                      {financeKindLabels[entry.kind]} am{" "}
                      {formatDay(entry.bookedOn)}
                      {entry.description ? ` · ${entry.description}` : ""}
                    </p>
                  </div>
                  <p className="finance-list-amount">
                    {formatSignedMinorUnits(
                      entry.kind === "income"
                        ? entry.money.amountMinor
                        : -entry.money.amountMinor,
                      entry.money.currency,
                    )}
                  </p>
                  <IconButton
                    label={`Buchung vom ${formatDay(entry.bookedOn)} archivieren`}
                    onClick={() => void archiveTransaction(entry)}
                  >
                    ×
                  </IconButton>
                </li>
              ))}
            </ul>
          )}

          <h2>Budgets</h2>
          <div className="finance-month-nav">
            <Button
              onClick={() => setBudgetMonth((month) => shiftMonth(month, -1))}
              variant="secondary"
            >
              Vorheriger Monat
            </Button>
            <p className="finance-month-label">{formatMonth(budgetMonth)}</p>
            <Button
              onClick={() => setBudgetMonth((month) => shiftMonth(month, 1))}
              variant="secondary"
            >
              Nächster Monat
            </Button>
          </div>

          <form
            className="finance-category-form"
            noValidate
            onSubmit={(event) => void submitBudget(event)}
          >
            <Select
              label="Kategorie für das Budget"
              onChange={(event) => {
                setBudgetCategoryId(event.currentTarget.value);
                setBudgetError(undefined);
              }}
              value={budgetCategoryId}
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
              error={budgetError}
              hint="Monatlicher Betrag, zum Beispiel 250,00."
              inputMode="decimal"
              label="Budget in Euro"
              onChange={(event) => {
                setBudgetAmount(event.currentTarget.value);
                setBudgetError(undefined);
              }}
              value={budgetAmount}
            />
            <Button type="submit" variant="secondary">
              Budget speichern
            </Button>
          </form>

          {budgetUsages.length === 0 ? (
            <EmptyState
              description="Für diesen Monat ist kein Budget gesetzt."
              title="Kein Budget"
            />
          ) : (
            <ul className="finance-budget-list">
              {budgetUsages.map(({ budget, error, usage }) => (
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
                      onClick={() => void removeBudget(budget)}
                    >
                      ×
                    </IconButton>
                  </div>
                  {error ? (
                    <p className="finance-error">{error}</p>
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

          <h2>Kategorien</h2>
          <p className="finance-hint">
            Die Startwerte sind Beispiele. Eine Kategorie mit Buchungen wird
            archiviert statt gelöscht, damit keine Buchung ihren Bezug verliert.
          </p>
          <form
            className="finance-category-form"
            noValidate
            onSubmit={(event) => void submitCategory(event)}
          >
            <Input
              error={categoryError}
              label="Neue Kategorie"
              onChange={(event) => {
                setCategoryName(event.currentTarget.value);
                setCategoryError(undefined);
              }}
              value={categoryName}
            />
            <Select
              label="Art der Kategorie"
              onChange={(event) =>
                setCategoryKind(event.currentTarget.value as FinanceKind)
              }
              value={categoryKind}
            >
              {financeKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {financeKindLabels[kind]}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Kategorie anlegen
            </Button>
          </form>

          <ul className="finance-list">
            {categories.map((category) => (
              <li key={category.id}>
                <div className="finance-list-copy">
                  <h3>{category.name}</h3>
                  <p>{financeKindLabels[category.kind]}</p>
                </div>
                <IconButton
                  label={`Kategorie „${category.name}“ entfernen`}
                  onClick={() => void removeCategory(category)}
                >
                  ×
                </IconButton>
              </li>
            ))}
          </ul>
        </>
      )}

      {notice ? (
        <div className="finance-toast-region">
          <Toast
            action={
              undo
                ? { label: "Rückgängig", onClick: () => void runUndo(undo) }
                : undefined
            }
            message={notice}
            onDismiss={() => {
              setNotice(undefined);
              setUndo(undefined);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatDay(day: CalendarDay): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}

export function Component() {
  return <FinancePage />;
}
