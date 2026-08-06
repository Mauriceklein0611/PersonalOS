import { monthOfDay } from "../finance/budget";
import type { CalendarDay } from "../../lib/dates/date-values";
import { runInsightRules, withoutHiddenInsights } from "./insight-engine";
import type { Insight } from "./insight-model";
import {
  personalOsHiddenInsightRepository,
  personalOsScoreSettingsRepository,
  type HiddenInsightRepository,
  type ScoreSettingsRepository,
} from "./repository";
import {
  calculateLifeScore,
  getFinancePeriod,
  getLifeScorePeriod,
} from "./score-engine";
import {
  personalOsScoreSources,
  readInsightInput,
  readLifeScoreInput,
  readWeeklyReviewInput,
  type ScoreSources,
} from "./score-input";
import {
  buildWeeklyReview,
  getReviewAnchorDay,
  type WeeklyReview,
} from "./weekly-review";
import {
  resolveScoreComponents,
  type LifeScoreResult,
  type ScoreComponentConfig,
  type ScorePeriod,
  type ScoreSettings,
} from "./score-model";

export type ScoreOverview = {
  result: LifeScoreResult;
  settings: ScoreSettings;
};

export type InsightOverview = {
  /** Ohne die ausgeblendeten; die Regeln laufen trotzdem vollständig. */
  insights: Insight[];
  failedRuleIds: string[];
  hiddenCount: number;
};

export type WeeklyReviewOverview = InsightOverview & {
  anchorDay: CalendarDay;
  review: WeeklyReview;
  score: LifeScoreResult;
  settings: ScoreSettings;
};

export type InsightService = {
  hide(insight: Insight): Promise<void>;
  load(today: CalendarDay, timeZone: string): Promise<InsightOverview>;
  /**
   * Verdichtet eine ISO-Woche. Score und Regeln rechnen für den Ankertag der
   * Woche — das Wochenende, aber nie in der Zukunft.
   */
  loadWeek(
    period: ScorePeriod,
    today: CalendarDay,
    timeZone: string,
  ): Promise<WeeklyReviewOverview>;
  showAgain(insightId: string): Promise<boolean>;
};

export function createInsightService(
  hidden: HiddenInsightRepository = personalOsHiddenInsightRepository,
  sources: ScoreSources = personalOsScoreSources,
  settings: ScoreSettingsRepository = personalOsScoreSettingsRepository,
): InsightService {
  return {
    async hide(insight) {
      await hidden.hide(insight.id, insight.ruleId);
    },
    async loadWeek(period, today, timeZone) {
      const anchorDay = getReviewAnchorDay(period, today);
      const [reviewInput, insightInput, hiddenIds, stored] = await Promise.all([
        readWeeklyReviewInput(sources, period),
        readInsightInput(sources, anchorDay),
        hidden.listIds(),
        settings.loadOrCreate(),
      ]);
      const scoreInput = await readLifeScoreInput(sources, {
        month: monthOfDay(getFinancePeriod(anchorDay).from),
        period: getLifeScorePeriod(anchorDay),
      });
      const run = runInsightRules(insightInput, {
        timeZone,
        today: anchorDay,
      });
      const visible = withoutHiddenInsights(run.insights, hiddenIds);

      return {
        anchorDay,
        failedRuleIds: run.failedRuleIds,
        hiddenCount: run.insights.length - visible.length,
        insights: visible,
        review: buildWeeklyReview(reviewInput, period),
        score: calculateLifeScore(scoreInput, {
          components: stored.components,
          timeZone,
          today: anchorDay,
        }),
        settings: stored,
      };
    },
    async load(today, timeZone) {
      const [input, hiddenIds] = await Promise.all([
        readInsightInput(sources, today),
        hidden.listIds(),
      ]);
      const run = runInsightRules(input, { timeZone, today });
      const visible = withoutHiddenInsights(run.insights, hiddenIds);

      return {
        failedRuleIds: run.failedRuleIds,
        hiddenCount: run.insights.length - visible.length,
        insights: visible,
      };
    },
    showAgain: (insightId) => hidden.show(insightId),
  };
}

export const personalOsInsightService = createInsightService();

export type ScoreService = {
  /** Liest die gespeicherte Konfiguration und rechnet den Tag neu durch. */
  load(today: CalendarDay, timeZone: string): Promise<ScoreOverview>;
  loadSettings(): Promise<ScoreSettings>;
  saveComponents(
    components: readonly ScoreComponentConfig[],
  ): Promise<ScoreSettings>;
  setEnabled(enabled: boolean): Promise<ScoreSettings>;
};

export function createScoreService(
  settings: ScoreSettingsRepository = personalOsScoreSettingsRepository,
  sources: ScoreSources = personalOsScoreSources,
): ScoreService {
  return {
    async load(today, timeZone) {
      const stored = await settings.loadOrCreate();
      const input = await readLifeScoreInput(sources, {
        month: monthOfDay(getFinancePeriod(today).from),
        period: getLifeScorePeriod(today),
      });
      return {
        result: calculateLifeScore(input, {
          components: stored.components,
          timeZone,
          today,
        }),
        settings: stored,
      };
    },
    loadSettings: () => settings.loadOrCreate(),
    async saveComponents(components) {
      const stored = await settings.loadOrCreate();
      // Immer vollständig speichern: Eine Teilliste würde beim nächsten Lesen
      // stillschweigend aus den Standards ergänzt und wäre nicht nachvollziehbar.
      return settings.update(stored.id, {
        components: resolveScoreComponents(components),
      });
    },
    async setEnabled(enabled) {
      const stored = await settings.loadOrCreate();
      return settings.update(stored.id, { enabled });
    },
  };
}

export const personalOsScoreService = createScoreService();
