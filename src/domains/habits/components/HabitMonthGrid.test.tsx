import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildHabitMonthView } from "../month-view";
import { createHabit, createHabitEntry, habitId } from "../test-factories";
import { HabitMonthGrid } from "./HabitMonthGrid";

const habit = createHabit({ name: "Rücken dehnen", startDate: "2026-08-02" });

function renderGrid(onToggle = vi.fn()) {
  const view = buildHabitMonthView({
    entriesByHabit: new Map([
      [
        habitId,
        [
          createHabitEntry("2026-08-02"),
          createHabitEntry("2026-08-03", "skipped"),
        ],
      ],
    ]),
    habits: [habit],
    month: "2026-08",
    today: "2026-08-05",
  });
  render(<HabitMonthGrid onToggle={onToggle} view={view} />);
  return { onToggle, view };
}

describe("HabitMonthGrid", () => {
  it("names every cell state as text next to its sign", () => {
    renderGrid();
    const grid = screen.getByRole("table");

    // Vor dem Startdatum gab es nichts zu tun.
    expect(
      within(grid).getByText(
        "Rücken dehnen am 1. August 2026: Außerhalb des Zeitraums",
      ),
    ).toBeInTheDocument();
    expect(
      within(grid).getByRole("button", {
        name: "Rücken dehnen am 2. August 2026: Erledigt. Check-in entfernen",
      }),
    ).toBeInTheDocument();
    expect(
      within(grid).getByRole("button", {
        name: "Rücken dehnen am 3. August 2026: Übersprungen. Als erledigt eintragen",
      }),
    ).toBeInTheDocument();
    expect(
      within(grid).getByRole("button", {
        name: "Rücken dehnen am 4. August 2026: Offen. Als erledigt eintragen",
      }),
    ).toBeInTheDocument();
    // Ein zukünftiger fälliger Tag ist kein Misserfolg und keine Schaltfläche.
    expect(
      within(grid).getByText("Rücken dehnen am 6. August 2026: Später fällig"),
    ).toBeInTheDocument();
    expect(
      within(grid).queryByRole("button", { name: /6\. August 2026/ }),
    ).not.toBeInTheDocument();
  });

  it("names counter, denominator and rate per routine and per day", () => {
    renderGrid();

    // 2. bis 5. August: vier geplante Tage, einer übersprungen, einer erledigt.
    expect(screen.getByText("1 von 3 · 33 %")).toBeInTheDocument();
    expect(
      screen.getByText("2. August 2026: 1 von 1 zählenden Einheiten, 100 %"),
    ).toBeInTheDocument();
    // Der übersprungene Tag hat keinen Nenner und deshalb keine Quote.
    expect(
      screen.getByText("3. August 2026: Keine Angabe"),
    ).toBeInTheDocument();
  });

  it("shows no rate where every planned day was skipped", () => {
    const skippedOnly = createHabit({
      name: "Rücken dehnen",
      startDate: "2026-08-04",
    });
    const view = buildHabitMonthView({
      entriesByHabit: new Map([
        [habitId, [createHabitEntry("2026-08-04", "skipped")]],
      ]),
      habits: [skippedOnly],
      month: "2026-08",
      today: "2026-08-04",
    });
    render(<HabitMonthGrid onToggle={vi.fn()} view={view} />);

    // Ein übersprungener Tag nimmt sich aus dem Nenner: „0 von 0“ wäre eine
    // Zahl, die nichts misst.
    expect(screen.getByText("Keine Angabe")).toBeInTheDocument();
    expect(screen.queryByText(/0 von 0/)).not.toBeInTheDocument();
  });

  it("reports a click with the state of the day", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderGrid();

    await user.click(
      screen.getByRole("button", {
        name: "Rücken dehnen am 4. August 2026: Offen. Als erledigt eintragen",
      }),
    );
    expect(onToggle).toHaveBeenCalledWith(habit, "2026-08-04", false);

    await user.click(
      screen.getByRole("button", {
        name: "Rücken dehnen am 2. August 2026: Erledigt. Check-in entfernen",
      }),
    );
    expect(onToggle).toHaveBeenLastCalledWith(habit, "2026-08-02", true);
  });

  it("groups the columns into weeks", () => {
    renderGrid();

    expect(screen.getByText("Woche ab 27. Juli 2026")).toBeInTheDocument();
    expect(screen.getByText("Woche ab 3. August 2026")).toBeInTheDocument();
    // Der erste Spaltenkopf einer Woche trägt die Grenze auch strukturell.
    expect(
      document.querySelectorAll('.habit-month-table [data-week-start="true"]')
        .length,
    ).toBeGreaterThan(0);
  });
});
