import { z } from "zod";

import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import { PersistenceError, toPersistenceError } from "../../db/errors";
import type { Repository } from "../../db/repositories/contracts";
import { DexieRepository } from "../../db/repositories/dexie-repository";
import type { EntityMeta, EntityMetadataDependencies } from "../../db/types";
import { entityIdSchema } from "../../lib/identifiers/entity-id";
import {
  goalDetailsSchema,
  goalMilestoneDetailsSchema,
  goalMilestoneSchema,
  goalSchema,
  type Goal,
  type GoalDetails,
  type GoalMilestone,
  type GoalMilestoneDetails,
} from "./model";

export type GoalRepository = Repository<Goal, GoalDetails>;

export type GoalMilestoneRepository = Repository<
  GoalMilestone,
  GoalMilestoneDetails
> & {
  listForGoal(goalId: string): Promise<GoalMilestone[]>;
};

export function createGoalRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): GoalRepository {
  return new DexieRepository<Goal, GoalDetails>({
    clock: dependencies.clock,
    createEntity: (input: GoalDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: goalDetailsSchema,
    database,
    entitySchema: goalSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "goals",
  });
}

export function createGoalMilestoneRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): GoalMilestoneRepository {
  const records = new DexieRepository<GoalMilestone, GoalMilestoneDetails>({
    clock: dependencies.clock,
    createEntity: (input: GoalMilestoneDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: goalMilestoneDetailsSchema,
    database,
    entitySchema: goalMilestoneSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "goalMilestones",
  });

  return Object.assign(records, {
    async listForGoal(goalId: string) {
      try {
        const validGoalId = parse(entityIdSchema, goalId);
        const rows = await database
          .table<GoalMilestone>("goalMilestones")
          .where("goalId")
          .equals(validGoalId)
          .toArray();
        return rows.map((row) => parse(goalMilestoneSchema, row));
      } catch (error) {
        throw toPersistenceError(error);
      }
    },
  });
}

function parse<TValue>(schema: z.ZodType<TValue>, value: unknown): TValue {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new PersistenceError("validation", { cause: result.error });
  }
  return result.data;
}

export const personalOsGoalRepository =
  createGoalRepository(personalOsDatabase);
export const personalOsGoalMilestoneRepository =
  createGoalMilestoneRepository(personalOsDatabase);
