import { Toast } from "../../../components/ui";
import { monthOf } from "../repository";
import type { SavingsService } from "../savings-service";
import type { FinanceService } from "../service";
import "./finance-page.css";
import { BudgetSection } from "./BudgetSection";
import { CategorySection } from "./CategorySection";
import { ForecastSection } from "./ForecastSection";
import { formatMonth } from "./format";
import { MonthOverview } from "./MonthOverview";
import { RecurringSection } from "./RecurringSection";
import { SavingsPanel } from "./SavingsPanel";
import { TransactionForm } from "./TransactionForm";
import { TransactionList } from "./TransactionList";
import { useFinancePage } from "./use-finance-page";

export type FinancePageProps = {
  /** Übersichtswährung; ohne Angabe gilt `baseCurrency` aus den Einstellungen. */
  currency?: string;
  now?: () => Date;
  savingsService?: SavingsService;
  service?: FinanceService;
  timeZone?: string;
};

export function FinancePage(props: FinancePageProps) {
  const page = useFinancePage(props);
  // Als Konstante bleibt die Aktion im Klick-Handler eindeutig vorhanden.
  const undo = page.undo;

  return (
    <section aria-labelledby="page-title" className="route-page finance-page">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="page-eyebrow">Überblick</p>
          <h1 id="page-title">Finanzen</h1>
          <p className="page-description">
            Erfasse Einnahmen und Ausgaben manuell und vollständig lokal. Diese
            Ansicht ist keine Buchhaltung und keine Finanzberatung.
          </p>
        </div>
      </header>

      {page.error ? (
        <p className="page-alert finance-error" role="alert">
          {page.error}
        </p>
      ) : null}

      {page.isLoading ? (
        <p className="finance-status" role="status">
          Finanzübersicht wird geladen …
        </p>
      ) : (
        <div className="page-grid">
          {/* Erfassen steht vor dem Auswerten — auf jeder Breite. */}
          <TransactionForm
            categories={page.categories}
            currency={page.currency}
            onSubmit={page.createTransaction}
            today={page.today}
          />

          {/* Vorschläge stehen beim Erfassen, nicht bei der Auswertung. */}
          <RecurringSection
            categories={page.categories}
            categoriesById={page.categoriesById}
            currency={page.currency}
            due={page.dueRecurring}
            onArchive={page.archiveRecurringTemplate}
            onConfirm={page.confirmRecurring}
            onCreate={page.createRecurringTemplate}
            templates={page.recurringTemplates}
          />

          <ForecastSection
            currency={page.currency}
            forecast={page.forecast}
            monthLabel={formatMonth(page.budgetMonth)}
          />

          <MonthOverview
            categoriesById={page.categoriesById}
            currency={page.currency}
            error={page.monthOverview.error}
            monthLabel={formatMonth(page.budgetMonth)}
            onNextMonth={() => page.shiftBudgetMonth(1)}
            onPreviousMonth={() => page.shiftBudgetMonth(-1)}
            overview={page.monthOverview.overview}
          />

          <TransactionList
            categories={page.categories}
            categoriesById={page.categoriesById}
            currentMonth={monthOf(page.today)}
            onArchive={(entry) => void page.archiveTransaction(entry)}
            transactions={page.transactions}
          />

          <BudgetSection
            categories={page.categories}
            categoriesById={page.categoriesById}
            currency={page.currency}
            entries={page.budgetEntries}
            month={page.budgetMonth}
            onRemove={(budget) => void page.removeBudget(budget)}
            onSave={page.setBudget}
            summary={page.monthOverview.overview?.budget}
          />

          <SavingsPanel
            currency={page.currency}
            now={props.now}
            onChange={() => void page.reloadSavings()}
            service={props.savingsService}
            timeZone={page.timeZone}
            transactions={page.transactions}
          />

          <CategorySection
            categories={page.categories}
            onCreate={page.createCategory}
            onRemove={(category) => void page.removeCategory(category)}
            onToggleFixedCost={(category, isFixedCost) =>
              void page.setCategoryFixedCost(category, isFixedCost)
            }
          />
        </div>
      )}

      {page.notice ? (
        <div className="finance-toast-region">
          <Toast
            action={
              undo
                ? {
                    label: "Rückgängig",
                    onClick: () => void page.runUndo(undo),
                  }
                : undefined
            }
            message={page.notice}
            onDismiss={page.dismissNotice}
          />
        </div>
      ) : null}
    </section>
  );
}

export function Component() {
  return <FinancePage />;
}
