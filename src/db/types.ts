import { z } from "zod";

import {
  createIsoInstant,
  isoInstantSchema,
  nextUpdatedAt,
  systemClock,
  type Clock,
} from "../lib/dates/date-values";
import {
  createEntityId,
  entityIdSchema,
  type IdGenerator,
} from "../lib/identifiers/entity-id";

export const entityMetaSchema = z
  .object({
    id: entityIdSchema,
    createdAt: isoInstantSchema,
    updatedAt: isoInstantSchema,
    archivedAt: isoInstantSchema.optional(),
  })
  .strict()
  .superRefine((entity, context) => {
    if (entity.updatedAt < entity.createdAt) {
      context.addIssue({
        code: "custom",
        message: "updatedAt must not be earlier than createdAt",
        path: ["updatedAt"],
      });
    }

    if (entity.archivedAt && entity.archivedAt < entity.createdAt) {
      context.addIssue({
        code: "custom",
        message: "archivedAt must not be earlier than createdAt",
        path: ["archivedAt"],
      });
    }
  });

export type EntityMeta = z.infer<typeof entityMetaSchema>;
export type StoredEntity = EntityMeta & Record<string, unknown>;

export type EntityMetadataDependencies = {
  clock?: Clock;
  idGenerator?: IdGenerator;
};

export function createEntityMeta(
  dependencies: EntityMetadataDependencies = {},
): EntityMeta {
  const clock = dependencies.clock ?? systemClock;
  const idGenerator = dependencies.idGenerator ?? createEntityId;
  const now = createIsoInstant(clock.now());

  return {
    id: idGenerator(),
    createdAt: now,
    updatedAt: now,
  };
}

export function touchEntity<TEntity extends EntityMeta>(
  entity: TEntity,
  clock: Clock = systemClock,
): TEntity {
  return {
    ...entity,
    updatedAt: nextUpdatedAt(entity.updatedAt, clock),
  };
}
