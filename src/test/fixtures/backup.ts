import type { BackupData } from "../../db/schemas/domain-records";

const instant = "2026-01-15T09:30:00.000Z";
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;
const meta = (suffix: string) => ({
  id: id(suffix),
  createdAt: instant,
  updatedAt: instant,
});

const goalId = id("000000000101");
const habitId = id("000000000102");
const financeCategoryId = id("000000000103");
const savingsGoalId = id("000000000104");

export const backupDataFixture: BackupData = {
  settings: [
    {
      ...meta("000000000100"),
      locale: "de-DE",
      timeZone: "Europe/Berlin",
      theme: "system",
      baseCurrency: "EUR",
      weekStartsOn: 1,
    },
  ],
  tasks: [
    {
      ...meta("000000000110"),
      title: "Synthetische Aufgabe",
      status: "open",
      priority: "normal",
      plannedDate: "2026-01-16",
      goalId,
    },
  ],
  habits: [
    {
      ...meta("000000000102"),
      name: "Synthetische Gewohnheit",
      schedule: { kind: "daily" },
      startDate: "2026-01-01",
      goalId,
    },
  ],
  habitEntries: [
    {
      ...meta("000000000111"),
      habitId,
      localDate: "2026-01-15",
      status: "done",
    },
  ],
  journalEntries: [
    {
      ...meta("000000000112"),
      localDate: "2026-01-15",
      mood: 4,
      body: "Neutraler synthetischer Journaleintrag.",
    },
  ],
  goals: [
    {
      ...meta("000000000101"),
      title: "Synthetisches Ziel",
      status: "active",
      progressMode: "milestones",
    },
  ],
  goalMilestones: [
    {
      ...meta("000000000113"),
      goalId,
      title: "Synthetischer Meilenstein",
      status: "open",
      order: 0,
    },
  ],
  financeCategories: [
    {
      ...meta("000000000103"),
      name: "Synthetische Kategorie",
      kind: "expense",
    },
  ],
  transactions: [
    {
      ...meta("000000000114"),
      kind: "expense",
      money: { amountMinor: 1_250, currency: "EUR" },
      categoryId: financeCategoryId,
      bookedOn: "2026-01-15",
      description: "Synthetische Buchung",
    },
  ],
  monthlyBudgets: [
    {
      ...meta("000000000115"),
      month: "2026-01",
      categoryId: financeCategoryId,
      limit: { amountMinor: 10_000, currency: "EUR" },
    },
  ],
  savingsGoals: [
    {
      ...meta("000000000104"),
      name: "Synthetisches Sparziel",
      target: { amountMinor: 50_000, currency: "EUR" },
      status: "active",
    },
  ],
  savingsContributions: [
    {
      ...meta("000000000116"),
      savingsGoalId,
      money: { amountMinor: 5_000, currency: "EUR" },
      bookedOn: "2026-01-15",
    },
  ],
  scoreSettings: [
    {
      ...meta("000000000117"),
      enabled: true,
      components: [{ key: "focus", enabled: true, weight: 1 }],
    },
  ],
  scoreSnapshots: [
    {
      ...meta("000000000118"),
      localDate: "2026-01-15",
      engineVersion: "synthetic-v1",
      total: 70,
      completeness: 1,
      components: [{ key: "focus", value: 70, weight: 1, sourceCount: 1 }],
    },
  ],
};
