import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlobalErrorBoundary } from "./GlobalErrorBoundary";

function BrokenView(): never {
  throw new Error("simulierter Renderfehler");
}

describe("GlobalErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a recovery state after a child render error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <GlobalErrorBoundary>
        <BrokenView />
      </GlobalErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "Etwas ist schiefgelaufen." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ansicht neu laden" }),
    ).toBeInTheDocument();
  });
});
