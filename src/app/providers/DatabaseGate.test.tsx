import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseLifecycle } from "../../db/lifecycle";
import { DatabaseGate } from "./DatabaseGate";

describe("DatabaseGate", () => {
  it("does not show the app before the database is ready", async () => {
    let resolveOpen: (() => void) | undefined;
    const lifecycle = createLifecycle({
      open: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveOpen = resolve;
          }),
      ),
    });

    render(
      <DatabaseGate lifecycle={lifecycle}>
        <h1>Heute</h1>
      </DatabaseGate>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Lokale Daten werden vorbereitet …",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Heute" }),
    ).not.toBeInTheDocument();

    resolveOpen?.();
    expect(
      await screen.findByRole("heading", { name: "Heute" }),
    ).toBeInTheDocument();
  });

  it("keeps the app blocked after failure and allows a retry", async () => {
    const user = userEvent.setup();
    const lifecycle = createLifecycle({
      open: vi
        .fn()
        .mockRejectedValueOnce(new Error("private fixture content"))
        .mockResolvedValueOnce(undefined),
    });

    render(
      <DatabaseGate lifecycle={lifecycle}>
        <h1>Heute</h1>
      </DatabaseGate>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Die lokalen Daten konnten nicht aktualisiert werden.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("private fixture content"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Heute" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(
      await screen.findByRole("heading", { name: "Heute" }),
    ).toBeInTheDocument();
    expect(lifecycle.open).toHaveBeenCalledTimes(2);
  });

  it("requires confirmation before the explicit local reset", async () => {
    const user = userEvent.setup();
    const reloadAfterReset = vi.fn();
    const lifecycle = createLifecycle({
      open: vi.fn().mockRejectedValue(new Error("upgrade failed")),
      reset: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <DatabaseGate lifecycle={lifecycle} reloadAfterReset={reloadAfterReset}>
        <h1>Heute</h1>
      </DatabaseGate>,
    );

    await screen.findByRole("heading", {
      name: "Die lokalen Daten konnten nicht aktualisiert werden.",
    });
    await user.click(
      screen.getByRole("button", { name: "Lokale Daten zurücksetzen" }),
    );

    expect(lifecycle.reset).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", {
        name: "Lokale Daten wirklich zurücksetzen?",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Endgültig zurücksetzen" }),
    );
    expect(lifecycle.reset).toHaveBeenCalledOnce();
    expect(reloadAfterReset).toHaveBeenCalledOnce();
  });
});

function createLifecycle(
  overrides: Partial<DatabaseLifecycle>,
): DatabaseLifecycle {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
