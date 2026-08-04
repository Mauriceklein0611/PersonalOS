import type { Clock } from "../../lib/dates/date-values";
import type { IdGenerator } from "../../lib/identifiers/entity-id";
import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import type { Repository } from "../../db/repositories/contracts";
import { DexieRepository } from "../../db/repositories/dexie-repository";
import type { EntityMeta } from "../../db/types";
import {
  taskDetailsSchema,
  taskSchema,
  type Task,
  type TaskDetails,
} from "./model";

export type TaskRepository = Repository<Task, TaskDetails>;

export function createTaskRepository(
  database: PersonalOsDatabase,
  dependencies: { clock?: Clock; idGenerator?: IdGenerator } = {},
): TaskRepository {
  return new DexieRepository<Task, TaskDetails>({
    clock: dependencies.clock,
    createEntity: (input: TaskDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
      status: "open",
    }),
    createSchema: taskDetailsSchema,
    database,
    entitySchema: taskSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "tasks",
  });
}

export const personalOsTaskRepository =
  createTaskRepository(personalOsDatabase);
