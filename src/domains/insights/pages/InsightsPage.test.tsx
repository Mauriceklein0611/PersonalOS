import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MemoryRouter } from "react-router";

import { buildEntityMeta } from "../../../test/factories/entity";
import {
  lifeScoreGoals,
  lifeScoreHabitEntries,
  lifeScoreHabits,
  lifeScoreInput,
  lifeScoreJournalEntries,
  lifeScoreMilestones,
  lifeScoreTasks,
  lifeScoreTimeZone,
  lifeScoreToday,
  lifeScoreTransactions,
} from "../../../test/fixtures/life-score";
import type { Insight } from "../insight-model";
import { buildWeeklyReview, getReviewAnchorDay } from "../weekly-review";
import type { InsightService } from "../service";
import { calculateLifeScore, type LifeScoreInput } from "../score-engine";
import {
  createDefaultScoreComponents,
  resolveScoreComponents,
  type ScoreComponentConfig,
  type ScoreSettings,
} from "../score-model";
import type { ScoreOverview, ScoreService } from "../service";
import { InsightsPage } from "./InsightsPage";

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

/**
 * Die Seite bekommt einen Stub des Dienstes. Die Rechnung selbst ist in
 * `score-engine.test.ts` gegen das ADR geprüft; hier geht es um die Darstellung.
 */
const reviewInput = {
  goals: lifeScoreGoals,
  habitEntries: lifeScoreHabitEntries,
  habits: lifeScoreHabits,
  journalEntries: lifeScoreJournalEntries,
  milestones: lifeScoreMilestones,
  tasks: lifeScoreTasks,
  transactions: lifeScoreTransactions,
};

const period = { from: "2026-08-01", to: "2026-08-20" };
const budgetInsight: Insight = {
  action: { kind: "open-budget", targetId: "kategorie" },
  evidence: [{ metric: "spentShare", sourceCount: 3, value: 0.9 }],
  id: "budget-pace:budget-pace-v1:2026-08-01:2026-08-20:kategorie",
  message: "Nach 20 von 31 Tagen sind 90 % dieses Budgets gebucht.",
  period,
  ruleId: "budget-pace",
  ruleVersion: "budget-pace-v1",
  strength: "medium",
};

function createStubService(
  input: LifeScoreInput = lifeScoreInput,
  initial: ScoreComponentConfig[] = createDefaultScoreComponents(),
  insights: Insight[] = [budgetInsight],
) {
  let settings: ScoreSettings = {
    ...buildEntityMeta(),
    components: initial,
    enabled: true,
  };

  const overview = (): ScoreOverview => ({
    result: calculateLifeScore(input, {
      components: settings.components,
      timeZone: lifeScoreTimeZone,
      today: lifeScoreToday,
    }),
    settings,
  });

  const service: ScoreService = {
    load: () => Promise.resolve(overview()),
    loadSettings: () => Promise.resolve(settings),
    saveComponents: (components) => {
      settings = {
        ...settings,
        components: resolveScoreComponents(components),
      };
      return Promise.resolve(settings);
    },
    setEnabled: (enabled) => {
      settings = { ...settings, enabled };
      return Promise.resolve(settings);
    },
  };

  const hiddenIds = new Set<string>();
  const insightService: InsightService = {
    hide: (insight) => {
      hiddenIds.add(insight.id);
      return Promise.resolve();
    },
    load: () =>
      Promise.resolve({ failedRuleIds: [], hiddenCount: 0, insights: [] }),
    loadWeek: (period, day) => {
      const anchorDay = getReviewAnchorDay(period, day);
      const all = insights.filter(() => true);
      const visible = all.filter((entry) => !hiddenIds.has(entry.id));
      return Promise.resolve({
        anchorDay,
        failedRuleIds: [],
        hiddenCount: all.length - visible.length,
        insights: visible,
        review: buildWeeklyReview(reviewInput, period),
        score: overview().result,
        settings,
      });
    },
    showAgain: () => Promise.resolve(true),
  };

  return { getSettings: () => settings, insightService, service };
}

function renderPage(stub: ReturnType<typeof createStubService>) {
  render(
    <MemoryRouter>
      <InsightsPage
        insightService={stub.insightService}
        now={() => new Date("2026-08-06T10:00:00.000Z")}
        service={stub.service}
        timeZone={lifeScoreTimeZone}
      />
    </MemoryRouter>,
  );
}

async function findWeightField(name: string) {
  return screen.findByRole("spinbutton", { name: new RegExp(name) });
}

describe("InsightsPage – vollständige Daten", () => {
  it("describes the score as a personal orientation, not a judgement", async () => {
    renderPage(createStubService());

    expect(
      await screen.findByRole("heading", { level: 1, name: "Insights" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Deine Woche aus deinen eigenen Einträgen – keine Bewertung deines Lebens und kein Vergleich mit anderen\./,
      ),
    ).toBeInTheDocument();
  });

  it("shows the total, its basis and the calculation version", async () => {
    renderPage(createStubService());

    expect(await screen.findByText("67 von 100")).toBeInTheDocument();
    expect(screen.getByText("5 von 5 Bereichen")).toBeInTheDocument();
    expect(screen.getByText("life-score-v2")).toBeInTheDocument();
    expect(screen.getByText("31.07.2026 bis 06.08.2026")).toBeInTheDocument();
  });

  it("leads from a sub value to its data basis and formula in one step", async () => {
    const user = userEvent.setup();
    renderPage(createStubService());

    await user.click(
      await screen.findByRole("button", { name: "Warum? Erklärung zu Fokus" }),
    );

    expect(screen.getByText(/hoch zählt dreifach/)).toBeInTheDocument();
    expect(
      screen.getByText("Mindestens drei geplante Aufgaben im Zeitraum."),
    ).toBeInTheDocument();
    expect(screen.getByText("Geplante Prioritätspunkte")).toBeInTheDocument();
    expect(screen.getByText("Erledigte Prioritätspunkte")).toBeInTheDocument();
  });

  it("names the deviating period on the finance component", async () => {
    renderPage(createStubService());

    await screen.findByText("67 von 100");
    expect(
      screen.getByText("Zeitraum: 01.08.2026 bis 31.08.2026"),
    ).toBeInTheDocument();
  });

  it("gives every sub value as text, not only as a bar", async () => {
    renderPage(createStubService());

    const focus = await screen.findByRole("progressbar", { name: "Fokus" });
    expect(focus).toHaveValue(63);
    expect(screen.getByText("63 von 100")).toBeInTheDocument();
    // 11 von 13 zählenden Einheiten; die übersprungene zählt nicht mit.
    expect(screen.getByText("85 von 100")).toBeInTheDocument();
  });
});

describe("InsightsPage – Wochenrückblick-Verweis", () => {
  it("points to the dedicated weekly review page instead of repeating its figures", async () => {
    renderPage(createStubService());

    expect(
      await screen.findByRole("heading", { level: 2, name: "Wochenrückblick" }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Wochenrückblick öffnen" });
    expect(link).toHaveAttribute("href", "/wochenrueckblick");
  });

  it("no longer shows a week heading, week navigation or weekly figures here", async () => {
    renderPage(createStubService());
    await screen.findByRole("heading", { level: 2, name: "Wochenrückblick" });

    // Diese Kennzahlen ziehen komplett auf die neue Seite; eine zweite Kopie
    // hier wäre dieselbe Zahl an zwei Stellen.
    expect(
      screen.queryByRole("heading", { name: /^Woche vom/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Vorherige Woche" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nächste Woche" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Grundlage: 6 geplante Aufgaben."),
    ).not.toBeInTheDocument();
  });
});

describe("InsightsPage – Beobachtungen", () => {
  it("shows an observation with its period and data basis", async () => {
    renderPage(createStubService());

    expect(
      await screen.findByText(
        "Nach 20 von 31 Tagen sind 90 % dieses Budgets gebucht.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Erkennbar")).toBeInTheDocument();
    expect(screen.getByText("Gebuchter Budgetanteil")).toBeInTheDocument();
    expect(
      screen.getByText("Zeitraum: 01.08.2026 bis 20.08.2026"),
    ).toBeInTheDocument();
  });

  it("offers an optional action into an existing flow", async () => {
    renderPage(createStubService());

    const link = await screen.findByRole("link", { name: "Budgets öffnen" });
    expect(link).toHaveAttribute("href", "/finanzen");
  });

  it("hides an observation without touching the entries", async () => {
    const user = userEvent.setup();
    renderPage(createStubService());
    await screen.findByText(
      "Nach 20 von 31 Tagen sind 90 % dieses Budgets gebucht.",
    );

    await user.click(
      screen.getByRole("button", { name: "Beobachtung ausblenden" }),
    );

    expect(
      await screen.findByText(
        "Die Beobachtung ist ausgeblendet. Deine Einträge bleiben unverändert.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 Beobachtung ausgeblendet\. Die zugrunde liegenden Einträge sind unverändert\./,
      ),
    ).toBeInTheDocument();
  });

  it("explains an empty week instead of leaving a blank area", async () => {
    renderPage(createStubService(lifeScoreInput, undefined, []));

    expect(
      await screen.findByText("Noch keine Beobachtung"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Ohne ausreichende Grundlage wird bewusst nichts behauptet/,
      ),
    ).toBeInTheDocument();
  });
});

describe("InsightsPage – unvollständige Daten", () => {
  it("shows a missing value as no statement and never as zero", async () => {
    renderPage(createStubService({ ...lifeScoreInput, journalEntries: [] }));

    await screen.findByText("66 von 100");
    expect(screen.getByText("4 von 5 Bereichen")).toBeInTheDocument();
    expect(screen.getAllByText("Keine Angabe").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Weniger als 3 Tage mit Selbsteinschätzung im Zeitraum\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: "Wohlbefinden" }),
    ).not.toBeInTheDocument();
  });

  it("explains an empty database instead of showing a zero score", async () => {
    renderPage(createStubService(emptyInput));

    expect(
      await screen.findByText(/Für diesen Zeitraum liegt noch zu wenig vor/),
    ).toBeInTheDocument();
    // Nicht „0 von 100“: Ohne Grundlage gibt es keine Aussage, auch keine
    // schlechte.
    expect(screen.getByText("0 von 5 Bereichen")).toBeInTheDocument();
    expect(screen.getAllByText("Keine Angabe").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 von 100")).not.toBeInTheDocument();
  });
});

describe("InsightsPage – Bereiche und Gewichtung", () => {
  it("shows the share of every weight instead of a bare number", async () => {
    renderPage(createStubService());

    await screen.findByText("67 von 100");
    expect(screen.getAllByText("25 % der Gewichtung")).toHaveLength(2);
    expect(screen.getAllByText("15 % der Gewichtung")).toHaveLength(2);
  });

  it("previews the effect of a weight before it is saved", async () => {
    const user = userEvent.setup();
    const stub = createStubService();
    const getSettings = stub.getSettings;
    renderPage(stub);

    const field = await findWeightField("Gewicht für Fokus");
    await user.clear(field);
    await user.type(field, "50");

    expect(
      await screen.findByText(/Mit dieser Gewichtung: 66 von 100/),
    ).toBeInTheDocument();
    // Vor dem Speichern bleibt die Konfiguration unverändert.
    expect(getSettings().components).toContainEqual({
      enabled: true,
      key: "focus",
      weight: 25,
    });
  });

  it("saves a valid configuration and recalculates with it", async () => {
    const user = userEvent.setup();
    const stub = createStubService();
    const getSettings = stub.getSettings;
    renderPage(stub);

    const field = await findWeightField("Gewicht für Fokus");
    await user.clear(field);
    await user.type(field, "50");
    await user.click(
      screen.getByRole("button", { name: "Gewichtung speichern" }),
    );

    expect(
      await screen.findByText("Die Gewichtung wurde gespeichert."),
    ).toBeInTheDocument();
    expect(getSettings().components).toContainEqual({
      enabled: true,
      key: "focus",
      weight: 50,
    });
    expect(screen.getByText("40 % der Gewichtung")).toBeInTheDocument();
  });

  it("refuses an invalid weight with a correction hint", async () => {
    const user = userEvent.setup();
    const stub = createStubService();
    const getSettings = stub.getSettings;
    renderPage(stub);

    const field = await findWeightField("Gewicht für Fokus");
    await user.clear(field);
    await user.click(
      screen.getByRole("button", { name: "Gewichtung speichern" }),
    );

    expect(
      await screen.findByText(
        "Gib je Bereich eine ganze Zahl zwischen 0 und 100 ein.",
      ),
    ).toBeInTheDocument();
    expect(getSettings().components).toContainEqual({
      enabled: true,
      key: "focus",
      weight: 25,
    });
  });

  it("treats a switched-off area as a decision, not as a gap", async () => {
    const user = userEvent.setup();
    renderPage(createStubService());

    await user.click(
      await screen.findByRole("checkbox", { name: "Finanzen einbeziehen" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Gewichtung speichern" }),
    );

    expect(await screen.findByText("67 von 100")).toBeInTheDocument();
    expect(screen.getByText("4 von 4 Bereichen")).toBeInTheDocument();
  });

  it("hides the score without deleting anything and offers it back", async () => {
    const user = userEvent.setup();
    renderPage(createStubService());

    await user.click(
      await screen.findByRole("button", { name: "Life Score ausblenden" }),
    );

    const note = await screen.findByRole("note");
    expect(
      within(note).getByText("Life Score ist ausgeblendet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Deine Einträge werden weiterhin gespeichert und der Wert lässt sich jederzeit wieder einblenden\./,
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Life Score anzeigen" }),
    );
    expect(await screen.findByText("67 von 100")).toBeInTheDocument();
  });
});
