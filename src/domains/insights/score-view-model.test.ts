import { describe, expect, it } from "vitest";

import {
  lifeScoreInput,
  lifeScoreTimeZone,
  lifeScoreToday,
} from "../../test/fixtures/life-score";
import { calculateLifeScore, findScoreComponent } from "./score-engine";
import {
  createDefaultScoreComponents,
  type ScoreComponentConfig,
} from "./score-model";
import {
  buildComponentView,
  describeCompleteness,
  describeEvidence,
  describePeriod,
  describeWeightShare,
  formatScoreValue,
  toScoreRatio,
} from "./score-view-model";

const components = createDefaultScoreComponents();

function calculate(overrides: readonly ScoreComponentConfig[] = components) {
  return calculateLifeScore(lifeScoreInput, {
    components: overrides,
    timeZone: lifeScoreTimeZone,
    today: lifeScoreToday,
  });
}

describe("formatScoreValue", () => {
  it("names a missing value instead of writing zero", () => {
    expect(formatScoreValue(null)).toBe("Keine Angabe");
    expect(formatScoreValue(0)).toBe("0 von 100");
  });

  it("rounds only for the display", () => {
    expect(formatScoreValue(63.157_894_736_842_1)).toBe("63 von 100");
  });
});

describe("toScoreRatio", () => {
  it("carries a missing value through as null", () => {
    expect(toScoreRatio(null)).toBeNull();
    expect(toScoreRatio(70)).toBeCloseTo(0.7, 10);
  });
});

describe("describePeriod", () => {
  it("names both ends of the period in German", () => {
    expect(describePeriod({ from: "2026-07-31", to: "2026-08-06" })).toBe(
      "31.07.2026 bis 06.08.2026",
    );
  });
});

describe("describeCompleteness", () => {
  it("counts contributing against expected areas", () => {
    expect(describeCompleteness(calculate())).toBe("5 von 5 Bereichen");
  });

  it("does not count a disabled area as a gap", () => {
    const result = calculate(
      components.map((component) =>
        component.key === "finance"
          ? { ...component, enabled: false }
          : component,
      ),
    );

    expect(describeCompleteness(result)).toBe("4 von 4 Bereichen");
  });

  it("explains an empty basis instead of showing zero of zero", () => {
    const result = calculate(
      components.map((component) => ({ ...component, enabled: false })),
    );

    expect(describeCompleteness(result)).toBe("Kein Bereich ist einbezogen.");
  });
});

describe("describeWeightShare", () => {
  it("names the share of the total weighting", () => {
    expect(describeWeightShare(components, "focus")).toBe(
      "25 % der Gewichtung",
    );
    expect(describeWeightShare(components, "goals")).toBe(
      "15 % der Gewichtung",
    );
  });

  it("says plainly when an area does not count", () => {
    const disabled = components.map((component) =>
      component.key === "goals" ? { ...component, enabled: false } : component,
    );

    expect(describeWeightShare(disabled, "goals")).toBe("Zählt nicht mit.");
    expect(
      describeWeightShare(
        components.map((component) =>
          component.key === "goals" ? { ...component, weight: 0 } : component,
        ),
        "goals",
      ),
    ).toBe("Zählt nicht mit.");
  });

  it("recalculates the share when a weight changes", () => {
    const doubled = components.map((component) =>
      component.key === "focus" ? { ...component, weight: 50 } : component,
    );

    // 50 von 125 sind 40 Prozent.
    expect(describeWeightShare(doubled, "focus")).toBe("40 % der Gewichtung");
  });
});

describe("describeEvidence", () => {
  it("reads a ratio as percent and a scale against its maximum", () => {
    expect(
      describeEvidence({ metric: "budgetAdherence", sourceCount: 1, value: 1 }),
    ).toEqual({
      label: "Budgettreue",
      sourceText: "1 Datensatz",
      value: "100 %",
    });
    expect(
      describeEvidence({ metric: "moodMean", sourceCount: 4, value: 4 }),
    ).toEqual({
      label: "Stimmung im Mittel",
      sourceText: "4 Datensätze",
      value: "4 von 5",
    });
  });

  it("keeps an unknown metric readable instead of hiding it", () => {
    expect(
      describeEvidence({ metric: "somethingNew", sourceCount: 2, value: 7 }),
    ).toEqual({
      label: "somethingNew",
      sourceText: "2 Datensätze",
      value: "7",
    });
  });
});

describe("buildComponentView", () => {
  it("carries value, basis, weight and period of a component", () => {
    const view = buildComponentView(
      findScoreComponent(calculate(), "focus"),
      components,
    );

    expect(view.label).toBe("Fokus");
    expect(view.valueText).toBe("63 von 100");
    expect(view.ratio).toBeCloseTo(0.631_578_947_368_421, 10);
    expect(view.weightText).toBe("25 % der Gewichtung");
    expect(view.periodText).toBe("31.07.2026 bis 06.08.2026");
    expect(view.basis).toContain("5 von 10 geplanten Aufgaben");
    expect(view.evidence.map((row) => row.label)).toEqual([
      "Geplante Prioritätspunkte",
      "Erledigte Prioritätspunkte",
    ]);
  });

  // Finanzen weicht bewusst vom Sieben-Tage-Fenster ab; der Wert muss das
  // selbst nennen, sonst widerspricht er der Zusage jedes Teilwerts.
  it("names the calendar month on the finance component", () => {
    const view = buildComponentView(
      findScoreComponent(calculate(), "finance"),
      components,
    );

    expect(view.periodText).toBe("01.08.2026 bis 31.08.2026");
  });

  it("keeps formula and minimum data available for every area", () => {
    for (const component of calculate().components) {
      const view = buildComponentView(component, components);
      expect(view.formula.length).toBeGreaterThan(0);
      expect(view.minimum.length).toBeGreaterThan(0);
      expect(view.description.length).toBeGreaterThan(0);
    }
  });
});
