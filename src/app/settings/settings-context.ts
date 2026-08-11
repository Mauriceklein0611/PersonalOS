import { createContext, useContext } from "react";

import type { SettingsDetails } from "../../db/schemas/settings";
import type { WeekStartsOn } from "../../lib/dates/calendar-days";
import { detectTimeZone } from "../../lib/dates/date-values";

export type AppSettingsContextValue = {
  /**
   * Die fachlichen Werte des einen Settings-Datensatzes. Die Metadaten des
   * Datensatzes bleiben in der Datenschicht.
   */
  settings: SettingsDetails;
  /**
   * `false`, solange die Oberfläche mit erkannten Vorgaben arbeitet, weil der
   * Datensatz noch geladen wird oder nicht gelesen werden konnte.
   */
  isStored: boolean;
  /** Liest den Datensatz neu, etwa nach einem Import. */
  reload: () => Promise<void>;
  update: (patch: Partial<SettingsDetails>) => Promise<void>;
};

export const AppSettingsContext = createContext<AppSettingsContextValue | null>(
  null,
);

export function useAppSettings(): AppSettingsContextValue {
  const value = useContext(AppSettingsContext);

  if (value === null) {
    throw new Error(
      "useAppSettings muss innerhalb des SettingsProvider verwendet werden.",
    );
  }

  return value;
}

/**
 * Die gespeicherte Zeitzone. Ein ausdrücklich übergebener Wert gewinnt, damit
 * Tests und Vorschauen einen festen Tag setzen können. Ohne Provider bleibt
 * die erkannte Zeitzone die Notlösung.
 */
export function useTimeZone(override?: string): string {
  const value = useContext(AppSettingsContext);
  return override ?? value?.settings.timeZone ?? detectTimeZone();
}

/**
 * Der erste Wochentag aus den Einstellungen. Das Schema kennt bisher nur den
 * Montag; Ansichten fragen den Wert trotzdem hier ab, statt ihn fest zu
 * verdrahten. Siehe `weekStartsOn` in `src/db/schemas/settings.ts`.
 */
export function useWeekStartsOn(override?: WeekStartsOn): WeekStartsOn {
  const value = useContext(AppSettingsContext);
  return override ?? value?.settings.weekStartsOn ?? 1;
}

/** Die Übersichtswährung aus den Einstellungen. */
export function useBaseCurrency(override?: string): string {
  const value = useContext(AppSettingsContext);
  return override ?? value?.settings.baseCurrency ?? "EUR";
}

/**
 * Das freiwillige Tagesbudget in Minuten. `undefined` heißt, dass keines
 * gesetzt ist — es gibt bewusst keine Vorgabe, weil ein erfundenes Budget
 * eine Aussage über den Nutzer wäre, die er nie getroffen hat.
 */
export function useDailyCapacityMinutes(override?: number): number | undefined {
  const value = useContext(AppSettingsContext);
  return override ?? value?.settings.dailyCapacityMinutes;
}
