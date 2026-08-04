import { describe, expect, it } from "vitest";

import { buildEntityMeta } from "../test/factories/entity";
import { createEntityMeta, entityMetaSchema, touchEntity } from "./types";

describe("entity metadata", () => {
  it("creates stable metadata from injected deterministic dependencies", () => {
    const metadata = createEntityMeta({
      clock: { now: () => new Date("2026-01-15T09:30:00.000Z") },
      idGenerator: () => "00000000-0000-4000-8000-000000000002",
    });

    expect(metadata).toEqual({
      id: "00000000-0000-4000-8000-000000000002",
      createdAt: "2026-01-15T09:30:00.000Z",
      updatedAt: "2026-01-15T09:30:00.000Z",
    });
  });

  it("validates timestamp order and touches only updatedAt", () => {
    const entity = buildEntityMeta();
    const touched = touchEntity(entity, {
      now: () => new Date("2026-01-15T10:00:00.000Z"),
    });

    expect(touched).toEqual({
      ...entity,
      updatedAt: "2026-01-15T10:00:00.000Z",
    });
    expect(
      entityMetaSchema.safeParse({
        ...entity,
        updatedAt: "2026-01-15T08:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
