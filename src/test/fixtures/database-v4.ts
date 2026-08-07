import Dexie from "dexie";

import { personalOsSchemaV4 } from "../../db/schema";
import { buildEntityMeta, buildMoney } from "../factories/entity";

const goalId = "00000000-0000-4000-8000-000000009501";

/** Ein Beitrag aus der Zeit vor der Verknüpfung: ohne `sourceTransactionId`. */
export const savingsContributionV4Fixture = {
  ...buildEntityMeta({ id: "00000000-0000-4000-8000-000000009502" }),
  savingsGoalId: goalId,
  money: buildMoney({ amountMinor: 5_000 }),
  bookedOn: "2026-08-05",
} as const;

export const savingsGoalV4Fixture = {
  ...buildEntityMeta({ id: goalId }),
  name: "Synthetisches Sparziel",
  target: buildMoney({ amountMinor: 100_000 }),
  status: "active",
} as const;

export const transactionV4Fixture = {
  ...buildEntityMeta({ id: "00000000-0000-4000-8000-000000009503" }),
  kind: "expense",
  money: buildMoney({ amountMinor: 5_000 }),
  categoryId: "00000000-0000-4000-8000-000000009504",
  bookedOn: "2026-08-05",
} as const;

export async function createVersion4Database(name: string): Promise<void> {
  const database = new Dexie(name);
  database.version(4).stores(personalOsSchemaV4);
  await database.open();
  await database.table("savingsGoals").add(savingsGoalV4Fixture);
  await database
    .table("savingsContributions")
    .add(savingsContributionV4Fixture);
  await database.table("transactions").add(transactionV4Fixture);
  database.close();
}
