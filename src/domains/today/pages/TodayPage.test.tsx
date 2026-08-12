import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { createMemoryFinanceService } from "../../../test/factories/finance";
import { createMemorySavingsService } from "../../../test/factories/savings";
import { createStubScoreService } from "../../../test/factories/score";
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

/**
 * Finanzen, Sparziele und Life Score laufen über Ersatzdienste. Ohne sie
 * griffe die Seite auf die echten Dienste und damit auf die Datenbank zu —
 * geprüft wird hier die Oberfläche, nicht die Persistenz.
 */
function renderPage(
  services: Services,
  now = () => fixedNow,
  financeService = createMemoryFinanceService(),
  dailyCapacityMinutes?: number,
  savingsService = createMemorySavingsService(),
  scoreService = createStubScoreService(),
) {
  return render(
    <MemoryRouter>
      <TodayPage
        dailyCapacityMinutes={dailyCapacityMinutes}
        financeService={financeService}
        habitService={services.habitService}
        journalService={services.journalService}
        now={now}
        savingsService={savingsService}
        scoreService={scoreService}
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
      screen.getByRole("button", { name: "„Routine h1“ heute erledigen" }),
    );

    expect(
      await screen.findByText(
        "Alle 1 fälligen Routinen sind für heute erfasst.",
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
      screen.getByRole("button", { name: "„Routine h1“ heute erledigen" }),
    );
    await user.click(await screen.findByRole("button", { name: "Rückgängig" }));

    expect(
      await screen.findByRole("button", {
        name: "„Routine h1“ heute erledigen",
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
  });

  /*
   * Maximal drei Kennzahlen. Der Abendreflexion und der geplanten Zeit ist mit
   * dem Umbau je eine Ebene zugewiesen: die Reflexion als Karte und als
   * Signal am Abend, die geplante Zeit als Signal, sobald sie über dem
   * Tagesbudget liegt. Als Dauerkachel sagten beide jeden Tag dasselbe.
   */
  it("shows no more than the three agreed metrics", async () => {
    renderPage(createServices());

    await screen.findByText("Life Score");
    const labels = screen
      .getAllByText(
        /^(Aufgaben heute|Routinen heute|Life Score|Budget übrig|Abendreflexion|Geplante Zeit heute)$/,
      )
      .map((element) => element.textContent);

    // Ohne gesetztes Budget bleibt der erklärbare Life Score die dritte Kachel.
    expect(labels).toEqual(["Aufgaben heute", "Routinen heute", "Life Score"]);
  });

  it("names the life score with its completeness and links the explanation", async () => {
    renderPage(createServices());

    const tile = (await screen.findByText("Life Score")).closest(
      ".ui-metric-tile",
    ) as HTMLElement;
    expect(within(tile).getByText("72 von 100")).toBeInTheDocument();
    expect(within(tile).getByText(/von \d+ Bereichen/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Wie der Life Score entsteht" }),
    ).toBeInTheDocument();
  });

  it("keeps the life score readable without a basis", async () => {
    renderPage(
      createServices(),
      () => fixedNow,
      undefined,
      undefined,
      undefined,
      createStubScoreService(null),
    );

    const tile = (await screen.findByText("Life Score")).closest(
      ".ui-metric-tile",
    ) as HTMLElement;
    // Niemals „0" für fehlende Daten.
    expect(tile.textContent).not.toContain("0 von 100");
    expect(within(tile).getByText("Keine Angabe")).toBeInTheDocument();
  });

  it("books an expense from the dashboard and offers to undo it", async () => {
    const user = userEvent.setup();
    const financeService = createMemoryFinanceService();
    await financeService.createCategory({
      kind: "expense",
      name: "Lebensmittel",
    });
    renderPage(createServices(), () => fixedNow, financeService);

    await user.type(
      await screen.findByRole("textbox", { name: /Betrag der Ausgabe/ }),
      "12,50",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Kategorie der Ausgabe/ }),
      [screen.getByRole("option", { name: "Lebensmittel" })],
    );
    await user.click(screen.getByRole("button", { name: "Ausgabe buchen" }));

    expect(
      await screen.findByText("Die Ausgabe über 12,50 wurde gebucht."),
    ).toBeInTheDocument();
    expect(await financeService.listTransactions()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Rückgängig" }));

    expect(
      await screen.findByText("Die Ausgabe wurde archiviert."),
    ).toBeInTheDocument();
    expect(await financeService.listTransactions()).toEqual([]);
  });

  it("names the truncation and links to the full task list", async () => {
    renderPage(
      createServices({
        tasks: Array.from({ length: 12 }, (_, index) =>
          createTask(`t${index + 1}`, { plannedDate: "2026-08-04" }),
        ),
      }),
    );

    expect(await screen.findByText(/5 von 12 gezeigt/)).toBeInTheDocument();
    const tile = screen
      .getByText("Aufgaben heute")
      .closest(".ui-metric-tile") as HTMLElement;
    expect(within(tile).getByText("12 offen")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /abschließen/ })).toHaveLength(
      5,
    );
    expect(
      screen.getByRole("link", { name: "Alle Aufgaben ansehen" }),
    ).toHaveAttribute("href", "/planen/aufgaben");
  });

  it("stays quiet when the list is complete", async () => {
    renderPage(
      createServices({
        tasks: Array.from({ length: 5 }, (_, index) =>
          createTask(`t${index + 1}`, { plannedDate: "2026-08-04" }),
        ),
      }),
    );

    await screen.findByRole("heading", { level: 3, name: "Aufgabe t1" });
    expect(screen.queryByText(/gezeigt/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Alle Aufgaben ansehen" }),
    ).not.toBeInTheDocument();
  });
});

/*
 * Die geplante Zeit ist mit dem Dashboard-Umbau von einer Dauerkachel zu einem
 * Signal geworden. Sie meldet sich nur noch, wenn sie über dem Tagesbudget
 * liegt — ein Tag im Rahmen braucht keine Zeile.
 */
describe("TodayPage – geplante Zeit", () => {
  it("stays silent while the planned time is within the budget", async () => {
    renderPage(
      createServices({
        tasks: [
          createTask("t1", { estimatedMinutes: 60, plannedDate: "2026-08-04" }),
        ],
      }),
      () => fixedNow,
      undefined,
      120,
    );

    await screen.findByRole("heading", {
      level: 2,
      name: "Aufgaben für heute",
    });
    expect(screen.queryByText(/Heute geplant:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Geplante Zeit heute")).not.toBeInTheDocument();
  });

  it("stays silent without a single estimate, whatever the budget", async () => {
    renderPage(
      createServices({
        tasks: [createTask("t1", { plannedDate: "2026-08-04" })],
      }),
      () => fixedNow,
      undefined,
      120,
    );

    await screen.findByRole("heading", {
      level: 2,
      name: "Aufgaben für heute",
    });
    expect(screen.queryByText(/Heute geplant:/)).not.toBeInTheDocument();
  });

  // Sachlich, ohne Dringlichkeitsrhetorik: eine Feststellung, keine Mahnung.
  it("names the planned time once it exceeds the budget", async () => {
    renderPage(
      createServices({
        tasks: [
          createTask("t1", {
            estimatedMinutes: 200,
            plannedDate: "2026-08-04",
          }),
        ],
      }),
      () => fixedNow,
      undefined,
      120,
    );

    const row = (await screen.findByText("Heute geplant: 3 h 20 min")).closest(
      ".ui-signal-row",
    ) as HTMLElement;

    expect(row).toBeInTheDocument();
    for (const word of ["Achtung", "Warnung", "zu viel", "schaffst"]) {
      expect(row.textContent).not.toContain(word);
    }
  });
});

describe("TodayPage – Signale", () => {
  it("shows no signal area at all when nothing is remarkable", async () => {
    renderPage(createServices());

    await screen.findByRole("heading", {
      level: 2,
      name: "Aufgaben für heute",
    });
    // Der leere Bereich ist die Aussage; eine Überschrift ohne Inhalt wäre
    // eine Zeile, die jeden Tag dasselbe sagt.
    expect(
      screen.queryByRole("heading", { level: 2, name: "Signale" }),
    ).not.toBeInTheDocument();
  });

  it("names overdue tasks and offers a way to them", async () => {
    renderPage(
      createServices({
        tasks: [createTask("t1", { plannedDate: "2026-08-02" })],
      }),
    );

    await screen.findByRole("heading", { level: 2, name: "Signale" });
    const row = screen
      .getByText("1 Aufgabe aus den Vortagen")
      .closest(".ui-signal-row") as HTMLElement;
    expect(
      within(row).getByRole("link", { name: "Zu den Aufgaben" }),
    ).toBeInTheDocument();
  });
});

describe("TodayPage – Tagesfortschritt", () => {
  /*
   * Der Ring ist das prominenteste Element der Seite. Solange er allein die
   * Routinen maß, blieb er an einem Tag ohne fällige Routine leer,
   * auch wenn jede Aufgabe erledigt war.
   */
  it("counts tasks and habits together", async () => {
    renderPage(
      createServices({
        tasks: [
          createTask("t1", { plannedDate: "2026-08-04" }),
          createTask("t2", { plannedDate: "2026-08-04" }),
        ],
      }),
    );

    // Der Wertetext nennt den Stand, die Datenbasis darunter den Umfang.
    expect(await screen.findByText("0 von 2")).toBeInTheDocument();
    expect(screen.getByText("Aufgaben und Routinen")).toBeInTheDocument();
  });
});

describe("TodayPage – Erfassen vor Auswerten", () => {
  /*
   * #118: Die Erfassung steht vor Kennzahlen und Signalen. Das ist keine
   * Geschmacksfrage — bei 375 × 844 px begann die erste Eingabe vorher
   * unterhalb der Falz, und der Morgen-Check-in fing mit Scrollen an.
   */
  it("places both capture actions before the metrics", async () => {
    const { container } = renderPage(createServices());
    await screen.findByRole("textbox", { name: "Aufgabe für heute" });

    const capture = container.querySelector(".today-capture");
    const metrics = container.querySelector(".today-metrics");
    expect(capture).not.toBeNull();
    expect(metrics).not.toBeNull();
    expect(
      capture!.compareDocumentPosition(metrics!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", { level: 3, name: "Ausgabe erfassen" }),
    ).toBeInTheDocument();
  });

  /*
   * Ansehen darf nichts anlegen. `load` würde eine Score-Konfiguration
   * schreiben, die niemand angelegt hat — sichtbar unter anderem in der Zahl
   * der lokalen Datensätze in den Einstellungen.
   */
  it("reads the score without writing anything", async () => {
    const scoreService = createStubScoreService();
    const load = vi.spyOn(scoreService, "load");
    const preview = vi.spyOn(scoreService, "preview");
    const saveComponents = vi.spyOn(scoreService, "saveComponents");
    const setEnabled = vi.spyOn(scoreService, "setEnabled");

    renderPage(
      createServices(),
      () => fixedNow,
      createMemoryFinanceService(),
      undefined,
      createMemorySavingsService(),
      scoreService,
    );
    await screen.findByRole("textbox", { name: "Aufgabe für heute" });

    expect(preview).toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(saveComponents).not.toHaveBeenCalled();
    expect(setEnabled).not.toHaveBeenCalled();
  });
});

describe("TodayPage – Plandatum und Frist", () => {
  it("does not present a task that only carries a deadline as planned for today", async () => {
    renderPage(
      createServices({
        tasks: [
          createTask("t-deadline-only", { dueAt: "2026-08-04T16:00:00.000Z" }),
        ],
      }),
    );

    // Vorher las `describeTask` nur `plannedDate` und behauptete deshalb
    // „Für heute geplant“ für eine Aufgabe, die nie eingeplant wurde.
    expect(await screen.findByText("Frist ohne Plandatum")).toBeInTheDocument();
    expect(screen.queryByText("Für heute geplant")).not.toBeInTheDocument();
  });

  it("names which of the two dates has passed", async () => {
    renderPage(
      createServices({
        tasks: [
          createTask("t-plan-elapsed", { plannedDate: "2026-08-03" }),
          createTask("t-deadline-elapsed", {
            dueAt: "2026-08-02T10:00:00.000Z",
          }),
        ],
      }),
    );

    expect(
      await screen.findByText("Plandatum verstrichen"),
    ).toBeInTheDocument();
    expect(screen.getByText("Frist verstrichen")).toBeInTheDocument();
    expect(screen.queryByText("Überfällig")).not.toBeInTheDocument();
  });

  it("keeps the high priority hint next to the timing statement", async () => {
    renderPage(
      createServices({
        tasks: [
          createTask("t-priority", {
            plannedDate: "2026-08-04",
            priority: "high",
          }),
        ],
      }),
    );

    expect(
      await screen.findByText("Für heute geplant · Hohe Priorität"),
    ).toBeInTheDocument();
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
    name: `Routine ${id}`,
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
    listEntriesByHabit: vi.fn(
      async (range?: { from?: string; to?: string }) => {
        const grouped = new Map<string, HabitEntry[]>();
        for (const entry of habitEntries) {
          if (range?.from !== undefined && entry.localDate < range.from)
            continue;
          if (range?.to !== undefined && entry.localDate > range.to) continue;
          grouped.set(entry.habitId, [
            ...(grouped.get(entry.habitId) ?? []),
            entry,
          ]);
        }
        return grouped;
      },
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
