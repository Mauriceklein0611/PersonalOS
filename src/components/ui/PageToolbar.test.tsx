import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./Button";
import { PageToolbar } from "./PageToolbar";

describe("PageToolbar", () => {
  it("combines the page question, period and actions without a tablist", () => {
    render(
      <PageToolbar
        actions={
          <>
            <Button variant="secondary">Heute</Button>
            <Button>Neue Routine</Button>
          </>
        }
        description="Check-ins und Fortschritt in einer Arbeitsfläche."
        eyebrow="Routinen"
        period="August 2026"
        surface="work"
        title="Routinen"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Routinen" }),
    ).toHaveAttribute("id", "page-title");
    expect(screen.getByText("Zeitraum")).toBeVisible();
    expect(screen.getByText("August 2026")).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Seitenaktionen" }),
    ).toContainElement(screen.getByRole("button", { name: "Heute" }));
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("marks the chosen surface and supports a page-specific heading id", () => {
    const { container } = render(
      <PageToolbar
        headingId="journal-title"
        surface="editor"
        title="Journal"
      />,
    );

    expect(container.querySelector("header")).toHaveAttribute(
      "data-surface",
      "editor",
    );
    expect(screen.getByRole("heading", { name: "Journal" })).toHaveAttribute(
      "id",
      "journal-title",
    );
  });
});
