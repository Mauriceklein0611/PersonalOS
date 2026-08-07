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

  it("seeds exactly one settings record on the first start", async () => {
    const name = createDatabaseName();
    const database = new PersonalOsDatabase(name);
    const lifecycle = createDatabaseLifecycle(database);

    await lifecycle.open();

    const [settings] = await database.table("settings").toArray();
    expect(await database.table("settings").count()).toBe(1);
    expect(settings).toMatchObject({
      baseCurrency: "EUR",
      locale: "de-DE",
      theme: "system",
      weekStartsOn: 1,
    });
    expect(typeof settings.timeZone).toBe("string");
    database.close();
  });

  it("does not create a second settings record on a repeated start", async () => {
    const name = createDatabaseName();
    const first = new PersonalOsDatabase(name);
    await createDatabaseLifecycle(first).open();
    const seededId = (await first.table("settings").toArray())[0].id;
    first.close();

    const second = new PersonalOsDatabase(name);
    const lifecycle = createDatabaseLifecycle(second);
    await lifecycle.open();
    await lifecycle.open();

    expect(await second.table("settings").count()).toBe(1);
    expect((await second.table("settings").toArray())[0].id).toBe(seededId);
    second.close();
  });

  it("reports a failed seed and repeats it on the next attempt", async () => {
    const name = createDatabaseName();
    const database = new PersonalOsDatabase(name);
    let attempts = 0;
    const lifecycle = createDatabaseLifecycle(database, async (target) => {
      attempts += 1;
      if (attempts === 1) throw new Error("seed failed");
      await target.table("settings").add({
        id: crypto.randomUUID(),
        createdAt: "2026-08-07T08:00:00.000Z",
        updatedAt: "2026-08-07T08:00:00.000Z",
        locale: "de-DE",
        timeZone: "Europe/Berlin",
        theme: "system",
        baseCurrency: "EUR",
        weekStartsOn: 1,
      });
    });

    await expect(lifecycle.open()).rejects.toBeInstanceOf(DatabaseStartupError);
    await lifecycle.open();

    expect(attempts).toBe(2);
    expect(await database.table("settings").count()).toBe(1);
    database.close();
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
