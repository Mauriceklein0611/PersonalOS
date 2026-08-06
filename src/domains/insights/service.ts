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
  type ScoreSources,
} from "./score-input";
import {
  resolveScoreComponents,
  type LifeScoreResult,
  type ScoreComponentConfig,
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

export type InsightService = {
  hide(insight: Insight): Promise<void>;
  load(today: CalendarDay, timeZone: string): Promise<InsightOverview>;
  showAgain(insightId: string): Promise<boolean>;
};

export function createInsightService(
  hidden: HiddenInsightRepository = personalOsHiddenInsightRepository,
  sources: ScoreSources = personalOsScoreSources,
): InsightService {
  return {
    async hide(insight) {
      await hidden.hide(insight.id, insight.ruleId);
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
