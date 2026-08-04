import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Task, TaskDetails } from "../model";
import type { TaskService } from "../service";
import { TasksPage } from "./TasksPage";

const fixedNow = new Date("2026-08-04T10:00:00.000Z");
const baseInstant = "2026-08-04T09:00:00.000Z";

describe("TasksPage", () => {
  it("captures a title-only task directly into the inbox", async () => {
    const user = userEvent.setup();
    const { service } = createMemoryTaskService();

    render(
      <TasksPage
        now={() => fixedNow}
        service={service}
        timeZone="Europe/Berlin"
      />,
    );

    await screen.findByText(
      "Die Inbox ist leer. Erfasse oben eine Aufgabe mit Titel.",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Neue Aufgabe" }),
      "Rechnung prüfen",
    );
    await user.click(
      screen.getByRole("button", { name: "Aufgabe hinzufügen" }),
    );

    expect(
      await screen.findByRole("heading", { level: 2, name: "Rechnung prüfen" }),
    ).toBeInTheDocument();
    expect(service.create).toHaveBeenCalledWith({
      priority: "normal",
      title: "Rechnung prüfen",
    });
  });

  it("explains invalid estimates and saves valid task details", async () => {
    const user = userEvent.setup();
    const { service } = createMemoryTaskService([createTask()]);

    render(
      <TasksPage
        now={() => fixedNow}
        service={service}
        timeZone="Europe/Berlin"
      />,
    );

    await screen.findByRole("heading", {
      level: 2,
      name: "Wochenplan erstellen",
    });
    await user.click(
      screen.getByRole("button", { name: "„Wochenplan erstellen“ bearbeiten" }),
    );
    const estimate = screen.getByRole("spinbutton", {
      name: "Schätzung in Minuten",
    });
    await user.type(estimate, "0");
    await user.click(
      screen.getByRole("button", { name: "Änderungen speichern" }),
    );

    expect(
      await screen.findByText(
        "Gib eine ganze Dauer zwischen 1 und 100.000 Minuten ein.",
      ),
    ).toBeInTheDocument();
    expect(service.updateDetails).not.toHaveBeenCalled();

    await user.clear(estimate);
    await user.type(estimate, "25");
    await user.type(
      screen.getByRole("textbox", { name: "Notiz" }),
      "Mit Ruhe planen",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Priorität" }),
      "high",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Kategorie" }),
      "00000000-0000-4000-8000-000000000901",
    );
    await user.click(
      screen.getByRole("button", { name: "Änderungen speichern" }),
    );

    expect(await screen.findByText("Mit Ruhe planen")).toBeInTheDocument();
    expect(screen.getByText("25 Min.")).toBeInTheDocument();
    expect(screen.getByText("Privat")).toBeInTheDocument();
    expect(screen.getByText("Hoch")).toBeInTheDocument();
  });

  it("restores an archived task through the undo action", async () => {
    const user = userEvent.setup();
    const { service } = createMemoryTaskService([createTask()]);

    render(
      <TasksPage
        now={() => fixedNow}
        service={service}
        timeZone="Europe/Berlin"
      />,
    );

    await screen.findByRole("heading", {
      level: 2,
      name: "Wochenplan erstellen",
    });
    await user.click(
      screen.getByRole("button", {
        name: "„Wochenplan erstellen“ archivieren",
      }),
    );

    expect(screen.queryByText("Wochenplan erstellen")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Rückgängig" }));

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Wochenplan erstellen",
      }),
    ).toBeInTheDocument();
    expect(service.archive).toHaveBeenCalledWith(createTask().id);
    expect(service.restore).toHaveBeenCalledWith(createTask().id);
  });
});

function createTask(): Task {
  return {
    id: "00000000-0000-4000-8000-000000000909",
    createdAt: baseInstant,
    updatedAt: baseInstant,
    title: "Wochenplan erstellen",
    priority: "normal",
    status: "open",
  };
}

function createMemoryTaskService(initialTasks: Task[] = []): {
  service: TaskService;
} {
  let tasks = [...initialTasks];
  let nextId = 910;

  const requireTask = (id: string): Task => {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task) throw new Error("task not found");
    return task;
  };
  const updateTask = (id: string, patch: Partial<Task>): Task => {
    const updated = {
      ...requireTask(id),
      ...patch,
      updatedAt: "2026-08-04T10:00:00.000Z",
    };
    tasks = tasks.map((task) => (task.id === id ? updated : task));
    return updated;
  };

  const service: TaskService = {
    archive: vi.fn(async (id) =>
      updateTask(id, { archivedAt: "2026-08-04T10:00:00.000Z" }),
    ),
    cancel: vi.fn(async (id) =>
      updateTask(id, { completedAt: undefined, status: "cancelled" }),
    ),
    complete: vi.fn(async (id) =>
      updateTask(id, {
        completedAt: "2026-08-04T10:00:00.000Z",
        status: "completed",
      }),
    ),
    create: vi.fn(async (details: TaskDetails) => {
      const task: Task = {
        ...details,
        id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
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
    reopen: vi.fn(async (id) =>
      updateTask(id, { completedAt: undefined, status: "open" }),
    ),
    restore: vi.fn(async (id) => updateTask(id, { archivedAt: undefined })),
    updateDetails: vi.fn(async (id, details) => updateTask(id, details)),
  };

  return { service };
}
