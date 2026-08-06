import { monthOfDay } from "../finance/budget";
import type { CalendarDay } from "../../lib/dates/date-values";
import {
  personalOsScoreSettingsRepository,
  type ScoreSettingsRepository,
} from "./repository";
import {
  calculateLifeScore,
  getFinancePeriod,
  getLifeScorePeriod,
} from "./score-engine";
import {
  personalOsScoreSources,
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
