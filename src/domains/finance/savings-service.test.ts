import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBackupService } from "../../db/backup/service";
import type { PersonalOsDatabase } from "../../db/database";
import { PersistenceError } from "../../db/errors";
import { personalOsTableNames } from "../../db/schema";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import type { SavingsGoal } from "./model";
import {
  createSavingsContributionRepository,
  createSavingsGoalRepository,
} from "./repository";
import { calculateSavingsProgress } from "./savings";
import { createSavingsService, type SavingsService } from "./savings-service";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

function buildService(): SavingsService {
  return createSavingsService({
    contributions: createSavingsContributionRepository(database),
    database,
    goals: createSavingsGoalRepository(database),
  });
}

async function createGoal(
  service: SavingsService,
  amountMinor = 100_000,
  currency = "EUR",
): Promise<SavingsGoal> {
  return service.createGoal({
    name: "Synthetisches Sparziel",
    status: "active",
    target: { amountMinor, currency },
  });
}

async function readProgress(service: SavingsService, goal: SavingsGoal) {
  const [goals, contributions] = await Promise.all([
    service.listGoals(),
    service.listContributions(),
  ]);
  const current = goals.find((entry) => entry.id === goal.id) ?? goal;
  return calculateSavingsProgress(current, contributions);
}

describe("savings service", () => {
  it("derives the amount from contributions and updates it on edit and withdrawal", async () => {
    const service = buildService();
    const goal = await createGoal(service);

    const first = await service.addContribution({
      bookedOn: "2026-01-15",
      money: { amountMinor: 25_000, currency: "EUR" },
      savingsGoalId: goal.id,
    });
    const second = await service.addContribution({
      bookedOn: "2026-02-15",
      money: { amountMinor: 10_000, currency: "EUR" },
      savingsGoalId: goal.id,
    });
    expect((await readProgress(service, goal)).savedMinor).toBe(35_000);

    await service.updateContribution(first.id, {
      money: { amountMinor: 30_000, currency: "EUR" },
    });
    expect((await readProgress(service, goal)).savedMinor).toBe(40_000);

    await service.removeContribution(second.id);
    expect((await readProgress(service, goal)).savedMinor).toBe(30_000);

    await service.restoreContribution(second.id);
    expect((await readProgress(service, goal)).savedMinor).toBe(40_000);
  });

  it("keeps a goal and its contributions in the same currency", async () => {
    const service = buildService();
    const goal = await createGoal(service);
    const contribution = await service.addContribution({
      bookedOn: "2026-01-15",
      money: { amountMinor: 25_000, currency: "EUR" },
      savingsGoalId: goal.id,
    });

    await expect(
      service.addContribution({
        bookedOn: "2026-01-16",
        money: { amountMinor: 5_000, currency: "CHF" },
        savingsGoalId: goal.id,
      }),
    ).rejects.toBeInstanceOf(PersistenceError);
    await expect(
      service.updateContribution(contribution.id, {
        money: { amountMinor: 5_000, currency: "CHF" },
      }),
    ).rejects.toBeInstanceOf(PersistenceError);
    await expect(
      service.updateGoal(goal.id, {
        name: goal.name,
        status: goal.status,
        target: { amountMinor: 100_000, currency: "CHF" },
      }),
    ).rejects.toBeInstanceOf(PersistenceError);

    expect(await service.listContributions(goal.id)).toHaveLength(1);
  });

  // Der Betrag bleibt eine ganzzahlige Differenz, auch über dem Ziel.
  it("reports an exceeded target without capping it", async () => {
    const service = buildService();
    const goal = await createGoal(service);
    await service.addContribution({
      bookedOn: "2026-01-15",
      money: { amountMinor: 150_000, currency: "EUR" },
      savingsGoalId: goal.id,
    });

    const progress = await readProgress(service, goal);
    expect(progress.openMinor).toBe(-50_000);
    expect(progress.state).toBe("exceeded");
  });

  it("accepts a goal without a deadline and adds one later", async () => {
    const service = buildService();
    const goal = await createGoal(service);
    expect(goal.targetDate).toBeUndefined();

    const withDeadline = await service.updateGoal(goal.id, {
      name: goal.name,
      status: goal.status,
      target: goal.target,
      targetDate: "2026-12-31",
    });
    expect(withDeadline.targetDate).toBe("2026-12-31");

    const withoutDeadline = await service.updateGoal(goal.id, {
      name: goal.name,
      status: goal.status,
      target: goal.target,
    });
    expect(withoutDeadline.targetDate).toBeUndefined();
  });

  it("counts affected contributions and removes them together with the goal", async () => {
    const service = buildService();
    const goal = await createGoal(service);
    const kept = await createGoal(service);
    const withdrawn = await service.addContribution({
      bookedOn: "2026-01-15",
      money: { amountMinor: 25_000, currency: "EUR" },
      savingsGoalId: goal.id,
    });
    await service.addContribution({
      bookedOn: "2026-02-15",
      money: { amountMinor: 10_000, currency: "EUR" },
      savingsGoalId: goal.id,
    });
    await service.addContribution({
      bookedOn: "2026-02-15",
      money: { amountMinor: 1_000, currency: "EUR" },
      savingsGoalId: kept.id,
    });
    // Auch eine Rücknahme verschwindet mit; die Warnung nennt sie deshalb.
    await service.removeContribution(withdrawn.id);

    expect(await service.countContributions(goal.id)).toBe(2);

    const deletion = await service.deleteGoalPermanently(goal.id);

    expect(deletion).toEqual({
      removedContributionCount: 2,
      savingsGoalId: goal.id,
    });
    expect(await service.listGoals({ includeArchived: true })).toHaveLength(1);
    expect(await service.listContributions()).toHaveLength(1);
  });

  it("keeps the goal untouched when the deletion cannot be resolved", async () => {
    const service = buildService();
    const goal = await createGoal(service);
    await service.addContribution({
      bookedOn: "2026-01-15",
      money: { amountMinor: 25_000, currency: "EUR" },
      savingsGoalId: goal.id,
    });

    await expect(
      service.deleteGoalPermanently("00000000-0000-4000-8000-000000009999"),
    ).rejects.toBeInstanceOf(PersistenceError);

    expect(await service.listGoals()).toHaveLength(1);
    expect(await service.listContributions()).toHaveLength(1);
  });

  it("survives an export and import roundtrip without losing the progress", async () => {
    const service = buildService();
    const goal = await createGoal(service);
    await service.addContribution({
      bookedOn: "2026-01-15",
      money: { amountMinor: 25_000, currency: "EUR" },
      note: "Synthetischer Beitrag",
      savingsGoalId: goal.id,
    });
    await service.addContribution({
      bookedOn: "2026-02-15",
      money: { amountMinor: 10_000, currency: "EUR" },
      savingsGoalId: goal.id,
    });

    const backupService = createBackupService(database);
    const backup = await backupService.create();
    await database.transaction(
      "rw",
      personalOsTableNames.map((name) => database.table(name)),
      async () => {
        for (const name of personalOsTableNames) {
          await database.table(name).clear();
        }
      },
    );
    expect(await service.listGoals()).toHaveLength(0);

    await backupService.replace(
      backupService.parse(JSON.stringify(backup)),
      () => undefined,
    );

    expect(await service.listGoals()).toEqual([goal]);
    expect((await readProgress(service, goal)).savedMinor).toBe(35_000);
  });
});
