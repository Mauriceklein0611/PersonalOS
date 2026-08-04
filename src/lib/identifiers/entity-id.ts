import { z } from "zod";

export const entityIdSchema = z.uuidv4();
export type EntityId = z.infer<typeof entityIdSchema>;

export type IdGenerator = () => EntityId;

export const createEntityId: IdGenerator = () =>
  entityIdSchema.parse(globalThis.crypto.randomUUID());

export function parseEntityId(value: unknown): EntityId {
  return entityIdSchema.parse(value);
}
