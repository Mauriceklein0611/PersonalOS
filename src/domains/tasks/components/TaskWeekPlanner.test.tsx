import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Task } from "../model";
import type { TaskQueryContext } from "../queries";
import { buildTaskWeekPlan } from "../week-plan";
import { TaskWeekPlanner } from "./TaskWeekPlanner";

const context: TaskQueryContext = {
  timeZone: "Europe/Berlin",
  today: "2026-08-04",
};

const open = createTask("01", "Unterlagen sortieren", {
  plannedDate: "2026-08-04",
});
const done = createTask("02", "Rechnung geprüft", {
  completedAt: "2026-08-03T10:00:00.000Z",
  plannedDate: "2026-08-03",
  status: "completed",
});

function renderPlanner(
  overrides: Partial<Parameters<typeof TaskWeekPlanner>[0]> = {},
) {
  const handlers = {
    onArchive: vi.fn(),
    onCancel: vi.fn(),
    onComplete: vi.fn(),
    onEdit: vi.fn(),
    onReopen: vi.fn(),
    onSelectDay: vi.fn(),
  };
  render(
    <TaskWeekPlanner
      context={context}
      goalTitles={new Map()}
      plan={buildTaskWeekPlan({ tasks: [open, done], today: context.today })}
      selectedDay="2026-08-04"
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("TaskWeekPlanner", () => {
  it("shows seven days with counter and denominator", () => {
    renderPlanner();

    // Jeder Tagesbereich ist ein benannter Bereich, kein anonymer Kasten.
    expect(screen.getAllByRole("region")).toHaveLength(7);

    const section = screen.getByRole("region", {
      name: "Dienstag, 04.08.2026 (heute)",
    });
    expect(within(section).getByText("0 von 1")).toBeInTheDocument();
    // Die Aufgabe steht unter ihrem Tag, also eine Ebene tiefer.
    expect(
      within(section).getByRole("heading", {
        level: 3,
        name: "Unterlagen sortieren",
      }),
    ).toBeInTheDocument();
  });

  it("names a day without a plan instead of showing zero per cent", () => {
    renderPlanner();

    const wednesday = screen.getByRole("region", {
      name: "Mittwoch, 05.08.2026",
    });
    expect(within(wednesday).getByText("Keine Angabe")).toBeInTheDocument();
    expect(
      within(wednesday).getByText("Für diesen Tag ist nichts geplant."),
    ).toBeInTheDocument();
    expect(within(wednesday).queryByText("0 %")).not.toBeInTheDocument();
  });

  it("names the whole week and keeps inbox tasks out of it", () => {
    renderPlanner();

    expect(
      screen.getByRole("note", { name: "Zweck dieser Ansicht" }),
    ).toHaveTextContent("Was habe ich an welchem Tag eingeplant?");
    expect(
      screen.getByText(
        /Woche vom 03\.08\.2026 bis 09\.08\.2026: 1 von 2 geplanten Aufgaben erledigt\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aufgaben ohne Plandatum bleiben in der Inbox\./),
    ).toBeInTheDocument();
  });

  it("reaches every day through the weekday strip", async () => {
    const user = userEvent.setup();
    const handlers = renderPlanner();

    const strip = screen.getByRole("list", { name: "Wochentag wählen" });
    expect(within(strip).getAllByRole("button")).toHaveLength(7);

    // Der Streifen nennt je Tag den Stand, nicht nur die Zahl.
    await user.click(
      within(strip).getByRole("button", {
        name: "Sonntag, 09.08.2026: nichts geplant",
      }),
    );
    expect(handlers.onSelectDay).toHaveBeenCalledWith("2026-08-09");

    expect(
      within(strip).getByRole("button", {
        name: "Montag, 03.08.2026: 1 von 1 erledigt",
      }),
    ).toBeInTheDocument();
  });

  it("marks the selected day for assistive technology and for the layout", () => {
    renderPlanner({ selectedDay: "2026-08-06" });

    const strip = screen.getByRole("list", { name: "Wochentag wählen" });
    const selected = within(strip).getByRole("button", {
      name: /Donnerstag, 06\.08\.2026/,
    });
    expect(selected).toHaveAttribute("aria-current", "date");

    expect(
      screen.getByRole("region", { name: "Donnerstag, 06.08.2026" }),
    ).toHaveAttribute("data-selected", "true");
  });

  it("keeps the primary action on the row and reports it", async () => {
    const user = userEvent.setup();
    const handlers = renderPlanner();

    await user.click(
      screen.getByRole("button", {
        name: "„Unterlagen sortieren“ abschließen",
      }),
    );
    expect(handlers.onComplete).toHaveBeenCalledWith(open);
  });
});

function createTask(
  suffix: string,
  title: string,
  overrides: Partial<Task>,
): Task {
  return {
    id: `00000000-0000-4000-8000-0000000008${suffix}`,
    createdAt: "2026-08-03T09:00:00.000Z",
    updatedAt: "2026-08-03T09:00:00.000Z",
    priority: "normal",
    status: "open",
    title,
    ...overrides,
  };
}
