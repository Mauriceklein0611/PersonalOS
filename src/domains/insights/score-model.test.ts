import { describe, expect, it } from "vitest";

import { buildEntityMeta } from "../../test/factories/entity";
import {
  lifeScoreInput,
  lifeScoreTimeZone,
  lifeScoreToday,
} from "../../test/fixtures/life-score";
import { calculateLifeScore } from "./score-engine";
import {
  clampScore,
  createDefaultScoreComponents,
  defaultScoreWeights,
  lifeScoreEngineVersion,
  resolveScoreComponents,
  roundScoreForDisplay,
  scoreComponentKeys,
  scoreSnapshotSchema,
  toScoreSnapshotDetails,
} from "./score-model";

describe("resolveScoreComponents", () => {
  it("returns every component in the documented order", () => {
    expect(createDefaultScoreComponents()).toEqual([
      { enabled: true, key: "focus", weight: 25 },
      { enabled: true, key: "habits", weight: 25 },
      { enabled: true, key: "wellbeing", weight: 20 },
      { enabled: true, key: "goals", weight: 15 },
      { enabled: true, key: "finance", weight: 15 },
    ]);
  });

  it("fills a gap with the default weight instead of dropping the component", () => {
    const resolved = resolveScoreComponents([
      { enabled: false, key: "finance", weight: 40 },
    ]);

    expect(resolved).toHaveLength(scoreComponentKeys.length);
    expect(resolved.at(-1)).toEqual({
      enabled: false,
      key: "finance",
      weight: 40,
    });
    expect(resolved[0]).toEqual({
      enabled: true,
      key: "focus",
      weight: defaultScoreWeights.focus,
    });
  });

  it("keeps a user weight of zero instead of replacing it with the default", () => {
    const resolved = resolveScoreComponents([
      { enabled: true, key: "goals", weight: 0 },
    ]);

    expect(resolved).toContainEqual({ enabled: true, key: "goals", weight: 0 });
  });
});

describe("roundScoreForDisplay", () => {
  it("rounds commercially and carries a missing value through", () => {
    expect(roundScoreForDisplay(63.157_894_736_842_1)).toBe(63);
    expect(roundScoreForDisplay(65.5)).toBe(66);
    expect(roundScoreForDisplay(64.446_663_533_834_6)).toBe(64);
    expect(roundScoreForDisplay(null)).toBeNull();
  });
});

describe("clampScore", () => {
  it("holds a value inside the promised range", () => {
    expect(clampScore(-0.000_000_1)).toBe(0);
    expect(clampScore(100.000_000_1)).toBe(100);
    expect(clampScore(42.5)).toBe(42.5);
  });

  it("rejects a value that is not a number", () => {
    expect(() => clampScore(Number.NaN)).toThrow(RangeError);
  });
});

describe("toScoreSnapshotDetails", () => {
  const result = calculateLifeScore(lifeScoreInput, {
    components: [{ enabled: false, key: "finance", weight: 15 }],
    timeZone: lifeScoreTimeZone,
    today: lifeScoreToday,
  });
  const details = toScoreSnapshotDetails(result);

  it("stores the version and the scored day", () => {
    expect(details.engineVersion).toBe(lifeScoreEngineVersion);
    expect(details.localDate).toBe(lifeScoreToday);
  });

  // Gespeichert wird ungerundet, damit die Anzeige später genauso rundet.
  it("stores the unrounded total", () => {
    expect(details.total).toBe(result.total);
    expect(Number.isInteger(details.total)).toBe(false);
  });

  it("stores the weights that were actually used, without disabled areas", () => {
    expect(details.components.map((component) => component.key)).toEqual([
      "focus",
      "habits",
      "wellbeing",
      "goals",
    ]);
    expect(details.components[0]).toEqual({
      key: "focus",
      sourceCount: 10,
      value: result.components[0].value,
      weight: 25,
    });
  });

  it("passes the persisted schema", () => {
    expect(() =>
      scoreSnapshotSchema.parse({ ...buildEntityMeta(), ...details }),
    ).not.toThrow();
  });

  it("leaves the total out when no component contributes", () => {
    const empty = calculateLifeScore(
      {
        budgets: [],
        contributions: [],
        goals: [],
        habitEntries: [],
        habits: [],
        journalEntries: [],
        milestones: [],
        savingsGoals: [],
        tasks: [],
        transactions: [],
      },
      { timeZone: lifeScoreTimeZone, today: lifeScoreToday },
    );
    const emptyDetails = toScoreSnapshotDetails(empty);

    expect(emptyDetails.total).toBeUndefined();
    expect("total" in emptyDetails).toBe(false);
    expect(emptyDetails.completeness).toBe(0);
    expect(() =>
      scoreSnapshotSchema.parse({ ...buildEntityMeta(), ...emptyDetails }),
    ).not.toThrow();
  });
});
