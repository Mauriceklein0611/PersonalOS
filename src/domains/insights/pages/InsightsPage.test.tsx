import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buildEntityMeta } from "../../../test/factories/entity";
import {
  lifeScoreInput,
  lifeScoreTimeZone,
  lifeScoreToday,
} from "../../../test/fixtures/life-score";
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
function createStubService(
  input: LifeScoreInput = lifeScoreInput,
  initial: ScoreComponentConfig[] = createDefaultScoreComponents(),
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

  return { getSettings: () => settings, service };
}

function renderPage(service: ScoreService) {
  render(
    <InsightsPage
      now={() => new Date("2026-08-06T10:00:00.000Z")}
      service={service}
      timeZone={lifeScoreTimeZone}
    />,
  );
}

async function findWeightField(name: string) {
  return screen.findByRole("spinbutton", { name: new RegExp(name) });
}

describe("InsightsPage – vollständige Daten", () => {
  it("describes the score as a personal orientation, not a judgement", async () => {
    renderPage(createStubService().service);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Insights" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Der Life Score ist eine persönliche Orientierung aus deinen eigenen Einträgen/,
      ),
    ).toBeInTheDocument();
  });

  it("shows the total, its basis and the calculation version", async () => {
    renderPage(createStubService().service);

    expect(await screen.findByText("66 von 100")).toBeInTheDocument();
    expect(screen.getByText("5 von 5 Bereichen")).toBeInTheDocument();
    expect(screen.getByText("life-score-v1")).toBeInTheDocument();
    expect(screen.getByText("31.07.2026 bis 06.08.2026")).toBeInTheDocument();
  });

  it("leads from a sub value to its data basis and formula in one step", async () => {
    const user = userEvent.setup();
    renderPage(createStubService().service);

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
    renderPage(createStubService().service);

    await screen.findByText("66 von 100");
    expect(
      screen.getByText("Zeitraum: 01.08.2026 bis 31.08.2026"),
    ).toBeInTheDocument();
  });

  it("gives every sub value as text, not only as a bar", async () => {
    renderPage(createStubService().service);

    const focus = await screen.findByRole("progressbar", { name: "Fokus" });
    expect(focus).toHaveValue(63);
    expect(screen.getByText("63 von 100")).toBeInTheDocument();
    expect(screen.getByText("79 von 100")).toBeInTheDocument();
  });
});

describe("InsightsPage – unvollständige Daten", () => {
  it("shows a missing value as no statement and never as zero", async () => {
    renderPage(
      createStubService({ ...lifeScoreInput, journalEntries: [] }).service,
    );

    await screen.findByText("64 von 100");
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
    renderPage(createStubService(emptyInput).service);

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
    renderPage(createStubService().service);

    await screen.findByText("66 von 100");
    expect(screen.getAllByText("25 % der Gewichtung")).toHaveLength(2);
    expect(screen.getAllByText("15 % der Gewichtung")).toHaveLength(2);
  });

  it("previews the effect of a weight before it is saved", async () => {
    const user = userEvent.setup();
    const { getSettings, service } = createStubService();
    renderPage(service);

    const field = await findWeightField("Gewicht für Fokus");
    await user.clear(field);
    await user.type(field, "50");

    expect(
      await screen.findByText(/Mit dieser Gewichtung: 65 von 100/),
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
    const { getSettings, service } = createStubService();
    renderPage(service);

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
    const { getSettings, service } = createStubService();
    renderPage(service);

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
    renderPage(createStubService().service);

    await user.click(
      await screen.findByRole("checkbox", { name: "Finanzen einbeziehen" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Gewichtung speichern" }),
    );

    expect(await screen.findByText("65 von 100")).toBeInTheDocument();
    expect(screen.getByText("4 von 4 Bereichen")).toBeInTheDocument();
  });

  it("hides the score without deleting anything and offers it back", async () => {
    const user = userEvent.setup();
    renderPage(createStubService().service);

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
    expect(await screen.findByText("66 von 100")).toBeInTheDocument();
  });
});
