import {
  resolveScoreComponents,
  type LifeScoreResult,
  type ScoreSettings,
} from "../../domains/insights/score-model";
import type { ScoreService } from "../../domains/insights/service";

const period = { from: "2026-07-29", to: "2026-08-04" } as const;

/**
 * Kleiner Ersatz für den Life Score in Komponententests. Die Rechnung selbst
 * deckt `score-engine.test.ts` ab; hier zählt nur, dass die Seite einen Wert
 * bekommt, ohne die Datenbank anzufassen.
 *
 * `total: null` ist ausdrücklich erlaubt und bedeutet „keine Grundlage" — die
 * Oberfläche muss das genauso vertragen wie eine Zahl.
 */
export function createStubScoreService(
  total: number | null = 72,
): ScoreService {
  const configured = resolveScoreComponents([]);

  const settings: ScoreSettings = {
    components: configured,
    createdAt: "2026-08-01T08:00:00.000Z",
    enabled: true,
    id: "00000000-0000-4000-8000-000000000090",
    updatedAt: "2026-08-01T08:00:00.000Z",
  };

  const result: LifeScoreResult = {
    completeness: total === null ? 0 : 1,
    components: configured.map((component) => ({
      basis: "Synthetische Grundlage",
      contributes: total !== null,
      enabled: component.enabled,
      inputs: [],
      key: component.key,
      period,
      sourceCount: 1,
      value: total,
      weight: component.weight,
    })),
    period,
    total,
    version: "life-score-v1",
  };

  return {
    load: () => Promise.resolve({ result, settings }),
    preview: () => Promise.resolve({ result, settings }),
    loadSettings: () => Promise.resolve(settings),
    saveComponents: () => Promise.resolve(settings),
    setEnabled: () => Promise.resolve(settings),
  };
}
