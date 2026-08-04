import { PersonalOsDatabase } from "../db/database";

export async function createTestDatabase(): Promise<PersonalOsDatabase> {
  const database = new PersonalOsDatabase(
    `personalos-test-${globalThis.crypto.randomUUID()}`,
  );
  await database.open();
  return database;
}

export async function deleteTestDatabase(
  database: PersonalOsDatabase,
): Promise<void> {
  database.close();
  await database.delete();
}
