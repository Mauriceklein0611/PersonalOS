import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Clock } from "../../lib/dates/date-values";
import type { IdGenerator } from "../../lib/identifiers/entity-id";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import type { PersonalOsDatabase } from "../database";
import { PersistenceError } from "../errors";
import { entityMetaSchema, type EntityMeta } from "../types";
import { DexieRepository } from "./dexie-repository";

const createSchema = z.object({ title: z.string().min(1).max(100) }).strict();
const testEntitySchema = entityMetaSchema.safeExtend({
  title: z.string().min(1).max(100),
});

type TestCreate = z.infer<typeof createSchema>;
type TestEntity = z.infer<typeof testEntitySchema>;

const idOne = "00000000-0000-4000-8000-000000000011";
const idTwo = "00000000-0000-4000-8000-000000000012";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("DexieRepository", () => {
  it("creates, reads, lists and updates validated entities", async () => {
    const repository = createRepository({
      clock: sequenceClock(
        "2026-01-15T09:30:00.000Z",
        "2026-01-15T10:00:00.000Z",
      ),
      idGenerator: () => idOne,
    });

    const created = await repository.create({ title: "Synthetischer Eintrag" });
    const updated = await repository.update(created.id, {
      title: "Aktualisierter Eintrag",
    });

    expect(await repository.get(idOne)).toEqual(updated);
    expect(await repository.list()).toEqual([updated]);
    expect(updated).toMatchObject({
      id: idOne,
      createdAt: "2026-01-15T09:30:00.000Z",
      updatedAt: "2026-01-15T10:00:00.000Z",
      title: "Aktualisierter Eintrag",
    });
  });

  it("archives, restores and explicitly hard-deletes records", async () => {
    const repository = createRepository({
      clock: sequenceClock(
        "2026-01-15T09:30:00.000Z",
        "2026-01-15T10:00:00.000Z",
        "2026-01-15T10:30:00.000Z",
      ),
      idGenerator: () => idOne,
    });
    await repository.create({ title: "Archivbeispiel" });

    const archived = await repository.archive(idOne);
    expect(archived.archivedAt).toBe("2026-01-15T10:00:00.000Z");
    expect(await repository.list()).toEqual([]);
    expect(await repository.list({ includeArchived: true })).toEqual([
      archived,
    ]);

    const restored = await repository.restore(idOne);
    expect(restored.archivedAt).toBeUndefined();
    expect(await repository.list()).toEqual([restored]);

    await repository.deletePermanently(idOne);
    expect(await repository.get(idOne)).toBeUndefined();
  });

  it("returns typed errors without exposing rejected record contents", async () => {
    const repository = createRepository({ idGenerator: () => idOne });

    const validationError = await repository
      .create({ title: "" })
      .catch((error: unknown) => error);
    expect(validationError).toBeInstanceOf(PersistenceError);
    expect(validationError).toMatchObject({ code: "validation" });
    expect((validationError as Error).message).not.toContain("title");

    await repository.create({ title: "Erster Eintrag" });
    const conflictError = await repository
      .create({ title: "Zweiter Eintrag" })
      .catch((error: unknown) => error);
    expect(conflictError).toMatchObject({ code: "conflict" });

    await expect(repository.require(idTwo)).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(repository.get("task-1")).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("validates records read directly from IndexedDB", async () => {
    const repository = createRepository({ idGenerator: () => idOne });
    await database.table("tasks").add({
      id: idOne,
      createdAt: "not-a-timestamp",
      updatedAt: "not-a-timestamp",
      title: "Ungültiger Testdatensatz",
    });

    await expect(repository.get(idOne)).rejects.toMatchObject({
      code: "validation",
    });
  });
});

function createRepository({
  clock = sequenceClock("2026-01-15T09:30:00.000Z"),
  idGenerator,
}: {
  clock?: Clock;
  idGenerator: IdGenerator;
}) {
  return new DexieRepository<TestEntity, TestCreate>({
    clock,
    createEntity: (input: TestCreate, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema,
    database,
    entitySchema: testEntitySchema,
    idGenerator,
    tableName: "tasks",
  });
}

function sequenceClock(...instants: string[]): Clock {
  let index = 0;
  return {
    now: () => {
      const instant = instants[Math.min(index, instants.length - 1)];
      index += 1;
      return new Date(instant);
    },
  };
}
