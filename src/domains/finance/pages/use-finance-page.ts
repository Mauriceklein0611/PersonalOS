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
  SavingsContribution,
  SavingsGoal,
  Transaction,
  TransactionDetails,
} from "../model";
import { buildMonthlyOverview, type MonthlyOverview } from "../overview";
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
  isLoading: boolean;
  monthOverview: { error?: string; overview?: MonthlyOverview };
  notice: string | undefined;
  timeZone: string;
  today: CalendarDay;
  transactions: Transaction[];
  undo: FinanceUndoAction | undefined;
  archiveTransaction: (entry: Transaction) => Promise<void>;
  createCategory: (details: FinanceCategoryDetails) => Promise<boolean>;
  createTransaction: (details: TransactionDetails) => Promise<boolean>;
  dismissNotice: () => void;
  reloadSavings: () => Promise<void>;
  removeBudget: (budget: MonthlyBudget) => Promise<void>;
  removeCategory: (category: FinanceCategory) => Promise<void>;
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

  /*
   * Die Monatsübersicht ist schreibgeschützt und wird bei jeder Änderung neu
   * gerechnet. Gemischte Währungen werden benannt statt umgerechnet.
   */
  const monthOverview = useMemo(() => {
    try {
      return {
        overview: buildMonthlyOverview({
          budgets,
          contributions: savingsContributions,
          currency,
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
    currency,
    savingsContributions,
    savingsGoals,
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
    archiveTransaction,
    budgetEntries,
    budgetMonth,
    categories,
    categoriesById,
    createCategory,
    createTransaction,
    currency,
    dismissNotice,
    error,
    isLoading,
    monthOverview,
    notice,
    reloadSavings,
    removeBudget,
    removeCategory,
    runUndo,
    setBudget,
    shiftBudgetMonth,
    timeZone,
    today,
    transactions,
    undo,
  };
}
