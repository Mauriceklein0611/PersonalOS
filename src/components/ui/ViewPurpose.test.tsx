import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ViewPurpose } from "./ViewPurpose";

describe("ViewPurpose", () => {
  it("names the user question, purpose and visible period", () => {
    render(
      <ViewPurpose
        period="03.08.2026 bis 09.08.2026"
        purpose="Ordnet Aufgaben nach ihrem Plandatum."
        question="Was ist an welchem Tag geplant?"
      />,
    );

    const note = screen.getByRole("note", { name: "Zweck dieser Ansicht" });
    expect(note).toHaveTextContent("Was ist an welchem Tag geplant?");
    expect(note).toHaveTextContent("Ordnet Aufgaben nach ihrem Plandatum.");
    expect(note).toHaveTextContent("Zeitraum: 03.08.2026 bis 09.08.2026");
  });
});
