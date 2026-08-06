import { describe, expect, it } from "vitest";

import {
  expectedLifeScore,
  lifeScoreBudgets,
  lifeScoreContributions,
  lifeScoreFinancePeriod,
  lifeScoreGoals,
  lifeScoreHabits,
  lifeScoreInput,
  lifeScorePeriod,
  lifeScoreSavingsGoals,
  lifeScoreTasks,
  lifeScoreTimeZone,
  lifeScoreToday,
  lifeScoreTransactions,
} from "../../test/fixtures/life-score";
import type { MonthlyBudget, SavingsGoal } from "../finance/model";
import type { Goal } from "../goals/model";
import type { Task } from "../tasks/model";
import {
  applyScoreWeights,
  calculateLifeScore,
  findScoreComponent,
  getFinancePeriod,
  getLifeScorePeriod,
  type LifeScoreContext,
  type LifeScoreInput,
} from "./score-engine";
import {
  defaultScoreWeights,
  lifeScoreEngineVersion,
  roundScoreForDisplay,
  scoreComponentKeys,
  type ScoreComponentConfig,
} from "./score-model";

function run(
  input: Partial<LifeScoreInput> = {},
  context: Partial<LifeScoreContext> = {},
) {
  return calculateLifeScore(
    { ...lifeScoreInput, ...input },
    {
      timeZone: lifeScoreTimeZone,
      today: lifeScoreToday,
      ...context,
    },
  );
}

function valueOf(
  result: ReturnType<typeof run>,
  key: (typeof scoreComponentKeys)[number],
) {
  return findScoreComponent(result, key).value;
}

const emptyInput: LifeScoreInput = {
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
};

function withComponent(
  key: (typeof scoreComponentKeys)[number],
  overrides: Partial<ScoreComponentConfig>,
): ScoreComponentConfig[] {
  return scoreComponentKeys.map((candidate) => ({
    enabled: true,
    key: candidate,
    weight: defaultScoreWeights[candidate],
    ...(candidate === key ? overrides : {}),
  }));
}

describe("calculateLifeScore – Golden-Beispiele aus ADR 0009", () => {
  it("1 – reproduces the complete week exactly", () => {
    const result = run();

    expect(valueOf(result, "focus")).toBeCloseTo(expectedLifeScore.focus, 10);
    expect(valueOf(result, "habits")).toBeCloseTo(expectedLifeScore.habits, 10);
    expect(valueOf(result, "wellbeing")).toBeCloseTo(
      expectedLifeScore.wellbeing,
      10,
    );
    expect(valueOf(result, "goals")).toBeCloseTo(expectedLifeScore.goals, 10);
    expect(valueOf(result, "finance")).toBeCloseTo(
      expectedLifeScore.finance,
      10,
    );
    expect(result.total).toBeCloseTo(expectedLifeScore.total, 10);
    expect(result.completeness).toBe(expectedLifeScore.completeness);
    expect(roundScoreForDisplay(result.total)).toBe(
      expectedLifeScore.displayedTotal,
    );
    expect(result.version).toBe(lifeScoreEngineVersion);
  });

  // Die Lücke senkt den Wert nicht; er sinkt nur, weil Wohlbefinden über dem
  // Mittel der übrigen Bereiche lag. Ohne Normalisierung wären es 51,56.
  it("2 – leaves an empty journal out of numerator and denominator", () => {
    const result = run({ journalEntries: [] });

    expect(valueOf(result, "wellbeing")).toBeNull();
    expect(result.total).toBeCloseTo(64.446_663_533_834_6, 10);
    expect(roundScoreForDisplay(result.total)).toBe(64);
    expect(result.completeness).toBeCloseTo(0.8, 10);
  });

  it("3 – reports no statement at all on first use", () => {
    const result = calculateLifeScore(emptyInput, {
      timeZone: lifeScoreTimeZone,
      today: lifeScoreToday,
    });

    for (const key of scoreComponentKeys) {
      expect(valueOf(result, key)).toBeNull();
    }
    expect(result.total).toBeNull();
    expect(result.completeness).toBe(0);
  });

  it("4 – treats a disabled component as a decision, not as a gap", () => {
    const result = run(
      {},
      { components: withComponent("finance", { enabled: false }) },
    );
    const finance = findScoreComponent(result, "finance");

    expect(finance.enabled).toBe(false);
    expect(finance.value).toBeNull();
    expect(finance.inputs).toEqual([]);
    expect(finance.basis).toBe("Diese Komponente ist abgeschaltet.");
    expect(result.total).toBeCloseTo(64.773_330_384_785_5, 10);
    expect(roundScoreForDisplay(result.total)).toBe(65);
    expect(result.completeness).toBe(1);
  });

  // Zwei von zwei wären 100 gewesen. Die Mindestdaten verhindern, dass eine
  // dünne Woche den Wert trägt — auch dann, wenn sie ihn verbessert hätte.
  it("5 – withholds focus below the minimum data, even when it would help", () => {
    const result = run({ tasks: lifeScoreTasks.slice(0, 2) });

    expect(valueOf(result, "focus")).toBeNull();
    expect(result.total).toBeCloseTo(66.357_142_857_142_85, 10);
    expect(roundScoreForDisplay(result.total)).toBe(66);
    expect(result.completeness).toBeCloseTo(0.8, 10);
  });

  it("6 – lowers finance on an exceeded budget and caps an exceeded savings goal", () => {
    const budgets: MonthlyBudget[] = [
      {
        ...lifeScoreBudgets[0],
        limit: { amountMinor: 30_000, currency: "EUR" },
      },
    ];
    const transactions = lifeScoreTransactions.map((transaction) =>
      transaction.categoryId === budgets[0].categoryId &&
      transaction.bookedOn.startsWith("2026-08")
        ? { ...transaction, money: { amountMinor: 45_000, currency: "EUR" } }
        : transaction,
    );
    const contributions = [
      {
        ...lifeScoreContributions[0],
        money: { amountMinor: 120_000, currency: "EUR" },
      },
    ];

    const result = run({
      budgets,
      contributions,
      savingsGoals: [lifeScoreSavingsGoals[0]],
      transactions,
    });

    // Budgettreue 300/450 = 0,667; Sparfortschritt bei 1,0 gekappt.
    expect(valueOf(result, "finance")).toBeCloseTo(83.333_333_333_333_33, 10);
  });

  it("7 – keeps a real zero distinguishable from a missing statement", () => {
    const openTasks: Task[] = lifeScoreTasks.map((task) =>
      task.status === "completed"
        ? { ...task, completedAt: undefined, status: "open" }
        : task,
    );

    const result = run({
      habitEntries: [],
      habits: [lifeScoreHabits[0]],
      tasks: openTasks,
    });

    expect(valueOf(result, "focus")).toBe(0);
    expect(valueOf(result, "habits")).toBe(0);
    expect(findScoreComponent(result, "focus").contributes).toBe(true);
    expect(findScoreComponent(result, "habits").contributes).toBe(true);
  });
});

describe("calculateLifeScore – Zeitraum", () => {
  it("looks at the seven days up to and including the scored day", () => {
    expect(getLifeScorePeriod(lifeScoreToday)).toEqual(lifeScorePeriod);
    expect(run().period).toEqual(lifeScorePeriod);
  });

  it("uses the calendar month for finance and names it on the component", () => {
    expect(getFinancePeriod(lifeScoreToday)).toEqual(lifeScoreFinancePeriod);
    expect(findScoreComponent(run(), "finance").period).toEqual(
      lifeScoreFinancePeriod,
    );
  });

  it("covers a month of any length", () => {
    expect(getFinancePeriod("2026-02-15")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(getFinancePeriod("2026-12-31")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });
});

describe("calculateLifeScore – Determinismus und Schreibschutz", () => {
  it("returns the same output for the same input, period and version", () => {
    expect(run()).toEqual(run());
  });

  it("does not change any source record", () => {
    const snapshot = structuredClone(lifeScoreInput);

    run();

    expect(lifeScoreInput).toEqual(snapshot);
  });

  it("orders the components the same way every time", () => {
    expect(run().components.map((component) => component.key)).toEqual([
      ...scoreComponentKeys,
    ]);
  });

  it("keeps every value inside the promised range", () => {
    const result = run();

    for (const component of result.components) {
      if (component.value === null) continue;
      expect(component.value).toBeGreaterThanOrEqual(0);
      expect(component.value).toBeLessThanOrEqual(100);
    }
    expect(result.completeness).toBeGreaterThanOrEqual(0);
    expect(result.completeness).toBeLessThanOrEqual(1);
  });

  it("rounds only for the display and never inside the total", () => {
    const result = run();
    const focus = findScoreComponent(result, "focus").value;

    expect(Number.isInteger(focus)).toBe(false);
    expect(Number.isInteger(result.total)).toBe(false);
    expect(roundScoreForDisplay(focus)).toBe(63);
  });
});

describe("calculateLifeScore – Fokus", () => {
  it("weights planned tasks by priority and reports both sides", () => {
    const focus = findScoreComponent(run(), "focus");

    expect(focus.inputs).toEqual([
      { metric: "plannedPriorityWeight", sourceCount: 10, value: 19 },
      { metric: "completedPriorityWeight", sourceCount: 5, value: 12 },
    ]);
    expect(focus.sourceCount).toBe(10);
  });

  it("counts a cancelled task in neither numerator nor denominator", () => {
    const withoutCancelled = lifeScoreTasks.filter(
      (task) => task.status !== "cancelled",
    );

    expect(valueOf(run({ tasks: withoutCancelled }), "focus")).toBe(
      valueOf(run(), "focus"),
    );
  });

  it("ignores tasks without a planned date", () => {
    const withoutUnplanned = lifeScoreTasks.filter(
      (task) => task.plannedDate !== undefined,
    );

    expect(valueOf(run({ tasks: withoutUnplanned }), "focus")).toBe(
      valueOf(run(), "focus"),
    );
  });
});

describe("calculateLifeScore – Gewohnheiten", () => {
  it("keeps skipped units in the denominator and reports them separately", () => {
    const habits = findScoreComponent(run(), "habits");

    expect(habits.inputs).toEqual([
      { metric: "target", sourceCount: 2, value: 14 },
      { metric: "done", sourceCount: 2, value: 11 },
      { metric: "skipped", sourceCount: 2, value: 1 },
    ]);
    expect(habits.basis).toContain("übersprungen");
  });

  it("withholds a value below three planned units", () => {
    const habits = [
      { ...lifeScoreHabits[0], endDate: "2026-08-02", startDate: "2026-08-01" },
    ];

    expect(valueOf(run({ habits }), "habits")).toBeNull();
  });
});

describe("calculateLifeScore – Wohlbefinden", () => {
  it("inverts stress and leaves an omitted scale out of the mean", () => {
    const result = run({
      journalEntries: [
        { ...lifeScoreInput.journalEntries[0], localDate: "2026-08-01" },
        { ...lifeScoreInput.journalEntries[4], localDate: "2026-08-02" },
        { ...lifeScoreInput.journalEntries[5], localDate: "2026-08-03" },
      ],
    });

    // (0,75 + 0,75 + 0,5 + 0,5) / 4 = 0,625
    expect(valueOf(result, "wellbeing")).toBeCloseTo(62.5, 10);
  });

  it("does not let a free-text entry meet the minimum data", () => {
    const wellbeing = findScoreComponent(run(), "wellbeing");

    expect(wellbeing.sourceCount).toBe(6);
    expect(wellbeing.inputs).toContainEqual({
      metric: "daysWithSelfAssessment",
      sourceCount: 7,
      value: 6,
    });
  });
});

describe("calculateLifeScore – Ziele", () => {
  it("does not lower the value when a goal is created inside the window", () => {
    const withoutNewGoal = lifeScoreGoals.filter(
      (goal) => goal.createdAt < "2026-07-31T00:00:00.000Z",
    );

    expect(valueOf(run({ goals: withoutNewGoal }), "goals")).toBe(
      valueOf(run(), "goals"),
    );
    expect(findScoreComponent(run(), "goals").inputs).toContainEqual({
      metric: "goalsCreatedInPeriod",
      sourceCount: 1,
      value: 1,
    });
  });

  // Der lokale Kalendertag entscheidet, nicht die UTC-Angabe des Zeitstempels.
  it("reads the creation day in the given time zone", () => {
    const goals: Goal[] = [
      { ...lifeScoreGoals[0], createdAt: "2026-07-30T23:30:00.000Z" },
    ];

    expect(valueOf(run({ goals }, { timeZone: "UTC" }), "goals")).toBe(50);
    expect(
      valueOf(run({ goals }, { timeZone: "Europe/Berlin" }), "goals"),
    ).toBe(null);
  });
});

describe("calculateLifeScore – Finanzen", () => {
  it("names a deviating currency instead of converting it", () => {
    const savingsGoals: SavingsGoal[] = [
      {
        ...lifeScoreSavingsGoals[0],
        target: { amountMinor: 100_000, currency: "CHF" },
      },
    ];
    const finance = findScoreComponent(run({ savingsGoals }), "finance");

    expect(finance.value).toBeNull();
    expect(finance.basis).toContain("Währungen");
  });

  it("uses the only available sub value when the other is missing", () => {
    const finance = findScoreComponent(
      run({ budgets: [], savingsGoals: lifeScoreSavingsGoals }),
      "finance",
    );

    expect(finance.value).toBeCloseTo(40, 10);
    expect(finance.inputs).toEqual([
      { metric: "savingsProgress", sourceCount: 1, value: 0.4 },
    ]);
  });
});

describe("calculateLifeScore – Gewichte", () => {
  it("fills a missing component from the default weights", () => {
    const partial: ScoreComponentConfig[] = [
      { enabled: true, key: "focus", weight: 25 },
    ];

    expect(run({}, { components: partial })).toEqual(run());
  });

  it("keeps a component with weight zero out of total and completeness", () => {
    const result = run(
      {},
      { components: withComponent("finance", { weight: 0 }) },
    );
    const finance = findScoreComponent(result, "finance");

    expect(finance.value).toBeCloseTo(expectedLifeScore.finance, 10);
    expect(finance.contributes).toBe(false);
    expect(result.total).toBeCloseTo(64.773_330_384_785_5, 10);
    expect(result.completeness).toBe(1);
  });

  // Die Vorschau darf nicht anders rechnen als der gespeicherte Stand, sonst
  // verspricht sie eine Wirkung, die nach dem Speichern nicht eintritt.
  it("reweights an existing result exactly like a fresh calculation", () => {
    const components = withComponent("finance", { enabled: false });

    expect(applyScoreWeights(run(), components)).toEqual(
      run({}, { components }),
    );
  });

  it("reweights without touching the sub values themselves", () => {
    const reweighted = applyScoreWeights(
      run(),
      withComponent("focus", { weight: 60 }),
    );

    expect(findScoreComponent(reweighted, "focus").value).toBeCloseTo(
      expectedLifeScore.focus,
      10,
    );
    expect(findScoreComponent(reweighted, "focus").weight).toBe(60);
  });

  it("does not shift the ratio of the remaining components", () => {
    const doubled = scoreComponentKeys.map((key) => ({
      enabled: true,
      key,
      weight: defaultScoreWeights[key] * 2,
    }));

    expect(run({}, { components: doubled }).total).toBeCloseTo(
      expectedLifeScore.total,
      10,
    );
  });
});
