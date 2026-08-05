import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PersistenceError } from "../../../db/errors";
import type { CalendarDay } from "../../../lib/dates/date-values";
import type { Habit, HabitDetails, HabitEntry } from "../model";
import { isHabitEligibleOn } from "../schedule";
import type { HabitService } from "../service";
import { HabitsPage } from "./HabitsPage";

const fixedNow = new Date("2026-08-04T10:00:00.000Z");
const baseInstant = "2026-08-01T08:00:00.000Z";
const dailyHabitId = "00000000-0000-4000-8000-000000001101";
const weekdayHabitId = "00000000-0000-4000-8000-000000001102";

function renderPage(service: HabitService) {
  return render(
    <HabitsPage
      now={() => fixedNow}
      service={service}
      timeZone="Europe/Berlin"
    />,
  );
}

describe("HabitsPage", () => {
  it("creates a habit and shows it as due today", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService();
    renderPage(service);

    await screen.findByRole("heading", { level: 2, name: "Heute fällig" });
    await user.click(screen.getByRole("button", { name: "Neue Gewohnheit" }));
    await user.type(
      screen.getByRole("textbox", { name: /Name/ }),
      "Wasser trinken",
    );
    await user.click(
      screen.getByRole("button", { name: "Gewohnheit anlegen" }),
    );

    expect(
      await screen.findByRole("heading", { level: 3, name: "Wasser trinken" }),
    ).toBeInTheDocument();
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Wasser trinken",
        schedule: { kind: "daily" },
        startDate: "2026-08-04",
      }),
    );
  });

  it("records and reopens a check-in with a single primary action", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService([createDailyHabit()]);
    renderPage(service);

    await user.click(
      await screen.findByRole("button", {
        name: "„Morgenroutine“ heute erledigen",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Heute schon erfasst",
      }),
    ).toBeInTheDocument();
    expect(service.checkIn).toHaveBeenCalledWith(
      dailyHabitId,
      "2026-08-04",
      "done",
    );
    const card = screen.getByRole("article", { name: "Morgenroutine" });
    expect(within(card).getByText("Erledigt")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "„Morgenroutine“ heute wieder öffnen",
      }),
    );

    expect(
      await screen.findByRole("button", {
        name: "„Morgenroutine“ heute erledigen",
      }),
    ).toBeInTheDocument();
  });

  it("separates not-due days from open days in the week view", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService([createWeekdayHabit()]);
    renderPage(service);

    await screen.findByRole("heading", { level: 2, name: "Heute fällig" });
    await user.click(screen.getByRole("tab", { name: /^Woche/ }));

    const table = await screen.findByRole("table");
    expect(
      within(table).getByRole("button", {
        name: "Rücken dehnen am 3. August 2026: Offen. Als erledigt eintragen",
      }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("button", { name: /4\. August 2026/ }),
    ).not.toBeInTheDocument();
    // Die Zelle nennt Tag und Zustand in einem Text, damit der Zustand ohne
    // Farbe lesbar bleibt.
    expect(
      within(table).getAllByText(/: Nicht fällig$/).length,
    ).toBeGreaterThan(0);

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
    expect(
      await within(await screen.findByRole("table")).findByRole("button", {
        name: "Rücken dehnen am 3. August 2026: Erledigt. Check-in entfernen",
      }),
    ).toBeInTheDocument();
  });

  it("explains streaks, rate, period and calculation basis", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService(
      [createDailyHabit()],
      [
        createEntry("2026-08-01", "done"),
        createEntry("2026-08-02", "done"),
        createEntry("2026-08-03", "skipped"),
      ],
    );
    renderPage(service);

    await screen.findByRole("heading", { level: 2, name: "Heute fällig" });
    await user.click(screen.getByRole("tab", { name: /^Fortschritt/ }));
    await user.selectOptions(
      await screen.findByRole("combobox", { name: /Zeitraum/ }),
      "last7Days",
    );

    const card = screen.getByRole("article", { name: "Morgenroutine" });
    expect(within(card).getByText("50 %")).toBeInTheDocument();
    expect(within(card).getByText("0 Tage")).toBeInTheDocument();
    expect(within(card).getByText("2 Tage")).toBeInTheDocument();
    expect(
      within(card).getByText("Zeitraum: 01.08.2026 bis 04.08.2026"),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        /2 von 4 geplanten Tagen erledigt, 1 übersprungen/,
      ),
    ).toBeInTheDocument();
  });

  it("restores a removed check-in including its note through undo", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService(
      [createDailyHabit()],
      [
        {
          ...createEntry("2026-08-04", "done"),
          note: "Kurz notiert",
        },
      ],
    );
    renderPage(service);

    await user.click(
      await screen.findByRole("button", {
        name: "„Morgenroutine“ heute wieder öffnen",
      }),
    );
    expect(
      await screen.findByText(
        "Der Tag ist wieder offen. Der Check-in wurde entfernt.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rückgängig" }));

    expect(
      await screen.findByText("Der Check-in wurde wiederhergestellt."),
    ).toBeInTheDocument();
    expect(service.checkIn).toHaveBeenCalledWith(
      dailyHabitId,
      "2026-08-04",
      "done",
      "Kurz notiert",
    );
    expect(
      screen.getByRole("button", {
        name: "„Morgenroutine“ heute wieder öffnen",
      }),
    ).toBeInTheDocument();
  });

  it("restores an archived habit through the undo action", async () => {
    const user = userEvent.setup();
    const service = createMemoryHabitService([createDailyHabit()]);
    renderPage(service);

    await user.click(
      await screen.findByRole("button", {
        name: "„Morgenroutine“ archivieren",
      }),
    );

    expect(
      await screen.findByText(
        "Die Gewohnheit wurde archiviert. Die Check-ins bleiben erhalten.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Morgenroutine")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rückgängig" }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Morgenroutine" }),
    ).toBeInTheDocument();
    expect(service.restore).toHaveBeenCalledWith(dailyHabitId);
  });
});

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
