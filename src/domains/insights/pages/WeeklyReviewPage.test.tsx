import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MemoryRouter } from "react-router";

import { buildEntityMeta } from "../../../test/factories/entity";
import {
  lifeScoreGoals,
  lifeScoreHabitEntries,
  lifeScoreHabits,
  lifeScoreJournalEntries,
  lifeScoreMilestones,
  lifeScoreTasks,
  lifeScoreTimeZone,
  lifeScoreTransactions,
} from "../../../test/fixtures/life-score";
import type { Task } from "../../tasks/model";
import { buildWeeklyReview, getReviewAnchorDay } from "../weekly-review";
import type { InsightService } from "../service";
import { createDefaultScoreComponents } from "../score-model";
import { calculateLifeScore, type LifeScoreInput } from "../score-engine";
import { WeeklyReviewPage } from "./WeeklyReviewPage";

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

const reviewInput = {
  goals: lifeScoreGoals,
  habitEntries: lifeScoreHabitEntries,
  habits: lifeScoreHabits,
  journalEntries: lifeScoreJournalEntries,
  milestones: lifeScoreMilestones,
  tasks: lifeScoreTasks,
  transactions: lifeScoreTransactions,
};

/**
 * Wie in `InsightsPage.test.tsx`: Die Rechnung selbst ist in
 * `weekly-review.test.ts` gegen ihre eigenen Regeln geprüft; hier geht es um
 * die Darstellung. Der Stub liefert die vollständige Vertragsform von
 * `InsightService`, auch wenn diese Seite nur `review` liest.
 */
function createStubService(input: {
  goals: typeof lifeScoreGoals;
  habitEntries: typeof lifeScoreHabitEntries;
  habits: typeof lifeScoreHabits;
  journalEntries: typeof lifeScoreJournalEntries;
  milestones: typeof lifeScoreMilestones;
  tasks: readonly Task[];
  transactions: typeof lifeScoreTransactions;
} = reviewInput): InsightService {
  const components = createDefaultScoreComponents();
  const settings = { ...buildEntityMeta(), components, enabled: true };

  return {
    hide: () => Promise.resolve(),
    load: () =>
      Promise.resolve({ failedRuleIds: [], hiddenCount: 0, insights: [] }),
    loadWeek: (period, today, timeZone) => {
      const anchorDay = getReviewAnchorDay(period, today);
      return Promise.resolve({
        anchorDay,
        failedRuleIds: [],
        hiddenCount: 0,
        insights: [],
        review: buildWeeklyReview(input, period),
        // Diese Seite liest nur `review`; der Score wird trotzdem berechnet,
        // weil `InsightService.loadWeek` ihn vertraglich liefert.
        score: calculateLifeScore(emptyInput, {
          components,
          timeZone,
          today: anchorDay,
        }),
        settings,
      });
    },
    showAgain: () => Promise.resolve(true),
  };
}

function createFailingService(): InsightService {
  return {
    hide: () => Promise.resolve(),
    load: () =>
      Promise.resolve({ failedRuleIds: [], hiddenCount: 0, insights: [] }),
    loadWeek: () => Promise.reject(new Error("offline")),
    showAgain: () => Promise.resolve(true),
  };
}

function renderPage(insightService: InsightService) {
  render(
    <MemoryRouter>
      <WeeklyReviewPage
        insightService={insightService}
        now={() => new Date("2026-08-06T10:00:00.000Z")}
        timeZone={lifeScoreTimeZone}
      />
    </MemoryRouter>,
  );
}

describe("WeeklyReviewPage – Grundgerüst", () => {
  it("names the review and rules out a year review or a generated summary", async () => {
    renderPage(createStubService());

    expect(
      await screen.findByRole("heading", { level: 1, name: "Wochenrückblick" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /als Zahlen mit Zeitraum und Datenbasis, nicht als Bewertung/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Aus dem Journal geht nur die Anzahl der Tage mit einem Eintrag ein, kein Freitext\./,
      ),
    ).toBeInTheDocument();
  });

  it("names the running week and marks it as such", async () => {
    renderPage(createStubService());

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Woche vom 03.08.2026 bis 09.08.2026",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Dies ist die laufende Woche. Ausgewertet wird bis heute.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nächste Woche" }),
    ).toBeDisabled();
  });

  it("steps back a week and keeps the running-week note off the older week", async () => {
    const user = userEvent.setup();
    renderPage(createStubService());
    await screen.findByRole("heading", { level: 2, name: /Woche vom/ });

    await user.click(screen.getByRole("button", { name: "Vorherige Woche" }));

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Woche vom 27.07.2026 bis 02.08.2026",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nächste Woche" }),
    ).toBeEnabled();
    expect(
      screen.queryByText(
        "Dies ist die laufende Woche. Ausgewertet wird bis heute.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows a load failure instead of a silent blank page", async () => {
    renderPage(createFailingService());

    expect(
      await screen.findByText(
        "Der Wochenrückblick konnte nicht geladen werden.",
      ),
    ).toBeInTheDocument();
  });
});

/**
 * Die Kennzahlen dieser Woche erscheinen doppelt: einmal in der Übersicht,
 * einmal je Bereich im Vorwochenvergleich. Die Prüfung bleibt deshalb auf
 * die Übersichtsliste beschränkt.
 */
function weekOverviewList() {
  const list = document.querySelector(".weekly-review-figures");
  expect(list).not.toBeNull();
  return within(list as HTMLElement);
}

describe("WeeklyReviewPage – Datengrundlage der Woche", () => {
  it("gives the task, habit and goal figure a basis and a period", async () => {
    renderPage(createStubService());
    await screen.findByRole("heading", { level: 2, name: /Woche vom/ });
    const overview = weekOverviewList();

    expect(
      overview.getByText(
        "Zeitraum: 03.08.2026 bis 09.08.2026 · Grundlage: 6 geplante Aufgaben.",
      ),
    ).toBeInTheDocument();
    expect(overview.getByText("2 von 6")).toBeInTheDocument();

    expect(
      overview.getByText(
        "Zeitraum: 03.08.2026 bis 09.08.2026 · Grundlage: 2 Gewohnheiten, 13 zählende Einheiten. 1 von 14 geplanten Einheiten übersprungen; sie zählen nicht mit.",
      ),
    ).toBeInTheDocument();
    expect(overview.getByText("5 von 13")).toBeInTheDocument();

    expect(
      overview.getByText(
        "Zeitraum: 03.08.2026 bis 09.08.2026 · Grundlage: 4 aktive Ziele.",
      ),
    ).toBeInTheDocument();
    expect(overview.getByText("0 Meilensteine")).toBeInTheDocument();
  });

  it("carries only the day count from the journal, no free text", async () => {
    renderPage(createStubService());
    await screen.findByRole("heading", { level: 2, name: /Woche vom/ });
    const overview = weekOverviewList();

    expect(overview.getByText("4 von 7 Tagen")).toBeInTheDocument();
    expect(
      screen.queryByText(/Nur Freitext, keine Selbsteinschätzung/),
    ).not.toBeInTheDocument();
  });

  it("shows a missing basis as an explicit statement, not as zero", async () => {
    renderPage(createStubService({ ...reviewInput, tasks: [] }));
    await screen.findByRole("heading", { level: 2, name: /Woche vom/ });
    const overview = weekOverviewList();

    expect(
      overview.getByText(
        "Zeitraum: 03.08.2026 bis 09.08.2026 · Für diese Woche war keine Aufgabe geplant.",
      ),
    ).toBeInTheDocument();
    expect(overview.getByText("Keine Angabe")).toBeInTheDocument();
  });
});

describe("WeeklyReviewPage – Vorwochenvergleich", () => {
  it("places this week's and the previous week's figure side by side, each with its own period and basis", async () => {
    renderPage(createStubService());
    await screen.findByRole("heading", {
      level: 2,
      name: "Woche vom 03.08.2026 bis 09.08.2026",
    });

    const heading = screen.getByRole("heading", { name: "Aufgaben" });
    const comparison = heading.closest("article");
    expect(comparison).not.toBeNull();
    const scoped = within(comparison as HTMLElement);

    expect(
      scoped.getByText(
        "Zeitraum: 03.08.2026 bis 09.08.2026 · Grundlage: 6 geplante Aufgaben.",
      ),
    ).toBeInTheDocument();
    expect(scoped.getByText("2 von 6")).toBeInTheDocument();
    expect(
      scoped.getByText(
        "Zeitraum: 27.07.2026 bis 02.08.2026 · Grundlage: 5 geplante Aufgaben.",
      ),
    ).toBeInTheDocument();
    expect(scoped.getByText("4 von 5")).toBeInTheDocument();
  });

  it("gives an explicit notice when the previous week has no comparison basis", async () => {
    const currentTask: Task = {
      ...buildEntityMeta(),
      plannedDate: "2026-08-04",
      priority: "normal",
      status: "completed",
      title: "Einzige Aufgabe dieser Woche",
    };
    renderPage(createStubService({ ...reviewInput, tasks: [currentTask] }));
    await screen.findByRole("heading", {
      level: 2,
      name: "Woche vom 03.08.2026 bis 09.08.2026",
    });

    const heading = screen.getByRole("heading", { name: "Aufgaben" });
    const comparison = heading.closest("article");
    const scoped = within(comparison as HTMLElement);

    expect(scoped.getByText("1 von 1")).toBeInTheDocument();
    expect(
      scoped.getByText(
        "Kein Vorwochenvergleich möglich: Für die vorherige Woche liegt keine Datenbasis vor.",
      ),
    ).toBeInTheDocument();
  });

  it("never phrases the comparison as an improvement or a decline", async () => {
    renderPage(createStubService());
    await screen.findByRole("heading", { level: 2, name: /Woche vom/ });

    const forbidden = [
      "besser",
      "schlechter",
      "verbessert",
      "verschlechtert",
      "\\bweil\\b",
      "dadurch",
      "deshalb",
    ];
    const body = document.body.textContent ?? "";
    for (const word of forbidden) {
      expect(body.toLowerCase()).not.toMatch(new RegExp(word, "i"));
    }
  });
});
