import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChartErrorBoundary } from "./ChartErrorBoundary";

function Throwing(): never {
  throw new RangeError("Die Bibliothek konnte nicht zeichnen.");
}

describe("ChartErrorBoundary", () => {
  beforeEach(() => {
    // React meldet einen aufgefangenen Fehler zusätzlich auf der Konsole.
    // Der Test erwartet ihn; die Ausgabe würde den Lauf nur verrauschen.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces only the failing area and keeps its surroundings", () => {
    render(
      <figure>
        <figcaption>Ausgaben je Monat</figcaption>
        <ChartErrorBoundary fallback={<p>Das Diagramm fehlt.</p>}>
          <Throwing />
        </ChartErrorBoundary>
        <p>Grundlage: erfundene Beispieldaten</p>
      </figure>,
    );

    expect(screen.getByText("Das Diagramm fehlt.")).toBeInTheDocument();
    expect(screen.getByText("Ausgaben je Monat")).toBeInTheDocument();
    expect(
      screen.getByText("Grundlage: erfundene Beispieldaten"),
    ).toBeInTheDocument();
  });

  it("passes an intact area through untouched", () => {
    render(
      <ChartErrorBoundary fallback={<p>Das Diagramm fehlt.</p>}>
        <p>Die Zeichenfläche</p>
      </ChartErrorBoundary>,
    );

    expect(screen.getByText("Die Zeichenfläche")).toBeInTheDocument();
    expect(screen.queryByText("Das Diagramm fehlt.")).not.toBeInTheDocument();
  });
});
