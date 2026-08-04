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

export function sumMoney(values: readonly Money[], currency: string): Money {
  return values.reduce(
    (total, value) => addMoney(total, value),
    createMoney(0, currency),
  );
}

export function subtractMoney(left: Money, right: Money): number {
  const validLeft = moneySchema.parse(left);
  const validRight = moneySchema.parse(right);

  if (validLeft.currency !== validRight.currency) {
    throw new RangeError("Currencies must match before comparing money.");
  }

  return validLeft.amountMinor - validRight.amountMinor;
}

/** Nachkommastellen der Währung, damit Minor Units nicht geraten werden. */
export function getCurrencyExponent(currency: string): number {
  const validCurrency = currencyCodeSchema.parse(currency);
  const { maximumFractionDigits } = new Intl.NumberFormat("de-DE", {
    currency: validCurrency,
    style: "currency",
  }).resolvedOptions();

  // Ohne aufgelöste Angabe bleibt die verbreitete Zwei-Stellen-Annahme.
  return maximumFractionDigits ?? 2;
}

export type MoneyParseFailure = "empty" | "format" | "precision";

export type MoneyParseResult =
  { ok: true; money: Money } | { ok: false; reason: MoneyParseFailure };

/**
 * Liest eine deutsche Betragseingabe als Minor Units. Der Umweg über
 * Ziffernketten vermeidet Float-Rundungsfehler wie 0.1 + 0.2.
 */
export function parseMoneyInput(
  input: string,
  currency: string,
): MoneyParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const normalized = trimmed.replace(/[\s.](?=\d{3}\b)/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, reason: "format" };
  }

  const exponent = getCurrencyExponent(currency);
  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > exponent) {
    return { ok: false, reason: "precision" };
  }

  const minor = `${whole}${fraction.padEnd(exponent, "0")}`;
  const amountMinor = Number.parseInt(minor, 10);
  if (!Number.isSafeInteger(amountMinor)) {
    return { ok: false, reason: "format" };
  }

  return { money: createMoney(amountMinor, currency), ok: true };
}

export function formatMoney(money: Money): string {
  const valid = moneySchema.parse(money);
  const exponent = getCurrencyExponent(valid.currency);
  return new Intl.NumberFormat("de-DE", {
    currency: valid.currency,
    style: "currency",
  }).format(valid.amountMinor / 10 ** exponent);
}

/** Vorzeichenbehaftete Darstellung für Summen aus Einnahmen und Ausgaben. */
export function formatSignedMinorUnits(
  amountMinor: number,
  currency: string,
): string {
  const absolute = formatMoney(createMoney(Math.abs(amountMinor), currency));
  if (amountMinor > 0) return `+${absolute}`;
  if (amountMinor < 0) return `−${absolute}`;
  return absolute;
}
