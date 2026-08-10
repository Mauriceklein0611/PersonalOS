import { render, screen, within } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from "react-router";
import { describe, expect, it } from "vitest";

import { MobileNavigation } from "./MobileNavigation";

function Shell() {
  return (
    <>
      <button type="button">Außerhalb</button>
      <MobileNavigation />
    </>
  );
}

const routes: RouteObject[] = [
  { path: "/", Component: Shell },
  { path: "/planen/ziele", Component: Shell },
];

function renderNavigation() {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ["/"] })}
    />,
  );
}

describe("MobileNavigation", () => {
  /*
   * Vier Bereiche, mehr nicht. Vorher standen hier vier von acht Punkten und
   * ein Überlaufmenü — ausgerechnet die Finanzen lagen dahinter, obwohl sie
   * eine der häufigsten Erfassungsaktionen tragen.
   */
  it("offers exactly the four areas, each with a label", () => {
    renderNavigation();

    const navigation = screen.getByRole("navigation", {
      name: "Hauptnavigation mobil",
    });
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Heute", "Planen", "Routinen", "Geld"]);
  });

  it("keeps no overflow menu behind which an area could hide", () => {
    renderNavigation();

    const navigation = screen.getByRole("navigation", {
      name: "Hauptnavigation mobil",
    });
    expect(within(navigation).queryByRole("button")).toBeNull();
  });

  it("uses one term per area and keeps the icon out of the accessible name", () => {
    renderNavigation();

    expect(screen.getByRole("link", { name: "Routinen" })).toBeInTheDocument();
    // Ein Begriff je Bereich: „Gewohnheiten" gibt es nicht mehr.
    expect(screen.queryByRole("link", { name: "Gewohnheiten" })).toBeNull();
    // Das Symbol ist Dekoration; der Name kommt aus der Beschriftung.
    expect(
      screen.getByRole("link", { name: "Routinen" }).querySelector("svg"),
    ).toHaveAttribute("aria-hidden", "true");
  });
});
