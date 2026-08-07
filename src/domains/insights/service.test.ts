import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import {
  expectedLifeScore,
  lifeScoreBudgets,
  lifeScoreContributions,
  lifeScoreGoals,
  lifeScoreHabitEntries,
  lifeScoreHabits,
  lifeScoreJournalEntries,
  lifeScoreMilestones,
  lifeScoreSavingsGoals,
  lifeScoreTasks,
  lifeScoreTimeZone,
  lifeScoreToday,
  lifeScoreTransactions,
} from "../../test/fixtures/life-score";
import { createScoreSettingsRepository } from "./repository";
import { findScoreComponent } from "./score-engine";
import type { ScoreSources } from "./score-input";
import { defaultScoreWeights, scoreComponentKeys } from "./score-model";
import { createScoreService } from "./service";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

/**
 * Der Vertrag der Quellen kennt nur Lesefunktionen. Der Stub protokolliert
 * jeden Aufruf, damit der Test belegen kann, dass die Auswertung nichts
 * anfasst, was sie nicht lesen muss.
 */
function createSources(): { calls: string[]; sources: ScoreSources } {
  const calls: string[] = [];
  const record = <TValue>(name: string, value: TValue) => {
    calls.push(name);
    return Promise.resolve(value);
  };

  return {
    calls,
    sources: {
      finance: {
        listBudgets: (month) =>
          record(
            `finance.listBudgets:${month}`,
            lifeScoreBudgets.filter((budget) => budget.month === month),
          ),
        listTransactions: (filter) =>
          record(
            `finance.listTransactions:${filter?.month ?? "alle"}`,
            lifeScoreTransactions.filter(
              (transaction) =>
                filter?.month === undefined ||
                transaction.bookedOn.startsWith(filter.month),
            ),
          ),
      },
      goals: {
        list: () => record("goals.list", lifeScoreGoals),
        listMilestones: (goalId) =>
          record(
            "goals.listMilestones",
            lifeScoreMilestones.filter(
              (milestone) => milestone.goalId === goalId,
            ),
          ),
      },
      habits: {
        list: () => record("habits.list", lifeScoreHabits),
        listEntries: (habitId, range) =>
          record(
            `habits.listEntries:${range?.from ?? ""}`,
            lifeScoreHabitEntries.filter(
              (entry) =>
                entry.habitId === habitId && entry.archivedAt === undefined,
            ),
          ),
      },
      journal: {
        list: (range) =>
          record(
            `journal.list:${range?.from ?? ""}`,
            lifeScoreJournalEntries.filter(
              (entry) =>
                (range?.from === undefined || entry.localDate >= range.from) &&
                (range?.to === undefined || entry.localDate <= range.to),
            ),
          ),
      },
      savings: {
        listContributions: () =>
          record("savings.listContributions", lifeScoreContributions),
        listGoals: () => record("savings.listGoals", lifeScoreSavingsGoals),
      },
      tasks: {
        list: () => record("tasks.list", lifeScoreTasks),
      },
    },
  };
}

function createService() {
  const { calls, sources } = createSources();
  return {
    calls,
    service: createScoreService(
      createScoreSettingsRepository(database),
      sources,
    ),
  };
}

describe("ScoreService", () => {
  it("creates the default configuration on first use", async () => {
    const { service } = createService();

    const settings = await service.loadSettings();

    expect(settings.enabled).toBe(true);
    expect(settings.components).toEqual(
      scoreComponentKeys.map((key) => ({
        enabled: true,
        key,
        weight: defaultScoreWeights[key],
      })),
    );
  });

  it("reuses the stored configuration instead of creating a second one", async () => {
    const { service } = createService();

    const first = await service.loadSettings();
    const second = await service.loadSettings();

    expect(second.id).toBe(first.id);
  });

  it("calculates the golden example through the query contract", async () => {
    const { service } = createService();

    const { result } = await service.load(lifeScoreToday, lifeScoreTimeZone);

    expect(result.total).toBeCloseTo(expectedLifeScore.total, 10);
    expect(findScoreComponent(result, "finance").value).toBeCloseTo(
      expectedLifeScore.finance,
      10,
    );
  });

  it("asks the finance sources only for the scored month", async () => {
    const { calls, service } = createService();

    await service.load(lifeScoreToday, lifeScoreTimeZone);

    expect(calls).toContain("finance.listBudgets:2026-08");
    expect(calls).toContain("finance.listTransactions:2026-08");
    expect(calls).toContain("journal.list:2026-07-31");
  });

  it("stores a complete configuration, also when only one area is given", async () => {
    const { service } = createService();

    const saved = await service.saveComponents([
      { enabled: false, key: "finance", weight: 0 },
    ]);

    expect(saved.components).toHaveLength(scoreComponentKeys.length);
    expect(saved.components).toContainEqual({
      enabled: false,
      key: "finance",
      weight: 0,
    });
    expect(saved.components).toContainEqual({
      enabled: true,
      key: "focus",
      weight: defaultScoreWeights.focus,
    });
  });

  it("uses the saved weights for the next calculation", async () => {
    const { service } = createService();

    await service.saveComponents([
      { enabled: false, key: "finance", weight: 15 },
    ]);
    const { result } = await service.load(lifeScoreToday, lifeScoreTimeZone);

    expect(findScoreComponent(result, "finance").enabled).toBe(false);
    // Beispiel 4 des ADR: abgeschaltete Finanzen, Vollständigkeit bleibt 1.
    expect(result.total).toBeCloseTo(66.550_964_515_360_8, 10);
    expect(result.completeness).toBe(1);
  });

  it("hides the score without touching any entry", async () => {
    const { service } = createService();

    const settings = await service.setEnabled(false);
    const { result } = await service.load(lifeScoreToday, lifeScoreTimeZone);

    expect(settings.enabled).toBe(false);
    // Das Ausblenden ist eine Anzeigeentscheidung; gerechnet wird weiter.
    expect(result.total).toBeCloseTo(expectedLifeScore.total, 10);
  });
});
