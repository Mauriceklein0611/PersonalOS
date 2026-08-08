import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  { path: "/ziele", Component: Shell },
];

function renderNavigation() {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ["/"] })}
    />,
  );
}

describe("MobileNavigation", () => {
  it("uses one term per area and keeps the icon out of the accessible name", () => {
    renderNavigation();

    expect(
      screen.getByRole("link", { name: "Gewohnheiten" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Routinen" })).toBeNull();
    // Das Symbol ist Dekoration; der Name kommt aus der Beschriftung.
    expect(
      screen.getByRole("link", { name: "Gewohnheiten" }).querySelector("svg"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("moves the focus into the overflow menu and back to its trigger", async () => {
    const user = userEvent.setup();
    renderNavigation();

    const trigger = screen.getByRole("button", { name: "Mehr" });
    await user.click(trigger);

    expect(screen.getByRole("link", { name: "Ziele" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("link", { name: "Ziele" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes the overflow menu on a tap outside", async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.click(screen.getByRole("button", { name: "Mehr" }));
    expect(screen.getByRole("link", { name: "Ziele" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Außerhalb" }));

    expect(screen.queryByRole("link", { name: "Ziele" })).toBeNull();
  });

  it("closes the overflow menu when its trigger is pressed again", async () => {
    const user = userEvent.setup();
    renderNavigation();

    const trigger = screen.getByRole("button", { name: "Mehr" });
    await user.click(trigger);
    await user.click(trigger);

    expect(screen.queryByRole("link", { name: "Ziele" })).toBeNull();
  });
});
