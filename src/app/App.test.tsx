import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { themeStorageKey } from "./theme/theme-preference";
import { App } from "./App";
import { appRoutes } from "./router";

const routeCases = [
  ["/", "Heute"],
  ["/planen/aufgaben", "Aufgaben"],
  ["/planen/ziele", "Ziele"],
  ["/routinen/uebersicht", "Routinen"],
  ["/routinen/journal", "Journal"],
  ["/geld", "Geld"],
  ["/auswertung/ueberblick", "Auswertung"],
  ["/auswertung/wochenrueckblick", "Wochenrückblick"],
  ["/einstellungen", "Einstellungen"],
  ["/komponenten", "Komponenten"],
  ["/gibt-es-nicht", "Diese Seite gibt es nicht."],
] as const;

/**
 * Jeder Pfad aus der Zeit vor den vier Bereichen mit dem Ziel, auf dem er
 * landen muss. Lesezeichen, Verlauf und PWA-Verknüpfungen tragen diese Pfade;
 * ein toter Link kostet Vertrauen in eine App, die sonst nie etwas verliert.
 */
const redirectCases = [
  ["/aufgaben", "Aufgaben"],
  ["/ziele", "Ziele"],
  ["/gewohnheiten", "Routinen"],
  ["/journal", "Journal"],
  ["/finanzen", "Geld"],
  ["/insights", "Auswertung"],
  ["/wochenrueckblick", "Wochenrückblick"],
] as const;

/** Die Bereichseinstiege führen auf ihren ersten Unterbereich. */
const areaEntryCases = [
  ["/planen", "Aufgaben"],
  ["/routinen", "Routinen"],
  ["/auswertung", "Auswertung"],
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

  it.each(redirectCases)(
    "keeps %s reachable and lands on %s",
    async (path, heading) => {
      const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
      render(<App router={router} />);

      expect(
        await screen.findByRole("heading", { level: 1, name: heading }),
      ).toBeInTheDocument();
      // Der alte Pfad bleibt nicht in der Adresse stehen.
      expect(router.state.location.pathname).not.toBe(path);
    },
  );

  it.each(areaEntryCases)("opens %s on %s", async (path, heading) => {
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
