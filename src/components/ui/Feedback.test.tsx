import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { Toast } from "./Toast";

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

describe("Dialog", () => {
  it("is labelled and closes through Escape or its close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog onClose={onClose} open title="Änderung bestätigen">
        <p>Inhalt</p>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Änderung bestätigen",
    });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Dialog schließen" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("feedback components", () => {
  it("uses assertive semantics only for error toasts", () => {
    const { rerender } = render(<Toast message="Gespeichert" tone="success" />);
    expect(screen.getByRole("status")).toHaveTextContent("Gespeichert");

    rerender(<Toast message="Speichern fehlgeschlagen" tone="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Speichern fehlgeschlagen",
    );
  });

  it("labels skeleton loading and explains empty states", () => {
    render(
      <>
        <Skeleton label="Liste wird geladen" lines={2} />
        <EmptyState
          action={<Button>Eintrag anlegen</Button>}
          description="Beginne mit einem synthetischen Beispiel."
          title="Noch keine Einträge"
        />
      </>,
    );

    expect(
      screen.getByRole("status", { name: "Liste wird geladen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Noch keine Einträge");
  });
});
