import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartFrame } from "./ChartFrame";
import { MetricTile } from "./MetricTile";
import { ProgressBar } from "./ProgressBar";
import { ProgressRing } from "./ProgressRing";
import { RankedBarList } from "./RankedBarList";
import { Sparkline } from "./Sparkline";
import { TrackerCell } from "./TrackerCell";
import {
  dataSeriesDashes,
  dataSeriesMarkers,
  dataSeriesTones,
  formatRatio,
} from "./data-series";

describe("data series", () => {
  it("gives every tone an own marker and line pattern", () => {
    const markers = dataSeriesTones.map((tone) => dataSeriesMarkers[tone]);
    const dashes = dataSeriesTones.map(
      (tone) => dataSeriesDashes[tone] ?? "solid",
    );

    expect(new Set(markers).size).toBe(dataSeriesTones.length);
    expect(new Set(dashes).size).toBe(dataSeriesTones.length);
  });
});

describe("formatRatio", () => {
  it("rounds to whole percent and stays inside 0 to 100", () => {
    expect(formatRatio(0.734)).toMatch(/^73\s%$/);
    expect(formatRatio(-1)).toMatch(/^0\s%$/);
    expect(formatRatio(4)).toMatch(/^100\s%$/);
    expect(formatRatio(Number.NaN)).toMatch(/^0\s%$/);
  });
});

describe("MetricTile", () => {
  it("shows the value as text and keeps the sparkline decorative", () => {
    const { container } = render(
      <MetricTile
        context="Diese Woche"
        label="Erledigte Aufgaben"
        sparkline={[2, 5, 3, 8]}
        value="249"
      />,
    );

    expect(screen.getByText("249")).toBeInTheDocument();
    expect(screen.getByText("Diese Woche")).toBeInTheDocument();
    expect(container.querySelector(".ui-sparkline")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("falls back to a neutral text instead of a zero value", () => {
    render(<MetricTile label="Erledigte Aufgaben" value={null} />);

    expect(screen.getByText("Keine Angabe")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("replaces the value with the error text", () => {
    render(
      <MetricTile
        error="Die Kennzahl konnte nicht berechnet werden."
        label="Erledigte Aufgaben"
        value="249"
      />,
    );

    expect(
      screen.getByText("Die Kennzahl konnte nicht berechnet werden."),
    ).toBeInTheDocument();
    expect(screen.queryByText("249")).not.toBeInTheDocument();
  });
});

describe("ProgressRing", () => {
  it("writes the value into the centre and draws the ring decoratively", () => {
    const { container } = render(
      <ProgressRing label="Tagesfortschritt" value={0.73} />,
    );

    expect(screen.getByText(/73\s%/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("keeps the ring empty and says so when no data exists", () => {
    const { container } = render(
      <ProgressRing label="Tagesfortschritt" value={null} />,
    );

    expect(screen.getByText("Keine Angabe")).toBeInTheDocument();
    expect(screen.queryByText(/0\s%/)).not.toBeInTheDocument();
    expect(
      container.querySelector(".ui-progress-ring-value"),
    ).not.toBeInTheDocument();
  });

  it("accepts an own value text instead of percent", () => {
    render(<ProgressRing label="Wochenziel" value={0.6} valueText="3 von 5" />);

    expect(screen.getByText("3 von 5")).toBeInTheDocument();
  });
});

describe("ProgressBar", () => {
  it("labels the native progress element and repeats the value as text", () => {
    render(<ProgressBar label="Monatsfortschritt" value={0.42} />);

    const progress = screen.getByRole("progressbar", {
      name: "Monatsfortschritt",
    });
    expect(progress).toHaveValue(42);
    expect(screen.getByText(/42\s%/)).toBeInTheDocument();
  });

  it("omits the progress element when no data exists", () => {
    render(<ProgressBar label="Monatsfortschritt" value={null} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Keine Angabe")).toBeInTheDocument();
  });
});

describe("RankedBarList", () => {
  it("shows at most five entries with their number next to the bar", () => {
    render(
      <RankedBarList
        items={[
          { id: "a", label: "Lesen", value: 21 },
          { id: "b", label: "Sport", value: 18 },
          { id: "c", label: "Wasser", value: 15 },
          { id: "d", label: "Planung", value: 12 },
          { id: "e", label: "Dehnen", value: 9 },
          { id: "f", label: "Nicht sichtbar", value: 4 },
        ]}
        label="Aktive Serien"
      />,
    );

    const list = screen.getByRole("list", { name: "Aktive Serien" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(within(list).getByText("21")).toBeInTheDocument();
    expect(within(list).queryByText("Nicht sichtbar")).not.toBeInTheDocument();
  });

  it("explains the empty state instead of showing bars", () => {
    render(
      <RankedBarList
        emptyMessage="Noch keine Serien erfasst."
        items={[]}
        label="Aktive Serien"
      />,
    );

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("Noch keine Serien erfasst.")).toBeInTheDocument();
  });
});

describe("TrackerCell", () => {
  it("carries a sign plus a text label for every state", () => {
    render(<TrackerCell dayLabel="Mo, 3. August" state="done" />);

    expect(screen.getByText("Mo, 3. August: Erledigt")).toBeInTheDocument();
    expect(screen.getByText("✓")).toHaveAttribute("aria-hidden", "true");
  });

  it("names missing data instead of implying a failure", () => {
    render(<TrackerCell dayLabel="Mi, 5. August" state="none" />);

    expect(screen.getByText("Mi, 5. August: Keine Angabe")).toBeInTheDocument();
  });

  it("becomes a button that names state and action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <TrackerCell
        actionLabel="Als erledigt eintragen"
        dayLabel="Lesen am 3. August 2026"
        onClick={onClick}
        state="open"
      />,
    );

    const cell = screen.getByRole("button", {
      name: "Lesen am 3. August 2026: Offen. Als erledigt eintragen",
    });
    await user.click(cell);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies a week colour only on top of a positive state", () => {
    const { container, rerender } = render(
      <TrackerCell dayLabel="Mo, 3. August" state="done" tone={3} />,
    );
    expect(container.querySelector(".ui-tracker-cell")).toHaveAttribute(
      "data-tone",
      "3",
    );

    rerender(<TrackerCell dayLabel="Mo, 3. August" state="open" tone={3} />);
    expect(container.querySelector(".ui-tracker-cell")).not.toHaveAttribute(
      "data-tone",
    );
  });
});

describe("Sparkline", () => {
  it("draws at most three series and marks each one with its own pattern", () => {
    const { container } = render(
      <Sparkline
        series={[
          { id: "a", label: "A", points: [1, 4, 2], tone: 1 },
          { id: "b", label: "B", points: [2, 3, 5], tone: 2 },
          { id: "c", label: "C", points: [5, 1, 3], tone: 3 },
          { id: "d", label: "D", points: [3, 3, 3], tone: 4 },
        ]}
      />,
    );

    const lines = container.querySelectorAll(".ui-sparkline-line");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toHaveAttribute("stroke-dasharray", "7 4");
  });

  it("renders nothing without points", () => {
    const { container } = render(<Sparkline series={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ChartFrame", () => {
  it("names period and data basis and labels every legend entry", () => {
    render(
      <ChartFrame
        legend={[
          { id: "a", label: "Erledigte Aufgaben", tone: 1 },
          { id: "b", label: "Geplante Aufgaben", tone: 2 },
        ]}
        period="1. bis 7. August"
        source="Grundlage: lokale Aufgaben dieser Woche"
        title="Wochenverlauf"
      >
        <Sparkline
          series={[{ id: "a", label: "A", points: [1, 3, 2], tone: 1 }]}
        />
      </ChartFrame>,
    );

    expect(screen.getByText("1. bis 7. August")).toBeInTheDocument();
    expect(
      screen.getByText("Grundlage: lokale Aufgaben dieser Woche"),
    ).toBeInTheDocument();
    expect(screen.getByText("Erledigte Aufgaben")).toBeInTheDocument();
    expect(screen.getByText("Geplante Aufgaben")).toBeInTheDocument();
  });

  it("keeps period and data basis visible in the empty state", () => {
    render(
      <ChartFrame
        emptyMessage="Für diesen Zeitraum liegen keine Einträge vor."
        period="1. bis 7. August"
        source="Grundlage: lokale Aufgaben dieser Woche"
        title="Wochenverlauf"
      />,
    );

    expect(
      screen.getByText("Für diesen Zeitraum liegen keine Einträge vor."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Grundlage: lokale Aufgaben dieser Woche"),
    ).toBeInTheDocument();
  });
});
