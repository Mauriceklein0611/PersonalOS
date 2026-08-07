import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import type { PersonalOsDatabase } from "../database";
import { createSettingsRepository } from "./repository";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("settings repository", () => {
  it("creates one record with the documented defaults", async () => {
    const repository = createSettingsRepository(database);

    const settings = await repository.loadOrCreate();

    expect(settings.locale).toBe("de-DE");
    expect(settings.theme).toBe("system");
    expect(settings.baseCurrency).toBe("EUR");
    expect(settings.weekStartsOn).toBe(1);
    expect(settings.timeZone.length).toBeGreaterThan(0);
    expect(await database.table("settings").count()).toBe(1);
  });

  it("returns the existing record instead of creating a second one", async () => {
    const repository = createSettingsRepository(database);
    const first = await repository.loadOrCreate();

    const [second, third] = await Promise.all([
      repository.loadOrCreate(),
      repository.loadOrCreate(),
    ]);

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(await database.table("settings").count()).toBe(1);
  });

  it("keeps a single record even when the existing one is archived", async () => {
    const repository = createSettingsRepository(database);
    const first = await repository.loadOrCreate();
    await repository.archive(first.id);

    const loaded = await repository.loadOrCreate();

    expect(loaded.id).toBe(first.id);
    expect(await database.table("settings").count()).toBe(1);
  });

  it("saves a change on the existing record", async () => {
    const repository = createSettingsRepository(database);
    await repository.loadOrCreate();

    const saved = await repository.save({
      baseCurrency: "CHF",
      theme: "dark",
      timeZone: "Europe/Zurich",
    });

    expect(saved.baseCurrency).toBe("CHF");
    expect(saved.theme).toBe("dark");
    expect(saved.timeZone).toBe("Europe/Zurich");
    expect(await database.table("settings").count()).toBe(1);
  });

  it("creates the record when a change arrives before the first read", async () => {
    const repository = createSettingsRepository(database);

    const saved = await repository.save({ theme: "light" });

    expect(saved.theme).toBe("light");
    expect(saved.baseCurrency).toBe("EUR");
    expect(await database.table("settings").count()).toBe(1);
  });

  it("rejects a value the schema does not allow", async () => {
    const repository = createSettingsRepository(database);
    await repository.loadOrCreate();

    await expect(
      repository.save({ baseCurrency: "not-a-currency" }),
    ).rejects.toThrow();
    expect((await repository.loadOrCreate()).baseCurrency).toBe("EUR");
  });
});
