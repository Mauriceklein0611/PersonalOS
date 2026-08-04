import { personalOsDatabase, type PersonalOsDatabase } from "./database";
import { toPersistenceError } from "./errors";

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

export function createDatabaseLifecycle(
  database: PersonalOsDatabase,
): DatabaseLifecycle {
  let pendingOpen: Promise<void> | undefined;

  return {
    open() {
      if (database.isOpen()) {
        return Promise.resolve();
      }

      pendingOpen ??= database
        .open()
        .then(() => undefined)
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
