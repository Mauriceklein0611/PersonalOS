import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Task } from "../model";
import type { TaskQueryContext } from "../queries";
import { TaskRow } from "./TaskRow";

const context: TaskQueryContext = { today: "2026-08-10", timeZone: "UTC" };

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    createdAt: "2026-08-01T08:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000101",
    priority: "normal",
    status: "open",
    title: "Synthetische Aufgabe",
    updatedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  } as Task;
}

function renderRow(
  task: Task,
  handlers: Partial<Record<string, () => void>> = {},
) {
  const spies = {
    onArchive: vi.fn(),
    onCancel: vi.fn(),
    onComplete: vi.fn(),
    onEdit: vi.fn(),
    onReopen: vi.fn(),
    ...handlers,
  };

  render(
    <ul>
      <TaskRow busy={false} context={context} task={task} {...spies} />
    </ul>,
  );

  return spies;
}

describe("TaskRow", () => {
  it("shows exactly one visible action for an open task", async () => {
    renderRow(createTask());

    expect(
      screen.getByRole("button", {
        name: "„Synthetische Aufgabe“ abschließen",
      }),
    ).toBeVisible();

    /*
     * Vier gleich schwere Schaltflächen je Aufgabe sind keine Auswahl,
     * sondern eine Suchaufgabe. Sichtbar ist deshalb nur die primäre.
     */
    for (const label of ["bearbeiten", "abbrechen", "archivieren"]) {
      expect(
        screen.queryByRole("button", {
          name: `„Synthetische Aufgabe“ ${label}`,
          hidden: true,
        }),
      ).toBeNull();
    }
  });

  it("keeps planned date, deadline and estimate apart", () => {
    renderRow(
      createTask({
        dueAt: "2026-08-12T09:00:00.000Z",
        estimatedMinutes: 30,
        plannedDate: "2026-08-11",
      }),
    );

    expect(screen.getByText(/^Geplant: /)).toBeInTheDocument();
    expect(screen.getByText(/^Frist: /)).toBeInTheDocument();
    expect(screen.getByText("30 Min.")).toBeInTheDocument();
  });

  it("runs a secondary action and returns focus to its toggle", async () => {
    const user = userEvent.setup();
    const spies = renderRow(createTask());
    const toggle = screen.getByLabelText(
      "Weitere Aktionen für „Synthetische Aufgabe“",
    );

    await user.click(toggle);
    await user.click(
      screen.getByRole("button", { name: "„Synthetische Aufgabe“ bearbeiten" }),
    );

    expect(spies.onEdit).toHaveBeenCalledTimes(1);
    // Ohne Rückgabe landete der Fokus im Nichts: Die Zeile verschwindet.
    expect(toggle).toHaveFocus();
    expect(
      screen.queryByRole("button", {
        name: "„Synthetische Aufgabe“ bearbeiten",
        hidden: true,
      }),
    ).toBeNull();
  });

  /*
   * Zwei Tabulatorschritte je Zeile, mehr nicht: primäre Aktion, dann die
   * Ausklappfläche. Dass Eingabe und Leertaste sie öffnen, bringt
   * `<summary>` mit; geprüft wird das im echten Browser in
   * `e2e/tasks.spec.ts`, weil jsdom die native Umschaltung nicht auslöst.
   */
  it("reaches the actions toggle in two tab steps", async () => {
    const user = userEvent.setup();
    renderRow(createTask());

    await user.tab();
    expect(
      screen.getByRole("button", {
        name: "„Synthetische Aufgabe“ abschließen",
      }),
    ).toHaveFocus();

    await user.tab();
    expect(
      screen.getByLabelText("Weitere Aktionen für „Synthetische Aufgabe“"),
    ).toHaveFocus();
  });

  it("offers reopening instead of completing once a task is done", () => {
    const spies = renderRow(createTask({ status: "completed" }));

    expect(
      screen.getByRole("button", {
        name: "„Synthetische Aufgabe“ wieder öffnen",
      }),
    ).toBeVisible();
    expect(screen.getByText("Erledigt")).toBeInTheDocument();
    expect(spies.onComplete).not.toHaveBeenCalled();
  });
});
