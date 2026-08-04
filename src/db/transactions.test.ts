import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, deleteTestDatabase } from "../test/database";
import type { PersonalOsDatabase } from "./database";
import { DexieRepository } from "./repositories/dexie-repository";
import { runInTransaction } from "./transactions";
import { entityMetaSchema } from "./types";

const createSchema = z.object({ title: z.string().min(1) }).strict();
const entitySchema = entityMetaSchema.safeExtend({ title: z.string().min(1) });
const ids = [
  "00000000-0000-4000-8000-000000000021",
  "00000000-0000-4000-8000-000000000022",
] as const;

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("runInTransaction", () => {
  it("rolls back every write when an operation fails", async () => {
    let idIndex = 0;
    const repository = new DexieRepository({
      clock: { now: () => new Date("2026-01-15T09:30:00.000Z") },
      createEntity: (input, metadata) => ({ ...metadata, ...input }),
      createSchema,
      database,
      entitySchema,
      idGenerator: () => ids[idIndex++] ?? ids[1],
      tableName: "tasks",
    });

    await expect(
      runInTransaction(database, ["tasks"], async () => {
        await repository.create({ title: "Erster synthetischer Eintrag" });
        await repository.create({ title: "Zweiter synthetischer Eintrag" });
        throw new Error("Simulierter Transaktionsfehler");
      }),
    ).rejects.toMatchObject({ code: "transaction" });

    expect(await database.table("tasks").count()).toBe(0);
  });

  it("commits all writes only after a successful operation", async () => {
    let idIndex = 0;
    const repository = new DexieRepository({
      clock: { now: () => new Date("2026-01-15T09:30:00.000Z") },
      createEntity: (input, metadata) => ({ ...metadata, ...input }),
      createSchema,
      database,
      entitySchema,
      idGenerator: () => ids[idIndex++] ?? ids[1],
      tableName: "tasks",
    });

    const count = await runInTransaction(database, ["tasks"], async () => {
      await repository.create({ title: "Erster synthetischer Eintrag" });
      await repository.create({ title: "Zweiter synthetischer Eintrag" });
      return database.table("tasks").count();
    });

    expect(count).toBe(2);
    expect(await database.table("tasks").count()).toBe(2);
  });
});
