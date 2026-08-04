import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import {
  createVersion1Database,
  incompatibleSettingsV1Fixture,
} from "../test/fixtures/database-v1";
import { PersonalOsDatabase } from "./database";
import { createDatabaseLifecycle, DatabaseStartupError } from "./lifecycle";

const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(
    databaseNames.splice(0).map((databaseName) => Dexie.delete(databaseName)),
  );
});

describe("database lifecycle", () => {
  it("shares one pending open operation across repeated startup calls", async () => {
    const name = createDatabaseName();
    const database = new PersonalOsDatabase(name);
    const lifecycle = createDatabaseLifecycle(database);

    const firstOpen = lifecycle.open();
    const secondOpen = lifecycle.open();

    expect(firstOpen).toBe(secondOpen);
    await firstOpen;
    expect(database.isOpen()).toBe(true);
    database.close();
  });

  it("reports an upgrade failure instead of a ready database", async () => {
    const name = createDatabaseName();
    await createVersion1Database(name, incompatibleSettingsV1Fixture);
    const database = new PersonalOsDatabase(name);

    await expect(
      createDatabaseLifecycle(database).open(),
    ).rejects.toBeInstanceOf(DatabaseStartupError);
    expect(database.isOpen()).toBe(false);
  });

  it("deletes local data only through the explicit reset operation", async () => {
    const name = createDatabaseName();
    const database = new PersonalOsDatabase(name);
    const lifecycle = createDatabaseLifecycle(database);
    await lifecycle.open();
    await database.table("tasks").add({ id: "synthetic-record" });

    await lifecycle.reset();

    expect(await Dexie.exists(name)).toBe(false);
  });
});

function createDatabaseName(): string {
  const name = `personalos-lifecycle-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return name;
}
