import type { EntityMeta } from "../../db/types";
import type { Money } from "../../lib/money/money";

const syntheticId = "00000000-0000-4000-8000-000000000001";
const syntheticInstant = "2026-01-15T09:30:00.000Z";

export function buildEntityMeta(
  overrides: Partial<EntityMeta> = {},
): EntityMeta {
  return {
    id: syntheticId,
    createdAt: syntheticInstant,
    updatedAt: syntheticInstant,
    ...overrides,
  };
}

export function buildMoney(overrides: Partial<Money> = {}): Money {
  return {
    amountMinor: 1_250,
    currency: "EUR",
    ...overrides,
  };
}
