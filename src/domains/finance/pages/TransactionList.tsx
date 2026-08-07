import { useMemo, useState } from "react";

import {
  EmptyState,
  IconButton,
  SearchField,
  Select,
} from "../../../components/ui";
import { formatSignedMinorUnits } from "../../../lib/money/money";
import { createSearchMatcher } from "../../../lib/text/search-terms";
import {
  financeKindLabels,
  financeKinds,
  type FinanceCategory,
  type FinanceKind,
  type Transaction,
} from "../model";
import { monthOf } from "../repository";
import { formatDay, formatMonth } from "./format";

export type TransactionListProps = {
  categories: readonly FinanceCategory[];
  categoriesById: ReadonlyMap<string, FinanceCategory>;
  /** Der laufende Monat; er steht auch ohne Buchung zur Auswahl. */
  currentMonth: string;
  onArchive: (entry: Transaction) => void;
  transactions: readonly Transaction[];
};

export function TransactionList({
  categories,
  categoriesById,
  currentMonth,
  onArchive,
  transactions,
}: TransactionListProps) {
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth);
  const [kindFilter, setKindFilter] = useState<FinanceKind | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const months = useMemo(() => {
    const known = new Set(transactions.map((entry) => monthOf(entry.bookedOn)));
    known.add(currentMonth);
    return [...known].sort().reverse();
  }, [currentMonth, transactions]);

  const selectedTransactions = useMemo(
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

  // Die Suche greift nach den Auswahlfeldern. Sie durchsucht die Notiz und den
  // Kategorienamen, weil dieser in der Zeile als Überschrift steht.
  const matcher = useMemo(() => createSearchMatcher(searchTerm), [searchTerm]);
  const visibleTransactions = useMemo(
    () =>
      matcher.isActive
        ? selectedTransactions.filter((entry) =>
            matcher.matches(
              entry.description,
              categoriesById.get(entry.categoryId)?.name,
            ),
          )
        : selectedTransactions,
    [categoriesById, matcher, selectedTransactions],
  );

  return (
    <section className="page-section">
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

      <SearchField
        hint="Sucht in Notiz und Kategoriename der ausgewählten Buchungen."
        label="Buchungen durchsuchen"
        onChange={setSearchTerm}
        placeholder="Zum Beispiel Miete"
        resultLabel={
          matcher.isActive
            ? `${visibleTransactions.length} von ${selectedTransactions.length} Buchungen in dieser Auswahl`
            : undefined
        }
        value={searchTerm}
      />

      {visibleTransactions.length === 0 ? (
        matcher.isActive ? (
          <EmptyState
            description={`Zu „${searchTerm.trim()}“ passt in dieser Auswahl keine Buchung. Prüfe die Schreibweise oder weite die Filter aus.`}
            title="Kein Treffer"
          />
        ) : (
          <EmptyState
            description="Für diese Auswahl ist keine Buchung erfasst."
            title="Keine Buchung"
          />
        )
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
                  {financeKindLabels[entry.kind]} am {formatDay(entry.bookedOn)}
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
                onClick={() => onArchive(entry)}
              >
                ×
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
