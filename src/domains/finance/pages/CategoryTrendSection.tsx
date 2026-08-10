import { useMemo, useState } from "react";

import { Button, Chart, Select } from "../../../components/ui";
import { createMoney, formatMoney } from "../../../lib/money/money";
import {
  buildCategoryTrend,
  describeCategoryTrend,
  maximumTrendMonths,
} from "../category-trend";
import type { FinanceCategory, Transaction } from "../model";
import { formatMonth } from "./format";

export type CategoryTrendSectionProps = {
  categories: FinanceCategory[];
  currency: string;
  /** Der laufende Monat als letzter Punkt der Linie. */
  month: string;
  transactions: Transaction[];
};

/**
 * Eine Linie, kein Kreis: Gefragt ist die Richtung über die Zeit, und dafür
 * ist die Linie die einzige Form, die nichts dazuerfindet. Monate ohne
 * Grundlage bleiben Lücken — die gemeinsame `Chart` liest `null` genau so.
 */
export function CategoryTrendSection({
  categories,
  currency,
  month,
  transactions,
}: CategoryTrendSectionProps) {
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "expense"),
    [categories],
  );
  const [categoryId, setCategoryId] = useState("");
  const [showsChart, setShowsChart] = useState(false);
  const selectedId = categoryId || expenseCategories[0]?.id || "";

  const trend = useMemo(
    () =>
      selectedId === ""
        ? undefined
        : buildCategoryTrend({
            categoryId: selectedId,
            transactions,
            untilMonth: month,
          }),
    [month, selectedId, transactions],
  );

  const asMoney = (amountMinor: number) =>
    formatMoney(createMoney(amountMinor, currency));

  return (
    <section
      aria-labelledby="finance-trend-title"
      className="page-section finance-trend"
      data-span="full"
    >
      <h2 id="finance-trend-title">Ausgabenentwicklung</h2>

      {expenseCategories.length === 0 ? (
        <p className="finance-hint" role="status">
          Ohne Ausgabenkategorie gibt es keinen Verlauf.
        </p>
      ) : (
        <>
          <Select
            label="Kategorie des Verlaufs"
            onChange={(event) => setCategoryId(event.currentTarget.value)}
            value={selectedId}
          >
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          {trend ? (
            <>
              <p className="finance-hint">
                {describeCategoryTrend(trend, asMoney, formatMonth)}
              </p>
              <Button
                aria-expanded={showsChart}
                onClick={() => setShowsChart((shown) => !shown)}
                variant="secondary"
              >
                {showsChart ? "Linie ausblenden" : "Linie anzeigen"}
              </Button>
              {showsChart ? (
                <Chart
                  categories={trend.points.map((point) =>
                    formatMonth(point.month),
                  )}
                  emptyMessage="Für diesen Zeitraum ist keine Ausgabe erfasst."
                  formatValue={asMoney}
                  period={`${formatMonth(trend.points[0]!.month)} bis ${formatMonth(month)}`}
                  series={[
                    {
                      id: "trend",
                      label:
                        expenseCategories.find(
                          (category) => category.id === selectedId,
                        )?.name ?? "Kategorie",
                      tone: 1,
                      values: trend.points.map((point) => point.amountMinor),
                    },
                  ]}
                  source={`Grundlage: nicht archivierte Ausgaben dieser Kategorie über ${maximumTrendMonths} Monate. Monate ohne Buchung fehlen in der Linie.`}
                  title="Ausgaben je Monat"
                  type="line"
                />
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
