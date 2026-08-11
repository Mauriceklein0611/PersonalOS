import { useEffect, useMemo, useState } from "react";

import {
  useTimeZone,
  useWeekStartsOn,
} from "../../../app/settings/settings-context";
import {
  Button,
  MetricTile,
  PageToolbar,
  ViewPurpose,
} from "../../../components/ui";
import {
  calendarDayForInstant,
  type WeekStartsOn,
} from "../../../lib/dates/calendar-days";
import { describePeriod } from "../score-view-model";
import type { ScorePeriod } from "../score-model";
import {
  getWeekPeriod,
  shiftWeek,
  type WeeklyFigure,
  type WeeklyReview,
} from "../weekly-review";
import { personalOsInsightService, type InsightService } from "../service";
import "./weekly-review-page.css";

export type WeeklyReviewPageProps = {
  insightService?: InsightService;
  now?: () => Date;
  timeZone?: string;
  weekStartsOn?: WeekStartsOn;
};

type FigureKey = "tasks" | "habits" | "journal" | "goals" | "finance";

/**
 * Reihenfolge und Beschriftung der fünf Bereiche aus `weekly-review.ts`.
 * Journal geht nur als Tagesanzahl ein — der Freitext bleibt ungelesen.
 */
const figureOrder: readonly { key: FigureKey; label: string }[] = [
  { key: "tasks", label: "Aufgaben" },
  { key: "habits", label: "Routinen" },
  { key: "journal", label: "Journal" },
  { key: "goals", label: "Ziele" },
  { key: "finance", label: "Ausgaben" },
];

const loadFailure = "Der Wochenrückblick konnte nicht geladen werden.";

export function WeeklyReviewPage({
  insightService = personalOsInsightService,
  now = () => new Date(),
  timeZone: timeZoneOverride,
  weekStartsOn: weekStartsOnOverride,
}: WeeklyReviewPageProps) {
  const timeZone = useTimeZone(timeZoneOverride);
  const weekStartsOn = useWeekStartsOn(weekStartsOnOverride);
  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  // Das Blättern über Wochen stammt aus `InsightsPage` (dort war es an denselben
  // Wochenblock gebunden, den diese Seite jetzt trägt) und ist hier keine neue
  // Funktion, sondern derselbe, umgezogene Zustand.
  const [week, setWeek] = useState<ScorePeriod>(() =>
    getWeekPeriod(today, weekStartsOn),
  );
  const [current, setCurrent] = useState<WeeklyReview>();
  const [previous, setPrevious] = useState<WeeklyReview>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    // Die Vorwoche ist ein eigener Datenpunkt, kein abgeleiteter Wert: Beide
    // Wochen werden unabhängig verdichtet, damit jede ihre eigene Grundlage
    // behält.
    void Promise.all([
      insightService.loadWeek(week, today, timeZone),
      insightService.loadWeek(shiftWeek(week, -1), today, timeZone),
    ]).then(
      ([currentOverview, previousOverview]) => {
        if (!isCurrent) return;
        setCurrent(currentOverview.review);
        setPrevious(previousOverview.review);
        setIsLoading(false);
      },
      () => {
        if (!isCurrent) return;
        setError(loadFailure);
        setIsLoading(false);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [insightService, timeZone, today, week]);

  const currentPeriodText = current
    ? describePeriod(current.period)
    : undefined;
  const previousPeriodText = previous
    ? describePeriod(previous.period)
    : undefined;

  return (
    <section
      aria-labelledby="page-title"
      className="route-page weekly-review-page"
      data-surface="overview"
    >
      <PageToolbar
        description="Aufgaben, Routinen, Journal, Ziele und Ausgaben im neutralen Vergleich mit derselben Vorwoche. Er plant nichts neu und bewertet dich nicht. Aus dem Journal geht nur die Anzahl der Tage mit einem Eintrag ein, kein Freitext."
        eyebrow="Reflexion · ohne Bewertung"
        period={currentPeriodText}
        surface="overview"
        title="Wochenrückblick"
      />

      {error ? (
        <p className="page-alert weekly-review-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="weekly-review-status" role="status">
          Der Wochenrückblick wird geladen …
        </p>
      ) : null}

      {!isLoading &&
      current &&
      previous &&
      currentPeriodText &&
      previousPeriodText ? (
        <section
          aria-labelledby="weekly-review-week-title"
          className="page-section weekly-review-week"
        >
          <h2 id="weekly-review-week-title">Woche vom {currentPeriodText}</h2>
          <ViewPurpose
            period={currentPeriodText}
            purpose="Der Wochenrückblick vergleicht dieselben fünf Bereiche mit der Vorwoche. Er zeigt Beobachtungen mit Datenbasis, keine Planung und keine Bewertung."
            question="Was ist in dieser Woche passiert?"
          />
          <div className="weekly-review-week-navigation">
            <Button
              onClick={() => setWeek(shiftWeek(week, -1))}
              variant="secondary"
            >
              Vorherige Woche
            </Button>
            <Button
              disabled={week.to >= today}
              onClick={() => setWeek(shiftWeek(week, 1))}
              variant="secondary"
            >
              Nächste Woche
            </Button>
            {week.to >= today ? (
              <p className="weekly-review-note">
                Dies ist die laufende Woche. Ausgewertet wird bis heute.
              </p>
            ) : null}
          </div>

          <p className="weekly-review-note">
            Jede Zahl dieser Woche steht neben derselben Zahl der vorherigen
            Woche, jeweils mit eigenem Zeitraum und eigener Datenbasis. Fehlt
            einer der beiden Werte eine Grundlage, steht das hier ausdrücklich
            statt einer stillschweigenden Lücke.
          </p>
          <ul className="weekly-review-comparison-list">
            {figureOrder.map(({ key, label }) => (
              <li key={key}>
                <FigureComparison
                  currentFigure={current[key]}
                  currentPeriodText={currentPeriodText}
                  figureKey={key}
                  label={label}
                  previousFigure={previous[key]}
                  previousPeriodText={previousPeriodText}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

type FigureComparisonProps = {
  currentFigure: WeeklyFigure;
  currentPeriodText: string;
  figureKey: FigureKey;
  label: string;
  previousFigure: WeeklyFigure;
  previousPeriodText: string;
};

/**
 * Zeigt beide Wochen nebeneinander, ohne eine Differenz oder eine Bewertung
 * zu errechnen. Fehlt einer Seite die Grundlage, ersetzt eine ausdrückliche
 * Notiz die stille Lücke; die eigentliche Begründung steht bereits in der
 * jeweiligen Kachel darüber.
 */
function FigureComparison({
  currentFigure,
  currentPeriodText,
  figureKey,
  label,
  previousFigure,
  previousPeriodText,
}: FigureComparisonProps) {
  const currentHasBasis = currentFigure.hasBasis;
  const previousHasBasis = previousFigure.hasBasis;
  const headingId = `weekly-review-comparison-${figureKey}`;

  return (
    <article aria-labelledby={headingId} className="weekly-review-comparison">
      <h3 id={headingId}>{label}</h3>
      <div className="weekly-review-comparison-tiles">
        <MetricTile
          context={`Zeitraum: ${currentPeriodText} · ${currentFigure.basis}`}
          label="Diese Woche"
          value={currentHasBasis ? currentFigure.valueText : null}
        />
        <MetricTile
          context={`Zeitraum: ${previousPeriodText} · ${previousFigure.basis}`}
          label="Vorherige Woche"
          value={previousHasBasis ? previousFigure.valueText : null}
        />
      </div>
      {!currentHasBasis || !previousHasBasis ? (
        <p className="weekly-review-comparison-note" role="note">
          Kein Vorwochenvergleich möglich:{" "}
          {!currentHasBasis && !previousHasBasis
            ? "Weder für diese noch für die vorherige Woche liegt eine Datenbasis vor."
            : !currentHasBasis
              ? "Für diese Woche liegt keine Datenbasis vor."
              : "Für die vorherige Woche liegt keine Datenbasis vor."}
        </p>
      ) : null}
    </article>
  );
}

export function Component() {
  return <WeeklyReviewPage />;
}
