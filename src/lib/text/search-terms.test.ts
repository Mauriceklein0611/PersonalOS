import { describe, expect, it } from "vitest";

import { createSearchMatcher, normaliseForSearch } from "./search-terms";

/**
 * Budget für die Freitextsuche über eine große Liste. Für 3.000 Aufgaben mit
 * Notiz wurden auf einem Entwicklungsrechner rund 7 ms im ersten und rund 4 ms
 * in den folgenden Durchläufen gemessen. Das Budget liegt bewusst weit
 * darüber: Es soll eine Regression um Größenordnungen erkennen, nicht die
 * Messstreuung unter paralleler Testlast.
 */
const searchBudgetMs = 500;

describe("search terms", () => {
  it("ignores case and diacritics on both sides", () => {
    expect(normaliseForSearch("Müller Café")).toBe("muller cafe");

    const matcher = createSearchMatcher("MULLER");

    expect(matcher.matches("Rechnung Müller")).toBe(true);
    expect(matcher.matches("Rechnung Meier")).toBe(false);
  });

  it("stays permissive while nothing usable was typed", () => {
    for (const term of ["", "   "]) {
      const matcher = createSearchMatcher(term);
      expect(matcher.isActive).toBe(false);
      expect(matcher.matches(undefined)).toBe(true);
    }
  });

  it("matches any of the given fields and tolerates missing ones", () => {
    const matcher = createSearchMatcher("  frist ");

    expect(matcher.isActive).toBe(true);
    expect(matcher.matches("Rechnung prüfen", "Vor der Frist erledigen")).toBe(
      true,
    );
    expect(matcher.matches("Rechnung prüfen", undefined)).toBe(false);
  });

  it("filters three thousand records within the measured budget", () => {
    const records = Array.from({ length: 3_000 }, (_, index) => ({
      notes: `Notiz ${index} mit etwas mehr Text, damit der Vergleich echte Arbeit hat.`,
      title: `Aufgabe ${index} für Müller`,
    }));
    const matcher = createSearchMatcher("aufgabe 2999");

    const startedAt = performance.now();
    const matches = records.filter((record) =>
      matcher.matches(record.title, record.notes),
    );
    const elapsed = performance.now() - startedAt;

    expect(matches).toHaveLength(1);
    expect(elapsed).toBeLessThan(searchBudgetMs);
  });
});
