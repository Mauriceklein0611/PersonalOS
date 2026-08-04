import { z } from "zod";

const supportedCurrencyCodes = new Set(Intl.supportedValuesOf("currency"));

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine((currency) => supportedCurrencyCodes.has(currency));

export const moneySchema = z
  .object({
    amountMinor: z.int().nonnegative(),
    currency: currencyCodeSchema,
  })
  .strict();

export type Money = z.infer<typeof moneySchema>;

export function createMoney(amountMinor: number, currency: string): Money {
  return moneySchema.parse({ amountMinor, currency });
}

export function addMoney(left: Money, right: Money): Money {
  const validLeft = moneySchema.parse(left);
  const validRight = moneySchema.parse(right);

  if (validLeft.currency !== validRight.currency) {
    throw new RangeError("Currencies must match before adding money values.");
  }

  return createMoney(
    validLeft.amountMinor + validRight.amountMinor,
    validLeft.currency,
  );
}
