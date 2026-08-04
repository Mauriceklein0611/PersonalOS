import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { themeStorageKey } from "./theme/theme-preference";
import { App } from "./App";
import { appRoutes } from "./router";

const routeCases = [
  ["/", "Heute"],
  ["/aufgaben", "Aufgaben"],
  ["/gewohnheiten", "Gewohnheiten"],
  ["/journal", "Journal"],
  ["/ziele", "Ziele"],
  ["/finanzen", "Finanzen"],
  ["/insights", "Insights"],
  ["/einstellungen", "Einstellungen"],
  ["/gibt-es-nicht", "Diese Seite gibt es nicht."],
] as const;

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(<App router={router} />);
}

describe("App shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
  });

  it.each(routeCases)("lazy-loads %s as %s", async (path, heading) => {
    renderRoute(path);

    expect(
      await screen.findByRole("heading", { level: 1, name: heading }),
    ).toBeInTheDocument();
  });

  it("supports keyboard navigation and marks the active route", async () => {
    const user = userEvent.setup();
    renderRoute("/");

    await screen.findByRole("heading", { name: "Heute" });
    const tasksLink = screen.getAllByRole("link", { name: "Aufgaben" })[0];

    tasksLink?.focus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("heading", { name: "Aufgaben" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Aufgaben" })
        .some((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
  });

  it("persists and applies a selected theme immediately", async () => {
    const user = userEvent.setup();
    renderRoute("/");

    const themeSelect = await screen.findByLabelText("Farbschema");
    await user.selectOptions(themeSelect, "dark");

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(themeStorageKey)).toBe("dark");
  });

  it("shows the offline shell status without blocking navigation", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    renderRoute("/");

    expect(await screen.findByText("Offline")).toHaveAttribute(
      "role",
      "status",
    );

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });
});
