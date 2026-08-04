import type { PersonalOsDatabase } from "./database";
import { toPersistenceError } from "./errors";
import type { PersonalOsTableName } from "./schema";

export type TransactionTableNames = readonly [
  PersonalOsTableName,
  ...PersonalOsTableName[],
];

export async function runInTransaction<TResult>(
  database: PersonalOsDatabase,
  tableNames: TransactionTableNames,
  operation: () => TResult | PromiseLike<TResult>,
): Promise<TResult> {
  try {
    const tables = tableNames.map((tableName) => database.table(tableName));
    return await database.transaction("rw", tables, operation);
  } catch (error) {
    throw toPersistenceError(error, "transaction");
  }
}
