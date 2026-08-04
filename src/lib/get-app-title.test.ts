import { describe, expect, it } from "vitest";

import { getAppTitle } from "./get-app-title";

describe("getAppTitle", () => {
  it("returns the stable product name", () => {
    expect(getAppTitle()).toBe("PersonalOS");
  });
});
