import {
  Button,
  Chart,
  MetricTile,
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
  categoriesById: ReadonlyMap<string, FinanceCategory>;
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
          {/*
            Nur monatsbezogene Zahlen desselben Umfangs. „Budget übrig" steht
            beim Budgetblock, der Gesamt-Sparfortschritt bei den Sparzielen:
            Beide messen etwas anderes als den Monat und widersprächen hier
            der Reihe, ohne falsch zu sein.
          */}
          <div className="ui-dashboard-grid" data-columns="3">
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
          </div>

          {/*
            Ohne eine als Fixkosten gepflegte Kategorie fehlt die Zahl ganz.
            Eine Aufteilung ohne Fixkosten wäre keine Aussage, sondern eine
            falsche.
          */}
          {overview.freelyAvailable ? (
            <div className="finance-freely-available">
              <MetricTile
                context={describeFreelyAvailable(overview)}
                label="Frei verfügbar"
                value={formatSignedMinorUnits(
                  overview.freelyAvailable.amountMinor,
                  overview.currency,
                )}
              />
            </div>
          ) : null}

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

          {overview.savingsThisMonth.contributionCount > 0 ? (
            <section
              aria-labelledby="finance-savings-flow-title"
              className="finance-savings-flow"
            >
              <h3 id="finance-savings-flow-title">Sparen in diesem Monat</h3>
              <dl>
                <div>
                  <dt>Sparbeiträge</dt>
                  <dd>
                    {formatMoney(
                      createMoney(
                        overview.savingsThisMonth.totalMinor,
                        overview.currency,
                      ),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Davon als Ausgabe gebucht</dt>
                  <dd>
                    {formatMoney(
                      createMoney(
                        overview.savingsThisMonth.linkedMinor,
                        overview.currency,
                      ),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Nach Sparen übrig</dt>
                  <dd>
                    {formatSignedMinorUnits(
                      overview.balanceAfterSavingsMinor,
                      overview.currency,
                    )}
                  </dd>
                </div>
              </dl>
              <p className="finance-hint">{describeSavingsFlow(overview)}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function topCategories(overview: MonthlyOverview) {
  return overview.expenseByCategory.slice(0, maximumCategories);
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

/**
 * Erklärt den Unterschied zwischen den beiden Beträgen. Ein verknüpfter
 * Beitrag steckt schon in den Ausgaben; ein unverknüpfter fehlt im Saldo und
 * wird deshalb zusätzlich abgezogen.
 */
function describeSavingsFlow(overview: MonthlyOverview): string {
  const { contributionCount, linkedMinor, unlinkedMinor } =
    overview.savingsThisMonth;
  const basis = `Grundlage: ${contributionCount} ${
    contributionCount === 1 ? "Beitrag" : "Beiträge"
  } mit Datum in diesem Monat.`;

  if (unlinkedMinor === 0) {
    return `Jeder Beitrag ist mit einer Ausgabe verknüpft und zählt genau einmal. ${basis}`;
  }
  if (linkedMinor === 0) {
    return `Kein Beitrag ist mit einer Ausgabe verknüpft. ${formatMoney(
      createMoney(unlinkedMinor, overview.currency),
    )} sind abgeflossen, ohne als Ausgabe gebucht zu sein, und deshalb hier zusätzlich abgezogen. ${basis}`;
  }
  return `${formatMoney(
    createMoney(unlinkedMinor, overview.currency),
  )} sind nicht mit einer Ausgabe verknüpft und deshalb hier zusätzlich abgezogen. ${basis}`;
}

/**
 * Nennt den Rechenweg vollständig, damit die Zahl nachvollziehbar ist statt
 * behauptet. Keine Empfehlung und keine Bewertung — nur, was abgezogen wurde.
 */
function describeFreelyAvailable(overview: MonthlyOverview): string {
  const freely = overview.freelyAvailable;
  if (!freely) return "";
  const money = (minor: number) =>
    formatSignedMinorUnits(minor, overview.currency);

  const parts = [
    `Einnahmen ${money(overview.income.amountMinor)}`,
    `gebuchte Fixkosten ${money(freely.bookedFixedMinor)}`,
  ];
  if (freely.openFixedCount > 0) {
    parts.push(
      `${freely.openFixedCount} noch offene ${
        freely.openFixedCount === 1 ? "Fixkostenvorlage" : "Fixkostenvorlagen"
      } ${money(freely.openFixedMinor)}`,
    );
  }
  parts.push(`geplantes Sparen ${money(freely.plannedSavingsMinor)}`);
  parts.push(`variable Ausgaben ${money(freely.variableMinor)}`);

  return `${parts[0]} minus ${parts.slice(1).join(", ")}.`;
}
