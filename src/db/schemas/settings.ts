import { z } from "zod";

import { timeZoneSchema } from "../../lib/dates/date-values";
import { currencyCodeSchema } from "../../lib/money/money";
import { entityMetaSchema } from "../types";

const settingsFields = {
  locale: z.literal("de-DE"),
  timeZone: timeZoneSchema,
  theme: z.enum(["system", "light", "dark"]),
  baseCurrency: currencyCodeSchema,
} as const;

export const settingsV1Schema = entityMetaSchema.safeExtend({
  ...settingsFields,
  weekStartsOn: z.literal(1).optional(),
});

export const settingsSchema = entityMetaSchema.safeExtend({
  ...settingsFields,
  weekStartsOn: z.literal(1),
});

export type Settings = z.infer<typeof settingsSchema>;
