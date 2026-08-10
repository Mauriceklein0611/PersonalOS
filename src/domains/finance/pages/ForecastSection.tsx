import { useState } from "react";

import { Button } from "../../../components/ui";
import { formatSignedMinorUnits } from "../../../lib/money/money";
import type { MonthForecast } from "../forecast";
import { formatMonth } from "./format";

export type ForecastSectionProps = {
  currency: string;
  forecast: MonthForecast;
  /** Bereits formatierter Monat, zum Beispiel „August 2026“. */
  monthLabel: string;
};

/**
 * Optisch und sprachlich von den Ist-Werten getrennt: eigener Abschnitt, das
 * Wort „Schätzung" in Überschrift und Text, und kein Wert ohne Zeitraum. Der
 * Rechenweg steht auf Abruf daneben, damit die Zahl nachvollziehbar ist statt
 * behauptet.
 */
export function ForecastSection({
  currency,
  forecast,
  monthLabel,
}: ForecastSectionProps) {
  const [showsPath, setShowsPath] = useState(false);
  const money = (minor: number) => formatSignedMinorUnits(minor, currency);

  return (
    <section
      aria-labelledby="finance-forecast-title"
      className="page-section finance-forecast"
      data-span="full"
    >
      <h2 id="finance-forecast-title">Schätzung zum Monatsende</h2>

      {forecast.kind === "unavailable" ? (
        <p className="finance-hint" role="status">
          Keine Schätzung: {forecast.reason}
        </p>
      ) : (
        <>
          <p className="finance-hint">
            Eine Schätzung, kein Ist-Wert. Sie beruht auf den Buchungen dieses
            Monats, den noch offenen Vorlagen und dem Durchschnitt aus{" "}
            {forecast.basisMonths.length} abgeschlossenen Monaten.
          </p>

          <dl className="finance-forecast-figures">
            <div>
              <dt>Erwartete Einnahmen, {monthLabel}</dt>
              <dd>{money(forecast.expectedIncomeMinor)}</dd>
            </div>
            <div>
              <dt>Erwartete Ausgaben, {monthLabel}</dt>
              <dd>{money(forecast.expectedExpenseMinor)}</dd>
            </div>
            <div>
              <dt>Erwarteter Saldo, {monthLabel}</dt>
              <dd>{money(forecast.expectedBalanceMinor)}</dd>
            </div>
          </dl>

          <Button
            aria-expanded={showsPath}
            onClick={() => setShowsPath((shown) => !shown)}
            variant="secondary"
          >
            {showsPath ? "Rechenweg ausblenden" : "Rechenweg anzeigen"}
          </Button>

          {showsPath ? (
            <dl className="finance-forecast-path">
              <div>
                <dt>Grundlage</dt>
                <dd>
                  {forecast.basisMonths
                    .map((month) => formatMonth(month))
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt>Bereits gebuchte Ausgaben</dt>
                <dd>{money(forecast.bookedExpenseMinor)}</dd>
              </div>
              <div>
                <dt>Noch offene Fixkostenvorlagen</dt>
                <dd>{money(forecast.openFixedMinor)}</dd>
              </div>
              <div>
                <dt>Durchschnittliche variable Ausgaben</dt>
                <dd>{money(forecast.averageVariableMinor)}</dd>
              </div>
              <div>
                <dt>Davon in diesem Monat noch erwartet</dt>
                <dd>{money(forecast.expectedRemainingVariableMinor)}</dd>
              </div>
              <div>
                <dt>Bereits gebuchte Einnahmen</dt>
                <dd>{money(forecast.bookedIncomeMinor)}</dd>
              </div>
              <div>
                <dt>Noch offene Einnahmevorlagen</dt>
                <dd>{money(forecast.openIncomeMinor)}</dd>
              </div>
            </dl>
          ) : null}
        </>
      )}
    </section>
  );
}
