import { describe, expect, it } from "vitest";

import { backupDataFixture } from "../../test/fixtures/backup";
import type { BackupData } from "../schemas/domain-records";
import { assertBackupIntegrity, BackupIntegrityError } from "./integrity";

const unknownGoalId = "00000000-0000-4000-8000-000000009999";

function withData(changes: Partial<BackupData>): BackupData {
  return { ...backupDataFixture, ...changes };
}

describe("assertBackupIntegrity", () => {
  it("accepts the synthetic fixture", () => {
    expect(() => assertBackupIntegrity(backupDataFixture)).not.toThrow();
  });

  it("reports a task that points at an unknown goal", () => {
    const [task] = backupDataFixture.tasks;
    expect(task).toBeDefined();

    expect(() =>
      assertBackupIntegrity(
        withData({ tasks: [{ ...task!, goalId: unknownGoalId }] }),
      ),
    ).toThrow(BackupIntegrityError);
  });

  it("reports a habit that points at an unknown goal", () => {
    const [habit] = backupDataFixture.habits;
    expect(habit).toBeDefined();

    expect(() =>
      assertBackupIntegrity(
        withData({ habits: [{ ...habit!, goalId: unknownGoalId }] }),
      ),
    ).toThrow(BackupIntegrityError);
  });

  it("accepts a task and a habit without any goal reference", () => {
    const [task] = backupDataFixture.tasks;
    const [habit] = backupDataFixture.habits;
    const taskWithoutGoal = { ...task! };
    const habitWithoutGoal = { ...habit! };
    delete taskWithoutGoal.goalId;
    delete habitWithoutGoal.goalId;

    expect(() =>
      assertBackupIntegrity(
        withData({ habits: [habitWithoutGoal], tasks: [taskWithoutGoal] }),
      ),
    ).not.toThrow();
  });

  it("reports a milestone whose goal is missing", () => {
    expect(() => assertBackupIntegrity(withData({ goals: [] }))).toThrow(
      BackupIntegrityError,
    );
  });
});
