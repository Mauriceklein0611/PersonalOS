import { personalOsDatabase, type PersonalOsDatabase } from "./database";
import { toPersistenceError } from "./errors";
import { seedSettingsRecord } from "./settings/repository";

export class DatabaseStartupError extends Error {
  constructor(options?: ErrorOptions) {
    super("Die lokale Datenbank konnte nicht vorbereitet werden.", options);
    this.name = "DatabaseStartupError";
  }
}

export interface DatabaseLifecycle {
  open(): Promise<void>;
  reset(): Promise<void>;
}

/** Läuft nach jedem erfolgreichen Öffnen und muss idempotent sein. */
export type DatabaseSeed = (database: PersonalOsDatabase) => Promise<void>;

export function createDatabaseLifecycle(
  database: PersonalOsDatabase,
  seed: DatabaseSeed = seedSettingsRecord,
): DatabaseLifecycle {
  let pendingOpen: Promise<void> | undefined;
  /*
   * `isOpen()` allein genügt nicht: Nach einem fehlgeschlagenen Seed ist die
   * Datenbank offen, aber nicht vorbereitet. Ein erneuter Versuch muss den
   * Seed dann wiederholen statt sofort „fertig" zu melden.
   */
  let isPrepared = false;

  return {
    open() {
      if (isPrepared && database.isOpen()) {
        return Promise.resolve();
      }

      pendingOpen ??= database
        .open()
        .then(() => seed(database))
        .then(() => {
          isPrepared = true;
        })
        .catch((error: unknown) => {
          throw new DatabaseStartupError({ cause: error });
        })
        .finally(() => {
          pendingOpen = undefined;
        });

      return pendingOpen;
    },
    async reset() {
      try {
        pendingOpen = undefined;
        isPrepared = false;
        database.close();
        await database.delete();
      } catch (error) {
        throw toPersistenceError(error, "storage");
      }
    },
  };
}

export const personalOsDatabaseLifecycle =
  createDatabaseLifecycle(personalOsDatabase);
