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

  it("finds a task by its note and keeps counts and list in step", async () => {
    const user = userEvent.setup();
    const { service } = createMemoryTaskService([
      createTask(),
      {
        ...createTask(),
        id: "00000000-0000-4000-8000-000000000908",
        notes: "Bei Müller nachfragen",
        title: "Rechnung prüfen",
      },
    ]);

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
    // Ohne Umlaut geschrieben: Die Suche vergleicht ohne Diakritika.
    await user.type(
      screen.getByRole("searchbox", { name: "Aufgaben durchsuchen" }),
      "muller",
    );

    expect(
      await screen.findByText("1 von 2 Aufgaben in dieser Ansicht"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Rechnung prüfen" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Wochenplan erstellen" }),
    ).not.toBeInTheDocument();
    // Der Zähler des Reiters zeigt dieselbe Auswahl wie die Liste darunter.
    expect(
      screen.getByRole("tab", { name: /^Inbox1 Aufgaben$/ }),
    ).toBeInTheDocument();
  });

  it("separates an empty result from an empty view", async () => {
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
    await user.type(
      screen.getByRole("searchbox", { name: "Aufgaben durchsuchen" }),
      "Segeltörn",
    );

    expect(await screen.findByText("Kein Treffer")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Zu „Segeltörn“ passt in dieser Ansicht keine Aufgabe. Prüfe die Schreibweise oder wechsle die Ansicht.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Die Inbox ist leer. Erfasse oben eine Aufgabe mit Titel.",
      ),
    ).not.toBeInTheDocument();
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

describe("TasksPage – Plandatum und Frist", () => {
  it("keeps a missed planned date, a missed deadline and a deadline without a plan apart", async () => {
    const user = userEvent.setup();
    const { service } = createMemoryTaskService([
      createDatedTask("01", "Plandatum verpasst", {
        plannedDate: "2026-08-03",
      }),
      createDatedTask("02", "Frist verpasst", {
        dueAt: "2026-08-02T10:00:00.000Z",
      }),
      createDatedTask("03", "Nur eine Frist", {
        dueAt: "2026-08-04T18:00:00.000Z",
      }),
    ]);

    render(
      <TasksPage
        now={() => fixedNow}
        service={service}
        timeZone="Europe/Berlin"
      />,
    );

    await user.click(await screen.findByRole("tab", { name: /^Heute/ }));

    // Vorher trugen alle drei dasselbe Wort „Überfällig“ — oder gar nichts.
    expect(
      await screen.findByText("Plandatum verstrichen"),
    ).toBeInTheDocument();
    expect(screen.getByText("Frist verstrichen")).toBeInTheDocument();
    expect(screen.getByText("Frist ohne Plandatum")).toBeInTheDocument();
    expect(screen.queryByText("Überfällig")).not.toBeInTheDocument();
  });

  it("says nothing about an elapsed date once the task is done", async () => {
    const user = userEvent.setup();
    const { service } = createMemoryTaskService([
      createDatedTask("04", "Längst erledigt", {
        completedAt: "2026-08-04T08:00:00.000Z",
        dueAt: "2026-08-02T10:00:00.000Z",
        plannedDate: "2026-08-03",
        status: "completed",
      }),
    ]);

    render(
      <TasksPage
        now={() => fixedNow}
        service={service}
        timeZone="Europe/Berlin"
      />,
    );

    await user.click(await screen.findByRole("tab", { name: /^Erledigt/ }));

    expect(
      await screen.findByRole("heading", { level: 2, name: "Längst erledigt" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/verstrichen/)).not.toBeInTheDocument();
  });
});

function createDatedTask(
  suffix: string,
  title: string,
  overrides: Partial<Task>,
): Task {
  return {
    id: `00000000-0000-4000-8000-0000000007${suffix}`,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    title,
    priority: "normal",
    status: "open",
    ...overrides,
  };
}

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
