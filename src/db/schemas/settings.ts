import { z } from "zod";

import {
  detectTimeZone,
  isoInstantSchema,
  timeZoneSchema,
} from "../../lib/dates/date-values";
import { currencyCodeSchema } from "../../lib/money/money";
import { entityMetaSchema } from "../types";

const settingsFields = {
  locale: z.literal("de-DE"),
  timeZone: timeZoneSchema,
  theme: z.enum(["system", "light", "dark"]),
  baseCurrency: currencyCodeSchema,
  /**
   * Freiwilliges Tagesbudget in Minuten. Fehlt der Wert, gibt es kein Budget
   * — nicht „null Minuten". Deshalb optional und nicht mit einer Vorgabe
   * belegt: Ein erfundenes Budget wäre eine Aussage über den Nutzer, die er
   * nie getroffen hat. Ein Tag hat 1440 Minuten; darüber wäre die Zahl keine
   * Planungshilfe mehr.
   */
  dailyCapacityMinutes: z.int().positive().max(1_440).optional(),
  /**
   * Nur die Entscheidung, die First-Run-Karte auszublenden. Der Fortschritt
   * selbst wird aus vorhandenen Fachdatensätzen abgeleitet und nicht kopiert.
   */
  onboardingDismissedAt: isoInstantSchema.optional(),
} as const;

export const settingsV1Schema = entityMetaSchema.safeExtend({
  ...settingsFields,
  weekStartsOn: z.literal(1).optional(),
});

export const settingsSchema = entityMetaSchema.safeExtend({
  ...settingsFields,
  weekStartsOn: z.literal(1),
});

export const settingsDetailsSchema = z
  .object({
    ...settingsFields,
    weekStartsOn: z.literal(1),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsDetails = z.infer<typeof settingsDetailsSchema>;

/** Die fachlichen Werte ohne die Metadaten des Datensatzes. */
export function toSettingsDetails(settings: Settings): SettingsDetails {
  return {
    baseCurrency: settings.baseCurrency,
    dailyCapacityMinutes: settings.dailyCapacityMinutes,
    locale: settings.locale,
    onboardingDismissedAt: settings.onboardingDismissedAt,
    theme: settings.theme,
    timeZone: settings.timeZone,
    weekStartsOn: settings.weekStartsOn,
  };
}

/**
 * Die Werte des Erststarts. Die Zeitzone ist der einzige erkannte Wert; alle
 * übrigen Vorgaben sind fest und damit erklärbar.
 */
export function createDefaultSettingsDetails(
  timeZone: string = detectTimeZone(),
): SettingsDetails {
  return settingsDetailsSchema.parse({
    baseCurrency: "EUR",
    locale: "de-DE",
    theme: "system",
    timeZone,
    weekStartsOn: 1,
  });
}
