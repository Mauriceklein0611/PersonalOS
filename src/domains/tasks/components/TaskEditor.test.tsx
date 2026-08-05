import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Task } from "../model";
import { TaskEditor } from "./TaskEditor";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});

const goalId = "00000000-0000-4000-8000-000000004101";

const task: Task = {
  createdAt: "2026-08-01T08:00:00.000Z",
  id: "00000000-0000-4000-8000-000000004201",
  priority: "normal",
  status: "open",
  title: "Synthetische Aufgabe",
  updatedAt: "2026-08-01T08:00:00.000Z",
};

describe("TaskEditor goal link", () => {
  it("saves the chosen goal reference", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <TaskEditor
        goalOptions={[{ id: goalId, title: "Synthetisches Ziel" }]}
        isSaving={false}
        onClose={() => {}}
        onSave={onSave}
        task={task}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Ziel" }), [
      goalId,
    ]);
    await user.click(
      screen.getByRole("button", { name: "Änderungen speichern" }),
    );

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ goalId }));
  });

  it("keeps a task without any goal reference", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <TaskEditor
        goalOptions={[{ id: goalId, title: "Synthetisches Ziel" }]}
        isSaving={false}
        onClose={() => {}}
        onSave={onSave}
        task={task}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Änderungen speichern" }),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.not.objectContaining({ goalId: expect.anything() }),
    );
  });

  it("removes an existing reference when the user picks no goal", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <TaskEditor
        goalOptions={[{ id: goalId, title: "Synthetisches Ziel" }]}
        isSaving={false}
        onClose={() => {}}
        onSave={onSave}
        task={{ ...task, goalId }}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Ziel" }), [
      "",
    ]);
    await user.click(
      screen.getByRole("button", { name: "Änderungen speichern" }),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.not.objectContaining({ goalId: expect.anything() }),
    );
  });
});
