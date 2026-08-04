import { describe, expect, it } from "vitest";

import { createEntityId, parseEntityId } from "./entity-id";

describe("entity ID helpers", () => {
  it("creates and validates UUID v4 identifiers", () => {
    expect(parseEntityId(createEntityId())).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(() => parseEntityId("task-1")).toThrow();
  });
});
