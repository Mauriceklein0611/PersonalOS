import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PersistenceError } from "../../../db/errors";
import type { CalendarDay } from "../../../lib/dates/date-values";
import type { GoalLinkService } from "../../goals/link-service";
import type { Habit, HabitDetails, HabitEntry } from "../model";
import { isHabitEligibleOn } from "../schedule";
import type { HabitService } from "../service";
import { HabitsPage } from "./HabitsPage";

const fixedNow = new Date("2026-08-04T10:00:00.000Z");
const baseInstant = "2026-08-01T08:00:00.000Z";
const dailyHabitId = "00000000-0000-4000-8000-000000001101";
const weekdayHabitId = "00000000-0000-4000-8000-000000001102";

function renderPage(
  service: HabitService,
  goalLinks: GoalLinkService = createGoalLinks([]),
) {
  return render(
    <HabitsPage
      goalLinks={goalLinks}
      now={() => fixedNow}
      service={service}
      timeZone="Europe/Berlin"
    />,
  );
}

describe("HabitsPage – eine Arbeitsfläche", () => {
  it("shows one monthly tracker without competing view tabs", async () => {
    renderPage(createMemoryHabitService([createDailyHabit()]));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Routinen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("Heute fällig")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("table", { name: /Routinen stehen in Zeilen/ }),
    ).toBeInTheDocument();
  });

  it("creates a routine directly from the shared toolbar", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService();
    renderPage(service);

    await user.click(
      await screen.findByRole("button", { name: "Neue Routine" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /Name/ }),
      "Wasser trinken",
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Routine anlegen" })).getByRole(
        "button",
        { name: "Routine anlegen" },
      ),
    );

    expect(await screen.findByText("Wasser trinken")).toBeInTheDocument();
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Wasser trinken",
        schedule: { kind: "daily" },
        startDate: "2026-08-04",
      }),
    );
  });

  it("records and reopens a check-in in the tracker", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService([createDailyHabit()]);
    renderPage(service);

    await user.click(
      await screen.findByRole("button", {
        name: "Morgenroutine am 4. August 2026: Offen. Als erledigt eintragen",
      }),
    );
    expect(service.checkIn).toHaveBeenCalledWith(
      dailyHabitId,
      "2026-08-04",
      "done",
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Morgenroutine am 4. August 2026: Erledigt. Check-in entfernen",
      }),
    );
    expect(service.reopenCheckIn).toHaveBeenCalledWith(
      dailyHabitId,
      "2026-08-04",
    );
  });

  it("keeps not-due days distinct and edits a past eligible day", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService([createWeekdayHabit()]);
    renderPage(service);

    const table = await screen.findByRole("table", {
      name: /Routinen stehen in Zeilen/,
    });
    expect(
      within(table).getByText("Rücken dehnen am 4. August 2026: Nicht fällig"),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("button", { name: /4\. August 2026/ }),
    ).not.toBeInTheDocument();

    await user.click(
      within(table).getByRole("button", {
        name: "Rücken dehnen am 3. August 2026: Offen. Als erledigt eintragen",
      }),
    );
    expect(service.checkIn).toHaveBeenCalledWith(
      weekdayHabitId,
      "2026-08-03",
      "done",
    );
  });

  it("shows the monthly rate inline and navigates the same surface", async () => {
    const user = userEvent.setup();
    renderPage(
      createMemoryHabitService(
        [createDailyHabit()],
        [
          createEntry("2026-08-01", "done"),
          createEntry("2026-08-02", "skipped"),
        ],
      ),
    );

    expect((await screen.findAllByText("33 %")).length).toBeGreaterThan(0);
    expect(screen.getByText("1 von 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vorheriger Monat" }));
    expect(screen.getByText("Juli 2026")).toBeInTheDocument();
    expect(
      screen.getByText("In diesem Monat war keine aktive Routine eingeplant."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nächster Monat" }),
    ).toBeEnabled();
  });

  it("offers skip, edit and archive behind one compact row action", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService([createDailyHabit()]);
    renderPage(service);

    await user.click(
      await screen.findByRole("button", { name: "„Morgenroutine“ verwalten" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Heute überspringen" }),
    );
    expect(service.checkIn).toHaveBeenCalledWith(
      dailyHabitId,
      "2026-08-04",
      "skipped",
    );
    expect(
      await screen.findByRole("button", {
        name: "Morgenroutine am 4. August 2026: Übersprungen. Als erledigt eintragen",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "„Morgenroutine“ verwalten" }),
    );
    await user.click(screen.getByRole("button", { name: "Archivieren" }));
    expect(
      await screen.findByText(
        "Die Routine wurde archiviert. Die Check-ins bleiben erhalten.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Morgenroutine")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(await screen.findByText("Morgenroutine")).toBeInTheDocument();
    expect(service.restore).toHaveBeenCalledWith(dailyHabitId);
  });

  it("restores a routine from the archive filter", async () => {
    const user = userEvent.setup();
    const archived = { ...createDailyHabit(), archivedAt: baseInstant };
    const service = createMemoryHabitService([archived]);
    renderPage(service);

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /Routinen anzeigen/ }),
      "archived",
    );
    expect(await screen.findByText("Morgenroutine")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "„Morgenroutine“ verwalten" }),
    );
    await user.click(screen.getByRole("button", { name: "Wiederherstellen" }));

    expect(service.restore).toHaveBeenCalledWith(dailyHabitId);
    expect(await screen.findByText("Nichts archiviert")).toBeInTheDocument();
  });

  it("shows a linked goal next to the routine progress", async () => {
    renderPage(
      createMemoryHabitService([{ ...createDailyHabit(), goalId: "goal-1" }]),
      createGoalLinks([["goal-1", "Synthetisches Ziel"]]),
    );

    await waitFor(() => {
      expect(screen.getByText("Ziel: Synthetisches Ziel")).toBeInTheDocument();
    });
  });
});

function createGoalLinks(titles: [string, string][]): GoalLinkService {
  return {
    countReferences: () => Promise.resolve({ habits: 0, tasks: 0 }),
    deleteGoalPermanently: () =>
      Promise.reject(new Error("not used by this test")),
    listGoalOptions: () =>
      Promise.resolve(titles.map(([id, title]) => ({ id, title }))),
    listGoalTitles: () => Promise.resolve(new Map(titles)),
    summarize: () => Promise.reject(new Error("not used by this test")),
  };
}

function createDailyHabit(): Habit {
  return {
    id: dailyHabitId,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    name: "Morgenroutine",
    schedule: { kind: "daily" },
    startDate: "2026-08-01",
  };
}

function createWeekdayHabit(): Habit {
  return {
    id: weekdayHabitId,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    name: "Rücken dehnen",
    schedule: { kind: "weekdays", days: [1, 3] },
    startDate: "2026-08-01",
  };
}

function createEntry(
  localDate: CalendarDay,
  status: HabitEntry["status"],
  habitId = dailyHabitId,
): HabitEntry {
  return {
    id: `00000000-0000-4000-8000-${localDate.replaceAll("-", "").padStart(12, "0")}`,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    habitId,
    localDate,
    status,
  };
}

function createMemoryHabitService(
  initialHabits: Habit[] = [],
  initialEntries: HabitEntry[] = [],
): HabitService {
  let habits = [...initialHabits];
  let entries = [...initialEntries];
  let nextId = 1200;

  const requireHabit = (id: string): Habit => {
    const habit = habits.find((candidate) => candidate.id === id);
    if (!habit) throw new PersistenceError("not-found");
    return habit;
  };
  const updateHabit = (id: string, patch: Partial<Habit>): Habit => {
    const updated = { ...requireHabit(id), ...patch, updatedAt: baseInstant };
    habits = habits.map((habit) => (habit.id === id ? updated : habit));
    return updated;
  };
  const nextEntityId = () =>
    `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;

  return {
    archive: vi.fn(async (id) => updateHabit(id, { archivedAt: baseInstant })),
    checkIn: vi.fn(async (habitId, localDate, status, note) => {
      const habit = requireHabit(habitId);
      if (
        habit.archivedAt !== undefined ||
        !isHabitEligibleOn(habit, localDate)
      ) {
        throw new PersistenceError("conflict");
      }
      const current = entries.find(
        (entry) => entry.habitId === habitId && entry.localDate === localDate,
      );
      const entry: HabitEntry = {
        ...(current ?? {
          id: nextEntityId(),
          createdAt: baseInstant,
          habitId,
          localDate,
        }),
        note,
        status,
        updatedAt: baseInstant,
      };
      entries = current
        ? entries.map((candidate) =>
            candidate.id === entry.id ? entry : candidate,
          )
        : [...entries, entry];
      return entry;
    }),
    create: vi.fn(async (details: HabitDetails) => {
      const habit: Habit = {
        ...details,
        id: nextEntityId(),
        createdAt: baseInstant,
        updatedAt: baseInstant,
      };
      habits = [...habits, habit];
      return habit;
    }),
    list: vi.fn(async (options) =>
      habits.filter(
        (habit) => options?.includeArchived || habit.archivedAt === undefined,
      ),
    ),
    listEntries: vi.fn(async (habitId) =>
      entries.filter((entry) => entry.habitId === habitId),
    ),
    listEntriesByHabit: vi.fn(async (range) => {
      const grouped = new Map<string, HabitEntry[]>();
      for (const entry of entries) {
        if (range?.from !== undefined && entry.localDate < range.from) continue;
        if (range?.to !== undefined && entry.localDate > range.to) continue;
        grouped.set(entry.habitId, [
          ...(grouped.get(entry.habitId) ?? []),
          entry,
        ]);
      }
      return grouped;
    }),
    reopenCheckIn: vi.fn(async (habitId, localDate) => {
      const remaining = entries.filter(
        (entry) => entry.habitId !== habitId || entry.localDate !== localDate,
      );
      const removed = remaining.length !== entries.length;
      entries = remaining;
      return removed;
    }),
    restore: vi.fn(async (id) => updateHabit(id, { archivedAt: undefined })),
    updateDetails: vi.fn(async (id, details) => updateHabit(id, details)),
  };
}
