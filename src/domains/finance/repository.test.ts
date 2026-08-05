import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import { PersistenceError } from "../../db/errors";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import {
  createFinanceCategoryRepository,
  createTransactionRepository,
  monthOf,
} from "./repository";

const groceriesId = "00000000-0000-4000-8000-000000002101";
const salaryId = "00000000-0000-4000-8000-000000002102";
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("finance repositories", () => {
  it("stores amounts as non-negative minor units and keeps the direction in kind", async () => {
    const categories = createFinanceCategoryRepository(database, {
      idGenerator: () => groceriesId,
    });
    const transactions = createTransactionRepository(database);
    await categories.create({ kind: "expense", name: "Beispiel Einkauf" });

    const stored = await transactions.create({
      bookedOn: "2026-08-04",
      categoryId: groceriesId,
      kind: "expense",
      money: { amountMinor: 1_250, currency: "EUR" },
    });

    expect(stored.money).toEqual({ amountMinor: 1_250, currency: "EUR" });
    expect(stored.kind).toBe("expense");
    await expect(
      transactions.create({
        bookedOn: "2026-08-04",
        categoryId: groceriesId,
        kind: "expense",
        money: { amountMinor: -1, currency: "EUR" },
      }),
    ).rejects.toBeInstanceOf(PersistenceError);
  });

  it("rejects invalid dates and unknown fields", async () => {
    const transactions = createTransactionRepository(database);

    await expect(
      transactions.create({
        bookedOn: "04.08.2026",
        categoryId: groceriesId,
        kind: "expense",
        money: { amountMinor: 100, currency: "EUR" },
      } as never),
    ).rejects.toBeInstanceOf(PersistenceError);

    await expect(
      transactions.create({
        bookedOn: "2026-08-04",
        categoryId: groceriesId,
        kind: "expense",
        money: { amountMinor: 100, currency: "EUR" },
        merchant: "Nicht erlaubt",
      } as never),
    ).rejects.toBeInstanceOf(PersistenceError);
  });

  it("filters by month, kind and category and skips archived rows", async () => {
    const transactions = createTransactionRepository(database);
    await transactions.create({
      bookedOn: "2026-08-04",
      categoryId: groceriesId,
      kind: "expense",
      money: { amountMinor: 1_250, currency: "EUR" },
    });
    await transactions.create({
      bookedOn: "2026-08-31",
      categoryId: salaryId,
      kind: "income",
      money: { amountMinor: 200_000, currency: "EUR" },
    });
    const julyEntry = await transactions.create({
      bookedOn: "2026-07-15",
      categoryId: groceriesId,
      kind: "expense",
      money: { amountMinor: 900, currency: "EUR" },
    });

    expect(await transactions.listFiltered({ month: "2026-08" })).toHaveLength(
      2,
    );
    expect(
      await transactions.listFiltered({ kind: "income", month: "2026-08" }),
    ).toHaveLength(1);
    expect(
      await transactions.listFiltered({ categoryId: groceriesId }),
    ).toHaveLength(2);

    await transactions.archive(julyEntry.id);
    expect(
      await transactions.listFiltered({ categoryId: groceriesId }),
    ).toHaveLength(1);
  });

  it("counts only unarchived usages of a category", async () => {
    const transactions = createTransactionRepository(database);
    const entry = await transactions.create({
      bookedOn: "2026-08-04",
      categoryId: groceriesId,
      kind: "expense",
      money: { amountMinor: 500, currency: "EUR" },
    });

    expect(await transactions.countForCategory(groceriesId)).toBe(1);
    expect(await transactions.countForCategory(salaryId)).toBe(0);

    await transactions.archive(entry.id);
    expect(await transactions.countForCategory(groceriesId)).toBe(0);
  });
});

describe("monthOf", () => {
  it("reduces a calendar day to its month", () => {
    expect(monthOf("2026-08-04")).toBe("2026-08");
  });
});
