import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PersistenceError } from "../../../db/errors";
import type { GoalLinkService } from "../../goals/link-service";
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
    await user.click(screen.getByRole("button", { name: "Neue Routine" }));
    await user.type(
      screen.getByRole("textbox", { name: /Name/ }),
      "Wasser trinken",
    );
    await user.click(screen.getByRole("button", { name: "Routine anlegen" }));

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

    // Das Wochendiagramm bringt seine Werte als eigene Tabelle mit; gemeint
    // ist hier das Raster.
    const table = await screen.findByRole("table", {
      name: /Zeichen und als Text in der Zelle/,
    });
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
      await within(
        await screen.findByRole("table", {
          name: /Zeichen und als Text in der Zelle/,
        }),
      ).findByRole("button", {
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
    // Vier geplante Tage, einer übersprungen: 2 von 3 zählenden Tagen.
    expect(within(card).getByText("67 %")).toBeInTheDocument();
    // Der übersprungene Tag bricht die Serie nicht: aktuelle und beste Serie
    // sind beide zwei Tage.
    expect(within(card).getAllByText("2 Tage")).toHaveLength(2);
    expect(
      within(card).getByText("Zeitraum: 01.08.2026 bis 04.08.2026"),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        /2 von 3 zählenden Tagen erledigt, bei 4 geplanten Tagen und 1 übersprungen/,
      ),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/Ein geplanter Tag ohne Eintrag gilt als nicht/),
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
        "Die Routine wurde archiviert. Die Check-ins bleiben erhalten.",
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

describe("HabitsPage – Zielbezug", () => {
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

  async function openProgressTab(goalLinks: GoalLinkService, habit: Habit) {
    const user = userEvent.setup();
    render(
      <HabitsPage
        goalLinks={goalLinks}
        now={() => fixedNow}
        service={createMemoryHabitService([habit])}
        timeZone="Europe/Berlin"
      />,
    );
    await screen.findByRole("heading", { level: 2, name: "Heute fällig" });
    await user.click(screen.getByRole("tab", { name: /^Fortschritt/ }));
    return screen.getByRole("article", { name: habit.name });
  }

  it("names the linked goal next to the schedule", async () => {
    const card = await openProgressTab(
      createGoalLinks([["goal-1", "Synthetisches Ziel"]]),
      { ...createDailyHabit(), goalId: "goal-1" },
    );

    await waitFor(() => {
      expect(
        within(card).getByText(/Ziel: Synthetisches Ziel/),
      ).toBeInTheDocument();
    });
  });

  // Ohne Verknüpfung bleibt die Karte, wie sie war.
  it("adds nothing for a habit without a link", async () => {
    const card = await openProgressTab(
      createGoalLinks([["goal-1", "Synthetisches Ziel"]]),
      createDailyHabit(),
    );

    expect(within(card).queryByText(/Ziel:/)).not.toBeInTheDocument();
  });

  it("stays silent when the linked goal cannot be resolved", async () => {
    const card = await openProgressTab(
      createGoalLinks([["goal-1", "Synthetisches Ziel"]]),
      { ...createDailyHabit(), goalId: "goal-weg" },
    );

    expect(within(card).queryByText(/Ziel:/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/goal-weg/)).not.toBeInTheDocument();
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
