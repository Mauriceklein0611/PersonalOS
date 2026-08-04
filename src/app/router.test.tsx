import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, type RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { DomainErrorBoundary } from "../components/feedback/DomainErrorBoundary";
import { App } from "./App";
import { AppLayout } from "./layouts/AppLayout";

function FailingRoute(): never {
  throw new Error("synthetischer Darstellungsfehler");
}

function WorkingRoute() {
  return <h1>Aufgaben</h1>;
}

const routes: RouteObject[] = [
  {
    path: "/",
    Component: AppLayout,
    children: [
      {
        index: true,
        Component: FailingRoute,
        ErrorBoundary: DomainErrorBoundary,
      },
      {
        path: "aufgaben",
        Component: WorkingRoute,
        ErrorBoundary: DomainErrorBoundary,
      },
    ],
  },
];

describe("route error isolation", () => {
  it("keeps the shell and the other domains usable when one route fails", async () => {
    const user = userEvent.setup();
    // React meldet einen abgefangenen Renderfehler zusätzlich auf der Konsole.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      render(
        <App router={createMemoryRouter(routes, { initialEntries: ["/"] })} />,
      );

      expect(
        await screen.findByText(
          "Dieser Bereich konnte nicht angezeigt werden.",
        ),
      ).toBeInTheDocument();

      const tasksLink = screen.getAllByRole("link", { name: "Aufgaben" })[0];
      expect(tasksLink).toBeDefined();
      await user.click(tasksLink!);

      expect(
        await screen.findByRole("heading", { level: 1, name: "Aufgaben" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Dieser Bereich konnte nicht angezeigt werden."),
      ).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
