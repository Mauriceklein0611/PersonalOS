import { useCallback, useEffect, useMemo, useState } from "react";

import {
  useBaseCurrency,
  useTimeZone,
} from "../../../app/settings/settings-context";
import { calendarDayForInstant } from "../../../lib/dates/calendar-days";
import type { CalendarDay } from "../../../lib/dates/date-values";
import { calculateBudgetUsage, shiftMonth } from "../budget";
import { defaultFinanceCategories } from "../default-categories";
import { MixedCurrencyError } from "../mixed-currency";
import type {
  FinanceCategory,
  FinanceCategoryDetails,
  MonthlyBudget,
  MonthlyBudgetDetails,
  RecurringTransaction,
  RecurringTransactionDetails,
  SavingsContribution,
  SavingsGoal,
  Transaction,
  TransactionDetails,
} from "../model";
import { buildMonthForecast, type MonthForecast } from "../forecast";
import { buildMonthlyOverview, type MonthlyOverview } from "../overview";
import type { DueRecurringTransaction } from "../recurring";
import { monthOf } from "../repository";
import {
  personalOsSavingsService,
  type SavingsService,
} from "../savings-service";
import { personalOsFinanceService, type FinanceService } from "../service";
import type { BudgetEntry } from "./BudgetSection";

export type FinanceUndoAction = {
  message: string;
  run: () => Promise<unknown>;
};

export type FinancePageDependencies = {
  currency?: string;
  now?: () => Date;
  savingsService?: SavingsService;
  service?: FinanceService;
  timeZone?: string;
};

export type FinancePageState = {
  budgetEntries: BudgetEntry[];
  budgetMonth: string;
  categories: FinanceCategory[];
  categoriesById: ReadonlyMap<string, FinanceCategory>;
  currency: string;
  error: string | undefined;
  forecast: MonthForecast;
  isLoading: boolean;
  monthOverview: { error?: string; overview?: MonthlyOverview };
  notice: string | undefined;
  timeZone: string;
  today: CalendarDay;
  transactions: Transaction[];
  undo: FinanceUndoAction | undefined;
  /** Die im laufenden Monat offenen Vorlagen — Vorschläge, keine Buchungen. */
  dueRecurring: DueRecurringTransaction[];
  recurringTemplates: RecurringTransaction[];
  archiveRecurringTemplate: (template: RecurringTransaction) => Promise<void>;
  archiveTransaction: (entry: Transaction) => Promise<void>;
  confirmRecurring: (due: DueRecurringTransaction) => Promise<boolean>;
  createCategory: (details: FinanceCategoryDetails) => Promise<boolean>;
  createRecurringTemplate: (
    details: RecurringTransactionDetails,
  ) => Promise<boolean>;
  createTransaction: (details: TransactionDetails) => Promise<boolean>;
  dismissNotice: () => void;
  reloadSavings: () => Promise<void>;
  removeBudget: (budget: MonthlyBudget) => Promise<void>;
  removeCategory: (category: FinanceCategory) => Promise<void>;
  setCategoryFixedCost: (
    category: FinanceCategory,
    isFixedCost: boolean,
  ) => Promise<void>;
  runUndo: (action: FinanceUndoAction) => Promise<void>;
  setBudget: (details: MonthlyBudgetDetails) => Promise<boolean>;
  shiftBudgetMonth: (offset: number) => void;
};

/**
 * Daten, Aktionen und Rückmeldungen der Finanzseite. Die Seite selbst
 * beschreibt danach nur noch, in welcher Reihenfolge die Abschnitte stehen.
 */
export function useFinancePage({
  currency: currencyOverride,
  now = () => new Date(),
  savingsService = personalOsSavingsService,
  service = personalOsFinanceService,
  timeZone: timeZoneOverride,
}: FinancePageDependencies): FinancePageState {
  /* Währungsumrechnung ist nicht im Scope; das MVP rechnet in einer Währung. */
  const currency = useBaseCurrency(currencyOverride);
  const timeZone = useTimeZone(timeZoneOverride);
  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [budgetMonth, setBudgetMonth] = useState<string>(() => monthOf(today));
  const [recurringTemplates, setRecurringTemplates] = useState<
    RecurringTransaction[]
  >([]);
  const [dueRecurring, setDueRecurring] = useState<DueRecurringTransaction[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [undo, setUndo] = useState<FinanceUndoAction>();

  // Sparziele gehören zur Monatsübersicht und werden deshalb hier gehalten.
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [savingsContributions, setSavingsContributions] = useState<
    SavingsContribution[]
  >([]);

  const reloadSavings = useCallback(async () => {
    const [goals, contributions] = await Promise.all([
      savingsService.listGoals(),
      savingsService.listContributions(),
    ]);
    setSavingsGoals(goals);
    setSavingsContributions(contributions);
  }, [savingsService]);

  const reload = useCallback(async () => {
    const [
      storedCategories,
      storedTransactions,
      storedBudgets,
      storedTemplates,
      storedDue,
    ] = await Promise.all([
      service.listCategories(),
      service.listTransactions(),
      service.listBudgets(budgetMonth),
      service.listRecurringTransactions(),
      service.listDueRecurringTransactions(today),
    ]);
    setCategories(storedCategories);
    setTransactions(storedTransactions);
    setBudgets(storedBudgets);
    setRecurringTemplates(storedTemplates);
    setDueRecurring(storedDue);
  }, [budgetMonth, service, today]);

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
      const [freshCategories, storedTransactions, goals, contributions] =
        await Promise.all([
          service.listCategories(),
          service.listTransactions(),
          savingsService.listGoals(),
          savingsService.listContributions(),
        ]);
      if (!isCurrent) return;
      setCategories(freshCategories);
      setTransactions(storedTransactions);
      setSavingsGoals(goals);
      setSavingsContributions(contributions);
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
  }, [savingsService, service]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  // Die Schätzung gilt dem laufenden Monat. Für einen zurückliegenden Monat
  // gibt es nichts mehr zu erwarten; dort steht das Ist.
  const forecast = useMemo(
    () =>
      buildMonthForecast({
        categories,
        dueTemplates: budgetMonth === monthOf(today) ? dueRecurring : [],
        month: budgetMonth,
        transactions,
      }),
    [budgetMonth, categories, dueRecurring, today, transactions],
  );

  /*
   * Die Monatsübersicht ist schreibgeschützt und wird bei jeder Änderung neu
   * gerechnet. Gemischte Währungen werden benannt statt umgerechnet.
   */
  const monthOverview = useMemo(() => {
    try {
      return {
        overview: buildMonthlyOverview({
          budgets,
          categories,
          contributions: savingsContributions,
          currency,
          // Nur im laufenden Monat sind offene Vorlagen eine Aussage; für
          // einen zurückliegenden Monat wäre „noch offen" sinnlos.
          dueTemplates: budgetMonth === monthOf(today) ? dueRecurring : [],
          month: budgetMonth,
          savingsGoals,
          transactions,
        }),
      };
    } catch (thrown) {
      return {
        error:
          thrown instanceof MixedCurrencyError
            ? thrown.message
            : "Die Monatsübersicht konnte nicht berechnet werden.",
      };
    }
  }, [
    budgetMonth,
    budgets,
    categories,
    currency,
    dueRecurring,
    savingsContributions,
    savingsGoals,
    today,
    transactions,
  ]);

  // Gemischte Währungen werden nicht umgerechnet, sondern benannt.
  const budgetEntries = useMemo<BudgetEntry[]>(
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
      }),
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

  const announce = useCallback(
    (message: string, undoAction?: FinanceUndoAction) => {
      setNotice(message);
      setUndo(undoAction);
    },
    [],
  );

  const createTransaction = useCallback(
    async (details: TransactionDetails) => {
      const saved = await runAction(
        () => service.createTransaction(details),
        "Die Buchung konnte nicht gespeichert werden.",
      );
      if (saved) announce("Die Buchung wurde gespeichert.");
      return saved;
    },
    [announce, runAction, service],
  );

  const archiveTransaction = useCallback(
    async (entry: Transaction) => {
      const archived = await runAction(
        () => service.archiveTransaction(entry.id),
        "Die Buchung konnte nicht archiviert werden.",
      );
      if (archived) {
        announce("Die Buchung wurde archiviert.", {
          message: "Die Buchung ist wieder sichtbar.",
          run: () => service.restoreTransaction(entry.id),
        });
      }
    },
    [announce, runAction, service],
  );

  /**
   * Die einzige Stelle in der Oberfläche, die aus einer Vorlage eine Buchung
   * macht — und sie hängt an einem Klick des Nutzers. Es gibt keinen Effekt,
   * der das beim Laden erledigt. Siehe
   * [ADR 0013](../../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
   */
  const confirmRecurring = useCallback(
    async (due: DueRecurringTransaction) => {
      const saved = await runAction(
        () => service.confirmRecurringTransaction(due),
        "Die Buchung aus der Vorlage konnte nicht gespeichert werden.",
      );
      if (saved) {
        announce(`„${due.template.name}“ wurde als Buchung übernommen.`);
      }
      return saved;
    },
    [announce, runAction, service],
  );

  const createRecurringTemplate = useCallback(
    async (details: RecurringTransactionDetails) => {
      const saved = await runAction(
        () => service.createRecurringTransaction(details),
        "Die Vorlage konnte nicht gespeichert werden.",
      );
      if (saved) announce("Die Vorlage wurde angelegt.");
      return saved;
    },
    [announce, runAction, service],
  );

  const archiveRecurringTemplate = useCallback(
    async (template: RecurringTransaction) => {
      const archived = await runAction(
        () => service.archiveRecurringTransaction(template.id),
        "Die Vorlage konnte nicht archiviert werden.",
      );
      // Bereits erzeugte Buchungen bleiben; nur der Vorschlag verschwindet.
      if (archived) announce("Die Vorlage wird nicht mehr vorgeschlagen.");
    },
    [announce, runAction, service],
  );

  const setCategoryFixedCost = useCallback(
    async (category: FinanceCategory, isFixedCost: boolean) => {
      const saved = await runAction(
        () => service.updateCategory(category.id, { isFixedCost }),
        "Die Kategorie konnte nicht geändert werden.",
      );
      if (saved) {
        announce(
          isFixedCost
            ? `„${category.name}“ zählt jetzt zu den Fixkosten.`
            : `„${category.name}“ zählt nicht mehr zu den Fixkosten.`,
        );
      }
    },
    [announce, runAction, service],
  );

  const createCategory = useCallback(
    async (details: FinanceCategoryDetails) => {
      const created = await runAction(
        () => service.createCategory(details),
        "Die Kategorie konnte nicht gespeichert werden.",
      );
      if (created) announce("Die Kategorie wurde angelegt.");
      return created;
    },
    [announce, runAction, service],
  );

  const removeCategory = useCallback(
    async (category: FinanceCategory) => {
      setError(undefined);
      try {
        const removal = await service.removeCategory(category.id);
        await reload();
        if (removal.kind === "archived") {
          announce(
            `„${category.name}“ wird noch von ${removal.usageCount} Buchung${
              removal.usageCount === 1 ? "" : "en"
            } genutzt und wurde deshalb archiviert. Die Buchungen bleiben erhalten.`,
            {
              message: "Die Kategorie ist wieder aktiv.",
              run: () => service.restoreCategory(category.id),
            },
          );
        } else {
          announce(`„${category.name}“ wurde entfernt.`);
        }
      } catch {
        setError("Die Kategorie konnte nicht entfernt werden.");
      }
    },
    [announce, reload, service],
  );

  const setBudget = useCallback(
    async (details: MonthlyBudgetDetails) => {
      const saved = await runAction(
        () => service.setBudget(details),
        "Das Budget konnte nicht gespeichert werden.",
      );
      if (saved) announce("Das Budget wurde gespeichert.");
      return saved;
    },
    [announce, runAction, service],
  );

  const removeBudget = useCallback(
    async (budget: MonthlyBudget) => {
      const removed = await runAction(
        () => service.removeBudget(budget.id),
        "Das Budget konnte nicht entfernt werden.",
      );
      if (removed) {
        announce("Das Budget wurde entfernt.", {
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
    },
    [announce, runAction, service],
  );

  const runUndo = useCallback(
    async (action: FinanceUndoAction) => {
      setUndo(undefined);
      const done = await runAction(
        action.run,
        "Die Aktion konnte nicht rückgängig gemacht werden.",
      );
      if (done) setNotice(action.message);
    },
    [runAction],
  );

  const dismissNotice = useCallback(() => {
    setNotice(undefined);
    setUndo(undefined);
  }, []);

  const shiftBudgetMonth = useCallback((offset: number) => {
    setBudgetMonth((month) => shiftMonth(month, offset));
  }, []);

  return {
    archiveRecurringTemplate,
    archiveTransaction,
    budgetEntries,
    budgetMonth,
    categories,
    categoriesById,
    confirmRecurring,
    createCategory,
    createRecurringTemplate,
    createTransaction,
    dueRecurring,
    recurringTemplates,
    currency,
    dismissNotice,
    error,
    forecast,
    isLoading,
    monthOverview,
    notice,
    reloadSavings,
    removeBudget,
    removeCategory,
    runUndo,
    setBudget,
    setCategoryFixedCost,
    shiftBudgetMonth,
    timeZone,
    today,
    transactions,
    undo,
  };
}
