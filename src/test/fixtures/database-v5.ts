import Dexie from "dexie";

import { personalOsSchemaV5 } from "../../db/schema";
import { buildEntityMeta, buildMoney } from "../factories/entity";

/**
 * Eine Buchung aus der Zeit vor den Vorlagen: ohne `recurringTransactionId`.
 * Ihr Fehlen heißt „von Hand erfasst"; sie muss den Aufstieg auf Version 6
 * unverändert überstehen. Siehe
 * [ADR 0013](../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
 */
export const transactionV5Fixture = {
  ...buildEntityMeta({ id: "00000000-0000-4000-8000-000000009601" }),
  kind: "expense",
  money: buildMoney({ amountMinor: 95_000 }),
  categoryId: "00000000-0000-4000-8000-000000009602",
  bookedOn: "2026-08-01",
} as const;

export async function createVersion5Database(name: string): Promise<void> {
  const database = new Dexie(name);
  database.version(5).stores(personalOsSchemaV5);
  await database.open();
  await database.table("transactions").add(transactionV5Fixture);
  database.close();
}
