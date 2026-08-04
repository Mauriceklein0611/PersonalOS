import { describe, expect, it } from "vitest";

import { taskCategories, taskDetailsSchema, taskSchema } from "./model";

const metadata = {
  id: "00000000-0000-4000-8000-000000000911",
  createdAt: "2026-08-04T10:00:00.000Z",
  updatedAt: "2026-08-04T10:00:00.000Z",
};

describe("task model", () => {
  it("requires completedAt exactly for completed tasks", () => {
    expect(
      taskSchema.safeParse({
        ...metadata,
        priority: "normal",
        status: "completed",
        title: "Synthetische Aufgabe",
      }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({
        ...metadata,
        completedAt: metadata.updatedAt,
        priority: "normal",
        status: "open",
        title: "Synthetische Aufgabe",
      }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({
        ...metadata,
        completedAt: metadata.updatedAt,
        priority: "normal",
        status: "completed",
        title: "Synthetische Aufgabe",
      }).success,
    ).toBe(true);
  });

  it("accepts only the stable task category catalog", () => {
    expect(
      taskDetailsSchema.safeParse({
        categoryId: taskCategories[0].id,
        priority: "normal",
        title: "Synthetische Aufgabe",
      }).success,
    ).toBe(true);
    expect(
      taskDetailsSchema.safeParse({
        categoryId: "00000000-0000-4000-8000-000000000999",
        priority: "normal",
        title: "Synthetische Aufgabe",
      }).success,
    ).toBe(false);
  });
});
