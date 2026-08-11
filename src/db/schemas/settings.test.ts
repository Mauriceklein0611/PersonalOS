import { describe, expect, it } from "vitest";

import { buildEntityMeta } from "../../test/factories/entity";
import {
  createDefaultSettingsDetails,
  settingsSchema,
  toSettingsDetails,
  type Settings,
} from "./settings";

function buildSettings(overrides: Partial<Settings> = {}): unknown {
  return {
    ...buildEntityMeta({ id: "00000000-0000-4000-8000-000000005001" }),
    baseCurrency: "EUR",
    locale: "de-DE",
    theme: "system",
    timeZone: "Europe/Berlin",
    weekStartsOn: 1,
    ...overrides,
  };
}

describe("settings schema — dailyCapacityMinutes", () => {
  /**
   * Der Kern der Rückwärtskompatibilität: Jeder vor der Einführung des Feldes
   * geschriebene Datensatz muss ohne Migration gültig bleiben. Deshalb ist das
   * Feld optional und trägt keine Vorgabe.
   */
  it("accepts a record written before the field existed", () => {
    const parsed = settingsSchema.parse(buildSettings());

    expect(parsed.dailyCapacityMinutes).toBeUndefined();
    expect(toSettingsDetails(parsed).dailyCapacityMinutes).toBeUndefined();
  });

  it("keeps a stored budget through the round trip to details and back", () => {
    const parsed = settingsSchema.parse(
      buildSettings({ dailyCapacityMinutes: 240 }),
    );

    expect(parsed.dailyCapacityMinutes).toBe(240);
    expect(toSettingsDetails(parsed).dailyCapacityMinutes).toBe(240);
  });

  // Kein Budget ist ein eigener Zustand, nicht „null Minuten".
  it("refuses zero instead of reading it as no budget", () => {
    expect(
      settingsSchema.safeParse(buildSettings({ dailyCapacityMinutes: 0 }))
        .success,
    ).toBe(false);
  });

  it("refuses more minutes than a day has and refuses fractions", () => {
    for (const value of [1_441, 90.5, -30]) {
      expect(
        settingsSchema.safeParse(buildSettings({ dailyCapacityMinutes: value }))
          .success,
      ).toBe(false);
    }
    expect(
      settingsSchema.safeParse(buildSettings({ dailyCapacityMinutes: 1_440 }))
        .success,
    ).toBe(true);
  });

  // Ein erfundenes Budget wäre eine Aussage über den Nutzer, die er nie
  // getroffen hat — der Erststart setzt deshalb keines.
  it("seeds no budget on a fresh install", () => {
    expect(
      createDefaultSettingsDetails("Europe/Berlin").dailyCapacityMinutes,
    ).toBeUndefined();
  });
});

describe("settings schema — onboarding", () => {
  it("keeps records from before onboarding valid", () => {
    const parsed = settingsSchema.parse(buildSettings());

    expect(parsed.onboardingDismissedAt).toBeUndefined();
    expect(toSettingsDetails(parsed).onboardingDismissedAt).toBeUndefined();
  });

  it("keeps a valid local dismissal instant through the settings round trip", () => {
    const parsed = settingsSchema.parse(
      buildSettings({ onboardingDismissedAt: "2026-08-11T20:30:00.000Z" }),
    );

    expect(toSettingsDetails(parsed).onboardingDismissedAt).toBe(
      "2026-08-11T20:30:00.000Z",
    );
  });

  it("rejects a calendar day without an exact instant", () => {
    expect(
      settingsSchema.safeParse(
        buildSettings({ onboardingDismissedAt: "2026-08-11" }),
      ).success,
    ).toBe(false);
  });
});
