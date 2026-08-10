import { monthOfDay, shiftMonth } from "./budget";
import type { Transaction } from "./model";

/** Höchstens zwölf Monate; darüber wird die Linie unlesbar. */
export const maximumTrendMonths = 12;

export type CategoryTrendPoint = {
  /** `null` heißt: Für diesen Monat gibt es keine Grundlage — nicht 0 €. */
  amountMinor: number | null;
  month: string;
};

export type CategoryTrend = {
  categoryId: string;
  /** Monate mit Grundlage; darunter ist keine Aussage über einen Verlauf möglich. */
  monthsWithBasis: number;
  points: CategoryTrendPoint[];
};

export type CategoryTrendInput = {
  categoryId: string;
  months?: number;
  /** Der letzte dargestellte Monat, üblicherweise der laufende. */
  untilMonth: string;
  transactions: readonly Transaction[];
};

/**
 * Der Verlauf einer Ausgabenkategorie über bis zu zwölf Monate.
 *
 * Ein Monat **ohne jede Buchung** hat keine Grundlage und wird als Lücke
 * ausgegeben, nicht als 0 €: In einem Monat, in dem gar nichts erfasst wurde,
 * ist „0 € für Lebensmittel" eine Behauptung. Ein Monat **mit** Buchungen,
 * aber ohne eine in dieser Kategorie, ist dagegen eine echte Null — dort wurde
 * erfasst und für diese Kategorie eben nichts ausgegeben.
 */
export function buildCategoryTrend({
  categoryId,
  months = maximumTrendMonths,
  untilMonth,
  transactions,
}: CategoryTrendInput): CategoryTrend {
  const active = transactions.filter(
    (transaction) =>
      transaction.archivedAt === undefined && transaction.kind === "expense",
  );
  const anyBookingIn = new Set(
    transactions
      .filter((transaction) => transaction.archivedAt === undefined)
      .map((transaction) => monthOfDay(transaction.bookedOn)),
  );

  const points: CategoryTrendPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const month = shiftMonth(untilMonth, -offset);
    if (!anyBookingIn.has(month)) {
      points.push({ amountMinor: null, month });
      continue;
    }
    points.push({
      amountMinor: active
        .filter(
          (transaction) =>
            transaction.categoryId === categoryId &&
            monthOfDay(transaction.bookedOn) === month,
        )
        .reduce(
          (total, transaction) => total + transaction.money.amountMinor,
          0,
        ),
      month,
    });
  }

  return {
    categoryId,
    monthsWithBasis: points.filter((point) => point.amountMinor !== null)
      .length,
    points,
  };
}

/**
 * Die Textzusammenfassung neben der Grafik, wie `UI_GUIDELINES.md` sie
 * verlangt. Sie nennt die Richtung und die beiden Zahlen, aus denen sie
 * stammt — ohne Ursache, ohne Bewertung und ohne Prozentwert ohne Bezug.
 */
export function describeCategoryTrend(
  trend: CategoryTrend,
  formatMoney: (amountMinor: number) => string,
  formatMonth: (month: string) => string,
): string {
  const withBasis = trend.points.filter(
    (point): point is { amountMinor: number; month: string } =>
      point.amountMinor !== null,
  );

  if (withBasis.length === 0) {
    return "Für diesen Zeitraum ist keine Buchung erfasst.";
  }
  if (withBasis.length === 1) {
    const [only] = withBasis;
    return `Nur ${formatMonth(only!.month)} hat eine Grundlage: ${formatMoney(only!.amountMinor)}. Für einen Verlauf braucht es mindestens zwei Monate.`;
  }

  const first = withBasis[0]!;
  const last = withBasis[withBasis.length - 1]!;
  const difference = last.amountMinor - first.amountMinor;
  // Der Vergleichspartikel gehört zur Richtung: „höher als“, aber „gleich
  // hoch wie“.
  const direction =
    difference === 0
      ? "gleich hoch wie"
      : difference > 0
        ? "höher als"
        : "niedriger als";

  const gaps = trend.points.length - withBasis.length;
  const gapNote =
    gaps === 0
      ? ""
      : ` ${gaps} ${gaps === 1 ? "Monat hat" : "Monate haben"} keine Grundlage und ${gaps === 1 ? "fehlt" : "fehlen"} in der Linie.`;

  return `${formatMonth(last.month)}: ${formatMoney(last.amountMinor)} — ${direction} ${formatMonth(first.month)} mit ${formatMoney(first.amountMinor)}. Grundlage: ${withBasis.length} Monate mit Buchungen.${gapNote}`;
}
