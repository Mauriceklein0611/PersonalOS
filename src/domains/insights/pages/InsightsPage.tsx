import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import {
  useTimeZone,
  useWeekStartsOn,
} from "../../../app/settings/settings-context";
import {
  Button,
  Checkbox,
  EmptyState,
  Input,
  MetricTile,
  ProgressBar,
  ProgressRing,
  Toast,
} from "../../../components/ui";
import {
  calendarDayForInstant,
  type WeekStartsOn,
} from "../../../lib/dates/calendar-days";
import { applyScoreWeights } from "../score-engine";
import { insightStrengthLabels, type Insight } from "../insight-model";
import { getWeekPeriod } from "../weekly-review";
import {
  personalOsInsightService,
  type InsightService,
  type WeeklyReviewOverview,
} from "../service";
import {
  resolveScoreComponents,
  scoreComponentKeys,
  type ScoreComponentConfig,
  type ScoreComponentKey,
} from "../score-model";
import {
  buildComponentViews,
  describeCompleteness,
  describePeriod,
  describeWeightShare,
  formatScoreValue,
  scoreComponentLabels,
  toScoreRatio,
  type ScoreComponentView,
} from "../score-view-model";
import { personalOsScoreService, type ScoreService } from "../service";
import "./insights-page.css";

export type InsightsPageProps = {
  insightService?: InsightService;
  now?: () => Date;
  service?: ScoreService;
  timeZone?: string;
  weekStartsOn?: WeekStartsOn;
};

type WeightDraft = Record<ScoreComponentKey, string>;

const loadFailure = "Die Wochenübersicht konnte nicht geladen werden.";

export function InsightsPage({
  insightService = personalOsInsightService,
  now = () => new Date(),
  service = personalOsScoreService,
  timeZone: timeZoneOverride,
  weekStartsOn: weekStartsOnOverride,
}: InsightsPageProps) {
  const timeZone = useTimeZone(timeZoneOverride);
  const weekStartsOn = useWeekStartsOn(weekStartsOnOverride);
  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  const [error, setError] = useState<string>();
  const [expanded, setExpanded] = useState<ScoreComponentKey>();
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [overview, setOverview] = useState<WeeklyReviewOverview>();
  // Insights zeigt nur die laufende Woche; das Blättern über Wochen lebt im
  // Wochenrückblick (`/wochenrueckblick`), zusammen mit den Kennzahlen, die
  // es einordnen.
  const week = useMemo(
    () => getWeekPeriod(today, weekStartsOn),
    [today, weekStartsOn],
  );
  const [draft, setDraft] = useState<ScoreComponentConfig[]>();
  const [weightText, setWeightText] = useState<WeightDraft>();
  const [weightError, setWeightError] = useState<string>();

  const applyOverview = useCallback((next: WeeklyReviewOverview) => {
    const components = resolveScoreComponents(next.settings.components);
    setOverview(next);
    setDraft(components);
    setWeightText(toWeightDraft(components));
  }, []);

  useEffect(() => {
    let isCurrent = true;
    void insightService.loadWeek(week, today, timeZone).then(
      (next) => {
        if (!isCurrent) return;
        applyOverview(next);
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
  }, [applyOverview, insightService, timeZone, today, week]);

  async function reload() {
    setError(undefined);
    try {
      applyOverview(await insightService.loadWeek(week, today, timeZone));
      return true;
    } catch {
      setError(loadFailure);
      return false;
    }
  }

  async function hideInsight(insight: Insight) {
    try {
      await insightService.hide(insight);
    } catch {
      setError("Der Insight konnte nicht ausgeblendet werden.");
      return;
    }
    if (await reload()) {
      setNotice(
        "Die Beobachtung ist ausgeblendet. Deine Einträge bleiben unverändert.",
      );
    }
  }

  async function saveWeights() {
    if (!draft || !weightText) return;
    const parsed = parseWeights(draft, weightText);
    if (parsed === undefined) {
      setWeightError("Gib je Bereich eine ganze Zahl zwischen 0 und 100 ein.");
      return;
    }

    setWeightError(undefined);
    try {
      await service.saveComponents(parsed);
    } catch {
      setError("Die Gewichtung konnte nicht gespeichert werden.");
      return;
    }
    if (await reload()) {
      setNotice("Die Gewichtung wurde gespeichert.");
    }
  }

  async function toggleScore(enabled: boolean) {
    try {
      await service.setEnabled(enabled);
    } catch {
      setError("Die Einstellung konnte nicht gespeichert werden.");
      return;
    }
    if (await reload()) {
      setNotice(
        enabled
          ? "Der Life Score wird wieder angezeigt."
          : "Der Life Score ist ausgeblendet. Deine Einträge bleiben unverändert.",
      );
    }
  }

  // Die Vorschau rechnet mit dem Entwurf, aber denselben Rohdaten. So ist eine
  // Gewichtsänderung vor dem Speichern sichtbar statt nur behauptet.
  const preview = useMemo(() => {
    if (!overview || !draft || !weightText) return undefined;
    const parsed = parseWeights(draft, weightText);
    if (parsed === undefined) return undefined;
    return applyScoreWeights(overview.score, parsed);
  }, [draft, overview, weightText]);

  const views = useMemo(
    () =>
      overview && draft
        ? buildComponentViews(overview.score, draft)
        : undefined,
    [draft, overview],
  );

  return (
    <section aria-labelledby="page-title" className="route-page insights-page">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="page-eyebrow">Nachvollziehbar</p>
          <h1 id="page-title">Auswertung</h1>
          <p className="page-description">
            Deine Woche aus deinen eigenen Einträgen – keine Bewertung deines
            Lebens und kein Vergleich mit anderen. Der Life Score ist eine
            persönliche Orientierung; du entscheidest, welche Bereiche
            einfließen und wie stark.
          </p>
        </div>
      </header>

      {error ? (
        <p className="page-alert insights-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="insights-status" role="status">
          Der Life Score wird berechnet …
        </p>
      ) : null}

      {!isLoading && overview && views && draft && weightText ? (
        <>
          <section
            aria-labelledby="insights-weekly-review-title"
            className="page-section insights-weekly-review-pointer"
          >
            <h2 id="insights-weekly-review-title">Wochenrückblick</h2>
            <p className="insights-note">
              Aufgaben-, Routinen-, Journal-, Ziel- und Ausgabenzahlen dieser
              Woche mit Vorwochenvergleich stehen im eigenen Wochenrückblick,
              nicht auf dieser Seite.
            </p>
            <div className="insights-weekly-review-actions">
              <Link
                className="ui-button ui-button-secondary"
                to="/auswertung/wochenrueckblick"
              >
                Wochenrückblick öffnen
              </Link>
            </div>
          </section>

          <section
            aria-labelledby="insights-observations-title"
            className="page-section insights-observations"
          >
            <h2 id="insights-observations-title">Beobachtungen</h2>
            {overview.insights.length === 0 ? (
              <EmptyState
                description="Sobald genug Einträge vorliegen, erscheint hier eine Beobachtung mit ihrer Datenbasis. Ohne ausreichende Grundlage wird bewusst nichts behauptet."
                title="Noch keine Beobachtung"
              />
            ) : (
              <ul className="insights-observation-list">
                {overview.insights.map((insight) => (
                  <li key={insight.id}>
                    <InsightCard
                      insight={insight}
                      onHide={() => void hideInsight(insight)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {overview.hiddenCount > 0 ? (
              <p className="insights-note">
                {overview.hiddenCount} Beobachtung
                {overview.hiddenCount === 1 ? "" : "en"} ausgeblendet. Die
                zugrunde liegenden Einträge sind unverändert.
              </p>
            ) : null}
            {overview.failedRuleIds.length > 0 ? (
              <p className="insights-field-error" role="alert">
                Diese Regeln konnten nicht ausgewertet werden:{" "}
                {overview.failedRuleIds.join(", ")}.
              </p>
            ) : null}
          </section>

          {overview.settings.enabled ? (
            <>
              <section
                aria-labelledby="insights-total-title"
                className="page-section insights-total"
              >
                <h2 id="insights-total-title">Life Score</h2>
                <div className="insights-total-body">
                  <ProgressRing
                    caption={describePeriod(overview.score.period)}
                    glow
                    label="Gesamtwert"
                    value={toScoreRatio(overview.score.total)}
                    valueText={formatScoreValue(overview.score.total)}
                  />
                  <div className="insights-total-facts">
                    <MetricTile
                      context="Bereiche mit ausreichender Datenbasis"
                      label="Datenvollständigkeit"
                      value={describeCompleteness(overview.score)}
                    />
                    <MetricTile
                      context="Historische Werte behalten ihre Version."
                      label="Berechnung"
                      value={overview.score.version}
                    />
                  </div>
                </div>
                {overview.score.total === null ? (
                  <p className="insights-note">
                    Für diesen Zeitraum liegt noch zu wenig vor. Sobald ein
                    Bereich genug Einträge hat, erscheint hier ein Wert.
                  </p>
                ) : null}
              </section>

              {/* Alle Teilwerte liegen in einer Karte. Eine Glas-Karte je
                  Zeile würde die Ebenen vervielfachen, ohne etwas zu trennen. */}
              <section
                aria-labelledby="insights-components-title"
                className="page-section insights-components"
              >
                <h2 id="insights-components-title">Teilwerte</h2>
                {views.map((view) => (
                  <ComponentRow
                    isExpanded={expanded === view.component.key}
                    key={view.component.key}
                    onToggle={() =>
                      setExpanded(
                        expanded === view.component.key
                          ? undefined
                          : view.component.key,
                      )
                    }
                    view={view}
                  />
                ))}
              </section>
            </>
          ) : (
            <EmptyState
              action={
                <Button onClick={() => void toggleScore(true)}>
                  Life Score anzeigen
                </Button>
              }
              description="Du hast den Life Score ausgeblendet. Deine Einträge werden weiterhin gespeichert und der Wert lässt sich jederzeit wieder einblenden."
              title="Life Score ist ausgeblendet"
            />
          )}

          <section
            aria-labelledby="insights-settings-title"
            className="page-section insights-settings"
          >
            <h2 id="insights-settings-title">Bereiche und Gewichtung</h2>
            <p className="insights-note">
              Ein abgewählter Bereich ist keine Lücke, sondern eine
              Entscheidung: Er senkt weder den Wert noch die
              Datenvollständigkeit. Die Summe der Gewichte muss nicht 100
              ergeben.
            </p>

            <ul className="insights-weight-list">
              {scoreComponentKeys.map((key) => {
                const config = draft.find((entry) => entry.key === key);
                if (config === undefined) return null;
                return (
                  <li className="insights-weight-row" key={key}>
                    <Checkbox
                      checked={config.enabled}
                      label={`${scoreComponentLabels[key]} einbeziehen`}
                      onChange={(event) =>
                        setDraft(
                          draft.map((entry) =>
                            entry.key === key
                              ? {
                                  ...entry,
                                  enabled: event.currentTarget.checked,
                                }
                              : entry,
                          ),
                        )
                      }
                    />
                    <Input
                      hint={describeWeightShare(draft, key)}
                      inputMode="numeric"
                      label={`Gewicht für ${scoreComponentLabels[key]}`}
                      max={100}
                      min={0}
                      onChange={(event) => {
                        setWeightError(undefined);
                        setWeightText({
                          ...weightText,
                          [key]: event.currentTarget.value,
                        });
                      }}
                      type="number"
                      value={weightText[key]}
                    />
                  </li>
                );
              })}
            </ul>

            <p className="insights-preview" role="status">
              {preview === undefined
                ? "Die Vorschau erscheint, sobald alle Gewichte gültig sind."
                : `Mit dieser Gewichtung: ${formatScoreValue(preview.total)} · Grundlage ${describeCompleteness(preview)}.`}
            </p>

            {weightError ? (
              <p className="insights-field-error" role="alert">
                {weightError}
              </p>
            ) : null}

            <div className="insights-settings-actions">
              <Button onClick={() => void saveWeights()}>
                Gewichtung speichern
              </Button>
              {overview.settings.enabled ? (
                <Button onClick={() => void toggleScore(false)} variant="ghost">
                  Life Score ausblenden
                </Button>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {notice ? (
        <div className="insights-toast-region">
          <Toast message={notice} onDismiss={() => setNotice(undefined)} />
        </div>
      ) : null}
    </section>
  );
}

const actionTargets: Record<string, { label: string; to: string }> = {
  "open-budget": { label: "Budgets öffnen", to: "/finanzen" },
};

type InsightCardProps = {
  insight: Insight;
  onHide: () => void;
};

/**
 * Eine Beobachtung nennt immer Zeitraum und Datenbasis. Die empfohlene Aktion
 * ist optional und führt in einen bestehenden Ablauf, nicht in eine neue
 * Oberfläche.
 */
function InsightCard({ insight, onHide }: InsightCardProps) {
  const target = insight.action
    ? actionTargets[insight.action.kind]
    : undefined;

  return (
    <article className="insights-observation">
      <p className="insights-observation-strength">
        {insightStrengthLabels[insight.strength]}
      </p>
      <p className="insights-observation-message">{insight.message}</p>
      <p className="insights-observation-period">
        Zeitraum: {describePeriod(insight.period)}
      </p>
      {insight.evidence.length > 0 ? (
        <ul className="insights-evidence">
          {insight.evidence.map((entry) => (
            <li key={entry.metric}>
              <span className="insights-evidence-label">
                {insightMetricLabels[entry.metric] ?? entry.metric}
              </span>
              <span className="insights-evidence-value">
                {formatEvidenceValue(entry.metric, entry.value)}
              </span>
              <span className="insights-evidence-source">
                {entry.sourceCount}{" "}
                {entry.sourceCount === 1 ? "Datensatz" : "Datensätze"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="insights-observation-actions">
        {target ? (
          <Link className="ui-button ui-button-secondary" to={target.to}>
            {target.label}
          </Link>
        ) : null}
        <Button onClick={onHide} variant="ghost">
          Beobachtung ausblenden
        </Button>
      </div>
    </article>
  );
}

const insightMetricLabels: Record<string, string> = {
  comparableWeeks: "Vergleichbare Wochen",
  comparableWeekdays: "Vergleichbare Wochentage",
  elapsedShare: "Vergangener Monatsanteil",
  highestWeekdayRate: "Höchste Abschlussquote",
  lowestWeekdayRate: "Niedrigste Abschlussquote",
  plannedTasks: "Geplante Aufgaben",
  plannedUnits: "Geplante Einheiten",
  spentShare: "Gebuchter Budgetanteil",
  weeksWeekdayHigher: "Wochen mit höheren Werktagen",
  weeksWeekendHigher: "Wochen mit höherem Wochenende",
};

const shareMetrics = new Set([
  "elapsedShare",
  "highestWeekdayRate",
  "lowestWeekdayRate",
  "spentShare",
]);

function formatEvidenceValue(metric: string, value: number): string {
  return shareMetrics.has(metric)
    ? `${Math.round(value * 100)} %`
    : String(value);
}

type ComponentRowProps = {
  isExpanded: boolean;
  onToggle: () => void;
  view: ScoreComponentView;
};

function ComponentRow({ isExpanded, onToggle, view }: ComponentRowProps) {
  const detailId = `insights-detail-${view.component.key}`;

  return (
    <article className="insights-component">
      <ProgressBar
        caption={`${view.basis} · ${view.weightText}`}
        label={view.label}
        value={view.ratio}
        valueText={view.valueText}
      />
      <p className="insights-component-period">Zeitraum: {view.periodText}</p>
      <Button
        aria-controls={detailId}
        aria-expanded={isExpanded}
        onClick={onToggle}
        variant="secondary"
      >
        {isExpanded
          ? `Erklärung zu ${view.label} schließen`
          : `Warum? Erklärung zu ${view.label}`}
      </Button>

      {isExpanded ? (
        <div className="insights-explanation" id={detailId}>
          <h3>Was gemessen wird</h3>
          <p>{view.description}</p>
          <h3>Wie gerechnet wird</h3>
          <p>{view.formula}</p>
          <h3>Mindestdaten</h3>
          <p>{view.minimum}</p>
          <h3>Datenbasis</h3>
          {view.evidence.length === 0 ? (
            <p>Für diesen Bereich liegt im Zeitraum nichts vor.</p>
          ) : (
            <ul className="insights-evidence">
              {view.evidence.map((row) => (
                <li key={row.label}>
                  <span className="insights-evidence-label">{row.label}</span>
                  <span className="insights-evidence-value">{row.value}</span>
                  <span className="insights-evidence-source">
                    {row.sourceText}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </article>
  );
}

function toWeightDraft(components: readonly ScoreComponentConfig[]) {
  return Object.fromEntries(
    components.map((component) => [component.key, String(component.weight)]),
  ) as WeightDraft;
}

/**
 * Eine leere oder ungültige Eingabe wird nicht stillschweigend als 0 gelesen.
 * Eine 0 wäre eine Aussage, eine unfertige Eingabe ist keine.
 */
function parseWeights(
  components: readonly ScoreComponentConfig[],
  text: WeightDraft,
): ScoreComponentConfig[] | undefined {
  const parsed: ScoreComponentConfig[] = [];
  for (const component of components) {
    const raw = text[component.key].trim();
    if (!/^\d+$/.test(raw)) return undefined;
    const weight = Number.parseInt(raw, 10);
    if (weight > 100) return undefined;
    parsed.push({ ...component, weight });
  }
  return parsed;
}

export function Component() {
  return <InsightsPage />;
}
