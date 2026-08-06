import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { createHiddenInsightRepository } from "./repository";
import { createInsightId, type Insight } from "./insight-model";
import type { ScoreSources } from "./score-input";
import { createInsightService } from "./service";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

const today = "2026-08-20";
const timeZone = "Europe/Berlin";

/** Leere Quellen: Hier geht es um das Ausblenden, nicht um die Regeln. */
const emptySources: ScoreSources = {
  finance: {
    listBudgets: () => Promise.resolve([]),
    listTransactions: () => Promise.resolve([]),
  },
  goals: {
    list: () => Promise.resolve([]),
    listMilestones: () => Promise.resolve([]),
  },
  habits: {
    list: () => Promise.resolve([]),
    listEntries: () => Promise.resolve([]),
  },
  journal: { list: () => Promise.resolve([]) },
  savings: {
    listContributions: () => Promise.resolve([]),
    listGoals: () => Promise.resolve([]),
  },
  tasks: { list: () => Promise.resolve([]) },
};

function createService() {
  const hidden = createHiddenInsightRepository(database);
  return { hidden, service: createInsightService(hidden, emptySources) };
}

const period = { from: "2026-08-01", to: "2026-08-20" };
const insight: Insight = {
  evidence: [],
  id: createInsightId("budget-pace", "budget-pace-v1", period, "abc"),
  message: "Synthetische Beobachtung.",
  period,
  ruleId: "budget-pace",
  ruleVersion: "budget-pace-v1",
  strength: "medium",
};

describe("InsightService – Ausblenden", () => {
  it("persists a hidden insight with its rule", async () => {
    const { hidden, service } = createService();

    await service.hide(insight);
    const [record] = await hidden.list();

    expect(record.insightId).toBe(insight.id);
    expect(record.ruleId).toBe("budget-pace");
    expect(record.hiddenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("stays a single record when the same insight is hidden twice", async () => {
    const { hidden, service } = createService();

    await service.hide(insight);
    await service.hide(insight);

    expect(await hidden.list()).toHaveLength(1);
  });

  it("survives a reload and keeps the insight out of the presentation", async () => {
    const { service } = createService();
    await service.hide(insight);

    const reloaded = createService().service;
    const overview = await reloaded.load(today, timeZone);

    expect(overview.insights.some((entry) => entry.id === insight.id)).toBe(
      false,
    );
  });

  it("shows a hidden insight again on request", async () => {
    const { hidden, service } = createService();
    await service.hide(insight);

    expect(await service.showAgain(insight.id)).toBe(true);
    expect(await hidden.list()).toHaveLength(0);
    // Endgültig entfernt, damit ein erneutes Ausblenden wieder möglich ist.
    await service.hide(insight);
    expect(await hidden.list()).toHaveLength(1);
  });

  it("reports an unknown insight instead of pretending it was shown", async () => {
    const { service } = createService();

    expect(await service.showAgain("gibt-es-nicht")).toBe(false);
  });

  it("keeps counting a hidden insight, so nothing disappears silently", async () => {
    const { service } = createService();

    const before = await service.load(today, timeZone);
    expect(before.hiddenCount).toBe(0);
    expect(before.failedRuleIds).toEqual([]);
  });
});
