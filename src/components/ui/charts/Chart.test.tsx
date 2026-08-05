import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chart } from "./Chart";
import { readChartTheme, withAlpha } from "./chart-theme";

const days = ["Mo", "Di", "Mi"];

describe("Chart", () => {
  it("names period and data basis and repeats every value as a table", () => {
    render(
      <Chart
        categories={days}
        period="1. bis 3. August"
        series={[
          { id: "done", label: "Erledigt", tone: 1, values: [3, 5, 4] },
          { id: "due", label: "Geplant", tone: 2, values: [6, 6, 7] },
        ]}
        source="Grundlage: erfundene Beispieldaten"
        title="Wochenverlauf"
      />,
    );

    expect(screen.getByText("1. bis 3. August")).toBeInTheDocument();
    expect(
      screen.getByText("Grundlage: erfundene Beispieldaten"),
    ).toBeInTheDocument();

    const table = screen.getByRole("table", {
      name: "Wochenverlauf: Werte als Tabelle",
    });
    const firstRow = within(table).getByRole("row", { name: /^Mo/ });
    expect(within(firstRow).getAllByRole("cell")[0]).toHaveTextContent("3");
    expect(within(firstRow).getAllByRole("cell")[1]).toHaveTextContent("6");
  });

  it("draws at most three series and keeps the plot decorative", async () => {
    render(
      <Chart
        categories={days}
        period="1. bis 3. August"
        series={[
          { id: "a", label: "A", tone: 1, values: [1, 2, 3] },
          { id: "b", label: "B", tone: 2, values: [1, 2, 3] },
          { id: "c", label: "C", tone: 3, values: [1, 2, 3] },
          { id: "d", label: "D", tone: 4, values: [1, 2, 3] },
        ]}
        source="Grundlage: erfundene Beispieldaten"
        title="Wochenverlauf"
      />,
    );

    expect(screen.getByRole("list").children).toHaveLength(3);
    expect(screen.queryByText("D")).not.toBeInTheDocument();
    // Die Grafik lädt nach; sie bleibt in jedem Zustand rein dekorativ.
    const plot = await screen.findByTestId("chart-plot");
    expect(plot).toHaveAttribute("aria-hidden", "true");
    // Ohne den Ersatz zöge dieser Test die ganze Bibliothek nach und liefe
    // unter paralleler Last in die Wartezeit.
    expect(plot).toHaveAttribute("data-chart-stub", "true");
  });

  it("names missing values instead of drawing a zero", () => {
    render(
      <Chart
        categories={days}
        period="1. bis 3. August"
        series={[{ id: "a", label: "A", tone: 1, values: [1, null, 3] }]}
        source="Grundlage: erfundene Beispieldaten"
        title="Wochenverlauf"
      />,
    );

    const table = screen.getByRole("table", {
      name: "Wochenverlauf: Werte als Tabelle",
    });
    expect(within(table).getByText("Keine Angabe")).toBeInTheDocument();
  });

  it("keeps period and data basis visible in the empty state", () => {
    render(
      <Chart
        categories={days}
        emptyMessage="Für diesen Zeitraum liegen keine Einträge vor."
        period="1. bis 3. August"
        series={[]}
        source="Grundlage: erfundene Beispieldaten"
        title="Wochenverlauf"
      />,
    );

    expect(
      screen.getByText("Für diesen Zeitraum liegen keine Einträge vor."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Grundlage: erfundene Beispieldaten"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chart-plot")).not.toBeInTheDocument();
  });

  it("replaces the plot with the error text", () => {
    render(
      <Chart
        categories={days}
        error="Der Verlauf konnte nicht gezeichnet werden."
        period="1. bis 3. August"
        series={[{ id: "a", label: "A", tone: 1, values: [1, 2, 3] }]}
        source="Grundlage: erfundene Beispieldaten"
        title="Wochenverlauf"
      />,
    );

    expect(
      screen.getByText("Der Verlauf konnte nicht gezeichnet werden."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chart-plot")).not.toBeInTheDocument();
  });
});

describe("readChartTheme", () => {
  it("reads the tokens from the element and keeps a readable fallback", () => {
    const element = document.createElement("div");
    element.style.setProperty("--data-1", "#123456");
    element.style.setProperty("--chart-area-opacity", "0.5");
    document.body.append(element);

    const theme = readChartTheme(element);

    expect(theme.series[1]).toBe("#123456");
    expect(theme.areaOpacity).toBe(0.5);
    // Nicht gesetzte Tokens fallen auf lesbare Werte zurück statt auf leer.
    expect(theme.series[2]).not.toBe("");
    expect(theme.text).not.toBe("");

    element.remove();
  });
});

describe("withAlpha", () => {
  it("sets the opacity of hex and rgb tokens alike", () => {
    expect(withAlpha("#ffb27d", 0.5)).toBe("rgba(255, 178, 125, 0.5)");
    expect(withAlpha("rgb(255 255 255 / 50%)", 0.5)).toBe(
      "rgba(255, 255, 255, 0.25)",
    );
  });

  it("returns an unreadable value unchanged instead of guessing", () => {
    expect(withAlpha("currentColor", 0.5)).toBe("currentColor");
  });
});
