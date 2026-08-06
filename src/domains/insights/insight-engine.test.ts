import { describe, expect, it } from "vitest";

import {
  runInsightRules,
  sortInsights,
  withoutHiddenInsights,
} from "./insight-engine";
import { createInsightId, type Insight } from "./insight-model";
import {
  insightRules,
  type InsightInput,
  type InsightRule,
} from "./insight-rules";

const context = { timeZone: "Europe/Berlin", today: "2026-08-20" };

const emptyInput: InsightInput = {
  budgets: [],
  habitEntries: [],
  habits: [],
  tasks: [],
  transactions: [],
};

function stubInsight(
  ruleId: string,
  strength: Insight["strength"],
  subject = "",
): Insight {
  const period = { from: "2026-08-01", to: "2026-08-20" };
  return {
    evidence: [],
    id: createInsightId(ruleId, `${ruleId}-v1`, period, subject),
    message: "Synthetische Beobachtung.",
    period,
    ruleId,
    ruleVersion: `${ruleId}-v1`,
    strength,
  };
}

function stubRule(ruleId: string, insights: Insight[]): InsightRule {
  return {
    id: ruleId,
    run: () => insights,
    version: `${ruleId}-v1`,
  };
}

const failingRule: InsightRule = {
  id: "broken",
  run: () => {
    throw new Error("synthetic rule failure");
  },
  version: "broken-v1",
};

describe("runInsightRules", () => {
  it("returns the same result for the same input", () => {
    expect(runInsightRules(emptyInput, context)).toEqual(
      runInsightRules(emptyInput, context),
    );
  });

  it("does not change any source record", () => {
    const snapshot = structuredClone(emptyInput);

    runInsightRules(emptyInput, context);

    expect(emptyInput).toEqual(snapshot);
  });

  it("gives every rule a version and a period", () => {
    for (const rule of insightRules) {
      expect(rule.version).toContain(rule.id);
      expect(rule.version).toMatch(/-v\d+$/);
    }
  });

  // Ein Fehler in einer Regel darf nicht als „keine Beobachtung“ durchgehen.
  it("names a failing rule instead of swallowing it", () => {
    const working = stubRule("working", [stubInsight("working", "medium")]);

    const result = runInsightRules(emptyInput, context, [failingRule, working]);

    expect(result.failedRuleIds).toEqual(["broken"]);
    expect(result.insights).toHaveLength(1);
  });

  it("sorts clear observations before missing ones", () => {
    const rules = [
      stubRule("c", [stubInsight("c", "low")]),
      stubRule("a", [stubInsight("a", "medium")]),
      stubRule("b", [stubInsight("b", "high")]),
    ];

    expect(
      runInsightRules(emptyInput, context, rules).insights.map(
        (insight) => insight.ruleId,
      ),
    ).toEqual(["b", "a", "c"]);
  });

  it("keeps the order stable for equal strength", () => {
    const first = stubInsight("rule", "medium", "b");
    const second = stubInsight("rule", "medium", "a");

    expect(sortInsights([first, second]).map((insight) => insight.id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});

describe("createInsightId", () => {
  const period = { from: "2026-08-01", to: "2026-08-20" };

  it("stays stable for the same rule, version, period and subject", () => {
    expect(
      createInsightId("budget-pace", "budget-pace-v1", period, "abc"),
    ).toBe(createInsightId("budget-pace", "budget-pace-v1", period, "abc"));
  });

  it("changes with a new rule version, so an old hide does not carry over", () => {
    expect(createInsightId("budget-pace", "budget-pace-v1", period)).not.toBe(
      createInsightId("budget-pace", "budget-pace-v2", period),
    );
  });

  it("changes with the period, so a new week is a new observation", () => {
    expect(createInsightId("rule", "rule-v1", period)).not.toBe(
      createInsightId("rule", "rule-v1", {
        from: "2026-07-01",
        to: "2026-07-20",
      }),
    );
  });
});

describe("withoutHiddenInsights", () => {
  it("removes only the presentation of the hidden one", () => {
    const kept = stubInsight("a", "medium");
    const hidden = stubInsight("b", "medium");

    const visible = withoutHiddenInsights([kept, hidden], new Set([hidden.id]));

    expect(visible).toEqual([kept]);
  });

  it("keeps everything when nothing is hidden", () => {
    const insights = [stubInsight("a", "medium"), stubInsight("b", "high")];

    expect(withoutHiddenInsights(insights, new Set())).toEqual(insights);
  });
});
