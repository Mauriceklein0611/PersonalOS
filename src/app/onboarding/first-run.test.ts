import { describe, expect, it } from "vitest";

import { deriveFirstRunProgress } from "./first-run";

describe("deriveFirstRunProgress", () => {
  it("derives every step from existing records", () => {
    expect(
      deriveFirstRunProgress({
        financeCategoryCount: 0,
        habitCount: 0,
        taskCount: 0,
      }),
    ).toEqual({
      financeCategoryCreated: false,
      habitCreated: false,
      requiredComplete: false,
      requiredDone: 0,
      taskCreated: false,
    });

    expect(
      deriveFirstRunProgress({
        financeCategoryCount: 1,
        habitCount: 2,
        taskCount: 3,
      }),
    ).toEqual({
      financeCategoryCreated: true,
      habitCreated: true,
      requiredComplete: true,
      requiredDone: 2,
      taskCreated: true,
    });
  });
});
