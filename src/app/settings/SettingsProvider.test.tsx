import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import {
  createSettingsRepository,
  type SettingsRepository,
} from "../../db/settings/repository";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { ThemeProvider } from "../theme/ThemeProvider";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";
import {
  clearThemePreference,
  persistThemePreference,
  readThemePreference,
} from "../theme/theme-preference";
import { SettingsProvider } from "./SettingsProvider";
import { useBaseCurrency, useTimeZone } from "./settings-context";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  clearThemePreference();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(async () => {
  await deleteTestDatabase(database);
  clearThemePreference();
});

function StoredValues() {
  return (
    <dl>
      <dt>Zeitzone</dt>
      <dd>{useTimeZone()}</dd>
      <dt>Währung</dt>
      <dd>{useBaseCurrency()}</dd>
    </dl>
  );
}

function renderWithProviders(children: React.ReactNode) {
  return render(
    <ThemeProvider>
      <SettingsProvider repository={createSettingsRepository(database)}>
        {children}
      </SettingsProvider>
    </ThemeProvider>,
  );
}

describe("SettingsProvider", () => {
  it("provides the stored time zone and base currency", async () => {
    await createSettingsRepository(database).save({
      baseCurrency: "CHF",
      timeZone: "Europe/Zurich",
    });

    renderWithProviders(<StoredValues />);

    expect(await screen.findByText("Europe/Zurich")).toBeInTheDocument();
    expect(screen.getByText("CHF")).toBeInTheDocument();
  });

  it("restores the stored theme when the local mirror is gone", async () => {
    await createSettingsRepository(database).save({ theme: "dark" });

    renderWithProviders(<ThemeSwitcher />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(readThemePreference()).toBe("dark");
    expect(await screen.findByLabelText("Farbschema")).toHaveValue("dark");
  });

  it("stores a theme change in the settings record", async () => {
    const repository = createSettingsRepository(database);
    await repository.loadOrCreate();
    const user = userEvent.setup();
    renderWithProviders(<ThemeSwitcher />);

    await user.selectOptions(
      await screen.findByLabelText("Farbschema"),
      "light",
    );

    await waitFor(async () => {
      expect((await repository.loadOrCreate()).theme).toBe("light");
    });
    expect(readThemePreference()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  /*
   * Der erste Lesevorgang kann langsam sein. Wer in dieser Zeit umschaltet,
   * hat den neueren Stand; das eintreffende Leseergebnis darf ihn nicht
   * zurückdrehen.
   */
  it("keeps a theme change made while the record is still loading", async () => {
    const repository = createSettingsRepository(database);
    // Der Stand von vor der Änderung; genau er trifft verspätet ein.
    const stale = await repository.loadOrCreate();
    let releaseLoad = () => undefined as void;
    const slowRepository: SettingsRepository = Object.assign(
      Object.create(repository) as SettingsRepository,
      {
        loadOrCreate: async () => {
          await new Promise<void>((resolve) => {
            releaseLoad = resolve;
          });
          return stale;
        },
      },
    );
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <SettingsProvider repository={slowRepository}>
          <ThemeSwitcher />
        </SettingsProvider>
      </ThemeProvider>,
    );

    await user.selectOptions(screen.getByLabelText("Farbschema"), "dark");
    releaseLoad();

    await waitFor(async () => {
      expect((await repository.loadOrCreate()).theme).toBe("dark");
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByLabelText("Farbschema")).toHaveValue("dark");
  });

  it("keeps the mirrored theme until the stored record is read", async () => {
    persistThemePreference("dark");
    await createSettingsRepository(database).save({ theme: "dark" });

    renderWithProviders(<ThemeSwitcher />);

    // Kein Zwischenzustand: Der Spiegel gilt vom ersten Bild an.
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(await screen.findByLabelText("Farbschema")).toHaveValue("dark");
  });
});
