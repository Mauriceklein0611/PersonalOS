import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { Habit, HabitEntry } from "../../habits/model";
import type { HabitService } from "../../habits/service";
import type { JournalEntry } from "../../journal/model";
import type { JournalService } from "../../journal/service";
import type { Task, TaskDetails } from "../../tasks/model";
import type { TaskService } from "../../tasks/service";
import { TodayPage } from "./TodayPage";

const fixedNow = new Date("2026-08-04T07:00:00.000Z");
const baseInstant = "2026-08-01T08:00:00.000Z";

type Services = {
  habitService: HabitService;
  journalService: JournalService;
  taskService: TaskService;
};

function renderPage(services: Services, now = () => fixedNow) {
  return render(
    <MemoryRouter>
      <TodayPage
        habitService={services.habitService}
        journalService={services.journalService}
        now={now}
        taskService={services.taskService}
        timeZone="Europe/Berlin"
      />
    </MemoryRouter>,
  );
}

describe("TodayPage", () => {
  it("stays understandable on an empty day", async () => {
    renderPage(createServices());

    expect(
      await screen.findByText(
        "Für heute steht keine Aufgabe an. Du kannst den Tag frei einteilen.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Keine offene Aufgabe")).toBeInTheDocument();
    expect(screen.getByText("Nichts fällig")).toBeInTheDocument();
    expect(
      screen.getByText("Für heute ist noch keine Reflexion gespeichert."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Es ist noch keine Stimmung erfasst."),
    ).toBeInTheDocument();
  });

  it("captures a task through the quick action and updates the cards", async () => {
    const user = userEvent.setup();
    const services = createServices();
    renderPage(services);

    await screen.findByText("Keine offene Aufgabe");
    await user.type(
      screen.getByRole("textbox", { name: "Aufgabe für heute" }),
      "Rechnung prüfen",
    );
    await user.click(
      screen.getByRole("button", { name: "Aufgabe hinzufügen" }),
    );

    expect(
      await screen.findByRole("heading", { level: 3, name: "Rechnung prüfen" }),
    ).toBeInTheDocument();
    expect(services.taskService.create).toHaveBeenCalledWith({
      plannedDate: "2026-08-04",
      priority: "normal",
      title: "Rechnung prüfen",
    });
    expect(
      screen.getByText("Wichtigstes für heute: Rechnung prüfen"),
    ).toBeInTheDocument();
  });

  it("completes a task and checks in a habit without a reload", async () => {
    const user = userEvent.setup();
    const services = createServices({
      habits: [createHabit("h1")],
      tasks: [createTask("t1", { plannedDate: "2026-08-04" })],
    });
    renderPage(services);

    await user.click(
      await screen.findByRole("button", { name: "„Aufgabe t1“ abschließen" }),
    );
    expect(await screen.findByText("Keine offene Aufgabe")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "„Gewohnheit h1“ heute erledigen" }),
    );

    expect(
      await screen.findByText(
        "Alle 1 fälligen Gewohnheiten sind für heute erfasst.",
      ),
    ).toBeInTheDocument();
    expect(services.habitService.checkIn).toHaveBeenCalledWith(
      "h1",
      "2026-08-04",
      "done",
    );
  });

  it("offers undo for a completed task and for a habit check-in", async () => {
    const user = userEvent.setup();
    const services = createServices({
      habits: [createHabit("h1")],
      tasks: [createTask("t1", { plannedDate: "2026-08-04" })],
    });
    renderPage(services);

    await user.click(
      await screen.findByRole("button", { name: "„Aufgabe t1“ abschließen" }),
    );
    await user.click(await screen.findByRole("button", { name: "Rückgängig" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Aufgabe t1" }),
    ).toBeInTheDocument();
    expect(services.taskService.reopen).toHaveBeenCalledWith("t1");

    await user.click(
      screen.getByRole("button", { name: "„Gewohnheit h1“ heute erledigen" }),
    );
    await user.click(await screen.findByRole("button", { name: "Rückgängig" }));

    expect(
      await screen.findByRole("button", {
        name: "„Gewohnheit h1“ heute erledigen",
      }),
    ).toBeInTheDocument();
    expect(services.habitService.reopenCheckIn).toHaveBeenCalledWith(
      "h1",
      "2026-08-04",
    );
  });

  it("presents an older mood as a past entry", async () => {
    renderPage(
      createServices({
        journalEntries: [createJournalEntry("2026-08-01", { mood: 2 })],
      }),
    );

    expect(
      await screen.findByText(
        "Zuletzt erfasste Stimmung: 2 von 5, vom Samstag, 1. August 2026. Das ist ein Eintrag aus der Vergangenheit und nicht dein heutiger Stand.",
      ),
    ).toBeInTheDocument();
  });

  it("summarises the day without showing journal free text", async () => {
    renderPage(
      createServices({
        journalEntries: [
          createJournalEntry("2026-08-04", {
            highlight: "Sehr persönlicher Text",
            mood: 4,
          }),
        ],
      }),
    );

    await screen.findByText("Für heute ist eine Reflexion gespeichert.");
    expect(
      screen.queryByText(/Sehr persönlicher Text/),
    ).not.toBeInTheDocument();
    const tile = screen
      .getByText("Abendreflexion")
      .closest(".ui-metric-tile") as HTMLElement;
    expect(within(tile).getByText("Erfasst")).toBeInTheDocument();
    expect(within(tile).getByText("2 Felder ausgefüllt")).toBeInTheDocument();
  });
});

function createTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    title: `Aufgabe ${id}`,
    priority: "normal",
    status: "open",
    ...overrides,
  };
}

function createHabit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    name: `Gewohnheit ${id}`,
    schedule: { kind: "daily" },
    startDate: "2026-08-01",
    ...overrides,
  };
}

function createJournalEntry(
  localDate: string,
  fields: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id: `journal-${localDate}`,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    localDate,
    ...fields,
  };
}

function createServices(
  initial: {
    habits?: Habit[];
    journalEntries?: JournalEntry[];
    tasks?: Task[];
  } = {},
): Services {
  let habitEntries: HabitEntry[] = [];
  let tasks = [...(initial.tasks ?? [])];
  const habits = [...(initial.habits ?? [])];
  const journalEntries = [...(initial.journalEntries ?? [])];
  let nextId = 1400;

  const updateTask = (id: string, patch: Partial<Task>): Task => {
    const current = tasks.find((task) => task.id === id);
    if (!current) throw new Error("task not found");
    const updated = { ...current, ...patch, updatedAt: baseInstant };
    tasks = tasks.map((task) => (task.id === id ? updated : task));
    return updated;
  };

  const notImplemented = () => {
    throw new Error("not used by the dashboard");
  };

  const habitService = {
    archive: vi.fn(notImplemented),
    checkIn: vi.fn(async (habitId, localDate, status) => {
      const entry: HabitEntry = {
        id: `${habitId}-${localDate}`,
        createdAt: baseInstant,
        updatedAt: baseInstant,
        habitId,
        localDate,
        status,
      };
      habitEntries = [
        ...habitEntries.filter(
          (candidate) =>
            candidate.habitId !== habitId || candidate.localDate !== localDate,
        ),
        entry,
      ];
      return entry;
    }),
    create: vi.fn(notImplemented),
    list: vi.fn(async () =>
      habits.filter((habit) => habit.archivedAt === undefined),
    ),
    listEntries: vi.fn(async (habitId: string) =>
      habitEntries.filter((entry) => entry.habitId === habitId),
    ),
    reopenCheckIn: vi.fn(async (habitId: string, localDate: string) => {
      const remaining = habitEntries.filter(
        (entry) => entry.habitId !== habitId || entry.localDate !== localDate,
      );
      const removed = remaining.length !== habitEntries.length;
      habitEntries = remaining;
      return removed;
    }),
    restore: vi.fn(notImplemented),
    updateDetails: vi.fn(notImplemented),
  } as unknown as HabitService;

  const journalService = {
    getForDate: vi.fn(async (localDate: string) =>
      journalEntries.find((entry) => entry.localDate === localDate),
    ),
    list: vi.fn(async () => [...journalEntries]),
    saveForDate: vi.fn(notImplemented),
  } as unknown as JournalService;

  const taskService = {
    archive: vi.fn(async (id: string) =>
      updateTask(id, { archivedAt: baseInstant }),
    ),
    cancel: vi.fn(async (id: string) =>
      updateTask(id, { status: "cancelled" }),
    ),
    complete: vi.fn(async (id: string) =>
      updateTask(id, {
        completedAt: "2026-08-04T09:00:00.000Z",
        status: "completed",
      }),
    ),
    create: vi.fn(async (details: TaskDetails) => {
      const task: Task = {
        ...details,
        id: `t${nextId++}`,
        createdAt: baseInstant,
        updatedAt: baseInstant,
        status: "open",
      };
      tasks = [...tasks, task];
      return task;
    }),
    list: vi.fn(async () =>
      tasks.filter((task) => task.archivedAt === undefined),
    ),
    reopen: vi.fn(async (id: string) => updateTask(id, { status: "open" })),
    restore: vi.fn(async (id: string) =>
      updateTask(id, { archivedAt: undefined }),
    ),
    updateDetails: vi.fn(notImplemented),
  } as unknown as TaskService;

  return { habitService, journalService, taskService };
}
