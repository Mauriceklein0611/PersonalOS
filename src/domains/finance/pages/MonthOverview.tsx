import {
  Button,
  Chart,
  MetricTile,
  ProgressBar,
  formatRatio,
  noDataText,
} from "../../../components/ui";
import {
  createMoney,
  formatMoney,
  formatSignedMinorUnits,
} from "../../../lib/money/money";
import type { FinanceCategory } from "../model";
import type { MonthlyOverview } from "../overview";

export type MonthOverviewProps = {
  categoriesById: Map<string, FinanceCategory>;
  /** Übersichtswährung aus den Einstellungen. */
  currency: string;
  /** Bereits formatierter Monat, zum Beispiel „August 2026“. */
  monthLabel: string;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  /** Fehlt, wenn die Verdichtung nicht möglich war. */
  overview?: MonthlyOverview;
  error?: string;
};

/** Höchstens fünf Kategorien; darunter wird die Rangfolge beliebig. */
const maximumCategories = 5;

export function MonthOverview({
  categoriesById,
  currency,
  error,
  monthLabel,
  onNextMonth,
  onPreviousMonth,
  overview,
}: MonthOverviewProps) {
  const period = `${monthLabel}, in ${overview?.currency ?? currency}`;

  return (
    <section className="page-section finance-overview" data-span="full">
      <div className="finance-overview-head">
        <h2>Monatsübersicht</h2>
        <div className="finance-month-nav">
          <Button onClick={onPreviousMonth} variant="secondary">
            Vorheriger Monat
          </Button>
          <p className="finance-month-label">{monthLabel}</p>
          <Button onClick={onNextMonth} variant="secondary">
            Nächster Monat
          </Button>
        </div>
      </div>

      {error ? <p className="finance-error">{error}</p> : null}

      {overview ? (
        <>
          {/* Vier Kennzahlen: zwei Spalten ab 320 px, vier auf dem Desktop. */}
          <div className="ui-dashboard-grid">
            <MetricTile
              context={period}
              label="Einnahmen"
              value={formatMoney(overview.income)}
            />
            <MetricTile
              context={period}
              label="Ausgaben"
              value={formatMoney(overview.expense)}
            />
            <MetricTile
              context={`${period} · Einnahmen abzüglich Ausgaben`}
              label="Saldo"
              value={formatSignedMinorUnits(
                overview.balanceMinor,
                overview.currency,
              )}
            />
            <MetricTile
              context={describeBudgetContext(overview, period)}
              label="Restbudget"
              value={
                overview.budget
                  ? formatSignedMinorUnits(
                      overview.budget.remainingMinor,
                      overview.currency,
                    )
                  : null
              }
            />
          </div>

          <p className="finance-hint">
            {describeComparison(overview)} · Grundlage:{" "}
            {overview.transactionCount}{" "}
            {overview.transactionCount === 1 ? "Buchung" : "Buchungen"} im
            Zeitraum.
          </p>

          <Chart
            categories={topCategories(overview).map(
              (share) =>
                categoriesById.get(share.categoryId)?.name ??
                "Entfernte Kategorie",
            )}
            emptyMessage="Für diesen Monat ist keine Ausgabe erfasst."
            formatValue={(value) =>
              formatMoney(createMoney(value, overview.currency))
            }
            period={period}
            series={[
              {
                id: "expense",
                label: "Ausgaben je Kategorie",
                tone: 2,
                values: topCategories(overview).map(
                  (share) => share.amountMinor,
                ),
              },
            ]}
            source={describeSource(overview)}
            title="Größte Ausgabenkategorien"
            type="bar"
          />

          <ProgressBar
            caption={describeSavings(overview)}
            label="Sparziele"
            value={overview.savings.ratio}
            valueText={
              overview.savings.targetMinor === 0
                ? undefined
                : `${formatMoney(
                    createMoney(overview.savings.savedMinor, overview.currency),
                  )} von ${formatMoney(
                    createMoney(
                      overview.savings.targetMinor,
                      overview.currency,
                    ),
                  )}`
            }
          />
        </>
      ) : null}
    </section>
  );
}

function topCategories(overview: MonthlyOverview) {
  return overview.expenseByCategory.slice(0, maximumCategories);
}

function describeBudgetContext(
  overview: MonthlyOverview,
  period: string,
): string {
  if (overview.budget === undefined) {
    return `${period} · Für diesen Monat ist kein Budget gesetzt.`;
  }
  const { trackedCategoryCount } = overview.budget;
  return `${period} · ${trackedCategoryCount} ${
    trackedCategoryCount === 1 ? "Kategorie" : "Kategorien"
  } mit Budget`;
}

/**
 * Ein fehlender Vergleich wird benannt. Eine erfundene Null wäre eine Aussage
 * über einen Monat, für den nichts vorliegt.
 */
function describeComparison(overview: MonthlyOverview): string {
  const { previousExpense } = overview;
  if (previousExpense.kind === "unavailable") {
    return `Kein Vormonatsvergleich: ${previousExpense.reason}`;
  }

  const difference = formatMoney(
    createMoney(Math.abs(previousExpense.differenceMinor), overview.currency),
  );
  const relative =
    previousExpense.ratio === null
      ? noDataText
      : formatRatio(Math.abs(previousExpense.ratio));

  if (previousExpense.differenceMinor === 0) {
    return "Ausgaben genau wie im Vormonat.";
  }
  return previousExpense.differenceMinor > 0
    ? `${difference} mehr als im Vormonat (${relative}).`
    : `${difference} weniger als im Vormonat (${relative}).`;
}

function describeSource(overview: MonthlyOverview): string {
  const shown = topCategories(overview).length;
  const total = overview.expenseByCategory.length;
  const scope =
    total > shown
      ? `die ${shown} größten von ${total} Kategorien`
      : `alle ${total} ${total === 1 ? "Kategorie" : "Kategorien"}`;

  return `Grundlage: nicht archivierte Ausgaben des Zeitraums, ${scope}.`;
}

function describeSavings(overview: MonthlyOverview): string {
  const { activeGoalCount, targetMinor } = overview.savings;
  if (activeGoalCount === 0) {
    return "Kein aktives Sparziel.";
  }
  if (targetMinor === 0) {
    return `${activeGoalCount} aktive Sparziele ohne Zielbetrag.`;
  }
  return `${activeGoalCount} ${
    activeGoalCount === 1 ? "aktives Sparziel" : "aktive Sparziele"
  }; der Stand zählt alle Beiträge, nicht nur die des Monats.`;
}
