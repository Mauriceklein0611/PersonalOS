import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import {
  createSettingsRepository,
  type SettingsRepository,
} from "../../db/settings/repository";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { AppPreferencesPanel } from "./AppPreferencesPanel";
import { SettingsProvider } from "./SettingsProvider";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

function renderPanel(repository: SettingsRepository) {
  return render(
    <SettingsProvider repository={repository}>
      <AppPreferencesPanel />
    </SettingsProvider>,
  );
}

describe("AppPreferencesPanel", () => {
  it("shows the stored values and the fixed week start", async () => {
    const repository = createSettingsRepository(database);
    await repository.save({
      baseCurrency: "CHF",
      timeZone: "Europe/Zurich",
    });

    renderPanel(repository);

    await waitFor(() => {
      expect(screen.getByLabelText("Zeitzone")).toHaveValue("Europe/Zurich");
    });
    expect(screen.getByLabelText("Übersichtswährung")).toHaveValue("CHF");
    expect(screen.getByText(/Montag/)).toBeInTheDocument();
  });

  it("makes a dismissed first-run guide available again", async () => {
    const repository = createSettingsRepository(database);
    await repository.save({
      onboardingDismissedAt: "2026-08-11T20:30:00.000Z",
    });
    const user = userEvent.setup();
    renderPanel(repository);

    await user.click(
      await screen.findByRole("button", {
        name: "Ersteinrichtung erneut anzeigen",
      }),
    );

    expect(
      await screen.findByText(
        "Die Ersteinrichtung wird auf „Heute“ wieder angezeigt.",
      ),
    ).toBeInTheDocument();
    expect(
      (await repository.loadOrCreate()).onboardingDismissedAt,
    ).toBeUndefined();
  });

  it("stores a changed base currency", async () => {
    const repository = createSettingsRepository(database);
    await repository.loadOrCreate();
    const user = userEvent.setup();
    renderPanel(repository);

    await user.selectOptions(
      await screen.findByLabelText("Übersichtswährung"),
      "CHF",
    );

    expect(
      await screen.findByText("Die Übersichtswährung wurde gespeichert."),
    ).toBeInTheDocument();
    expect((await repository.loadOrCreate()).baseCurrency).toBe("CHF");
  });

  it("stores a changed time zone", async () => {
    const repository = createSettingsRepository(database);
    await repository.loadOrCreate();
    const user = userEvent.setup();
    renderPanel(repository);

    await user.selectOptions(
      await screen.findByLabelText("Zeitzone"),
      "Pacific/Auckland",
    );

    expect(
      await screen.findByText("Die Zeitzone wurde gespeichert."),
    ).toBeInTheDocument();
    expect((await repository.loadOrCreate()).timeZone).toBe("Pacific/Auckland");
  });

  it("names a failed change and keeps the stored value", async () => {
    const repository = createSettingsRepository(database);
    await repository.save({ baseCurrency: "EUR" });
    const failingRepository: SettingsRepository = Object.assign(
      Object.create(repository) as SettingsRepository,
      {
        save: () => Promise.reject(new Error("storage unavailable")),
      },
    );
    const user = userEvent.setup();
    renderPanel(failingRepository);

    await user.selectOptions(
      await screen.findByLabelText("Übersichtswährung"),
      "CHF",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die Einstellung wurde nicht gespeichert.",
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Übersichtswährung")).toHaveValue("EUR");
    });
  });

  it("starts without a daily budget and stores one that is entered", async () => {
    const repository = createSettingsRepository(database);
    const user = userEvent.setup();
    renderPanel(repository);

    const field = await screen.findByLabelText("Tagesbudget in Minuten");
    expect(field).toHaveValue(null);

    await user.type(field, "240");
    await user.tab();

    expect(
      await screen.findByText("Das Tagesbudget wurde gespeichert."),
    ).toBeInTheDocument();
    await waitFor(async () => {
      expect((await repository.loadOrCreate()).dailyCapacityMinutes).toBe(240);
    });
  });

  // Ein leeres Feld heißt „kein Budget", nicht „null Minuten".
  it("removes the budget when the field is cleared", async () => {
    const repository = createSettingsRepository(database);
    await repository.save({ dailyCapacityMinutes: 180 });
    const user = userEvent.setup();
    renderPanel(repository);

    // Das Feld wird neu gemountet, sobald der gespeicherte Wert eintrifft —
    // deshalb jedes Mal neu abfragen statt eine Referenz festzuhalten.
    await waitFor(() =>
      expect(screen.getByLabelText("Tagesbudget in Minuten")).toHaveValue(180),
    );

    await user.clear(screen.getByLabelText("Tagesbudget in Minuten"));
    await user.tab();

    expect(
      await screen.findByText("Das Tagesbudget wurde entfernt."),
    ).toBeInTheDocument();
    await waitFor(async () => {
      expect(
        (await repository.loadOrCreate()).dailyCapacityMinutes,
      ).toBeUndefined();
    });
  });

  it("explains a value outside the allowed range instead of storing it", async () => {
    const repository = createSettingsRepository(database);
    const user = userEvent.setup();
    renderPanel(repository);

    const field = await screen.findByLabelText("Tagesbudget in Minuten");
    await user.type(field, "1500");
    await user.tab();

    expect(
      await screen.findByText(
        "Gib eine ganze Zahl zwischen 1 und 1440 Minuten ein, oder lass das Feld leer.",
      ),
    ).toBeInTheDocument();
    expect(
      (await repository.loadOrCreate()).dailyCapacityMinutes,
    ).toBeUndefined();
  });
});
