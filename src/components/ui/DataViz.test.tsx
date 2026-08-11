import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MetricTile } from "./MetricTile";
import { ProgressBar } from "./ProgressBar";
import { ProgressRing } from "./ProgressRing";
import { RankedBarList } from "./RankedBarList";
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
  it("shows the value and its context as text", () => {
    render(
      <MetricTile
        context="Diese Woche"
        label="Erledigte Aufgaben"
        value="249"
      />,
    );

    expect(screen.getByText("249")).toBeInTheDocument();
    expect(screen.getByText("Diese Woche")).toBeInTheDocument();
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

  it("keeps a day outside the period empty but named", () => {
    const { container } = render(
      <TrackerCell dayLabel="Mo, 3. August" state="outside" />,
    );

    expect(
      screen.getByText("Mo, 3. August: Außerhalb des Zeitraums"),
    ).toBeInTheDocument();
    expect(container.querySelector(".ui-tracker-cell-sign")).toHaveTextContent(
      "",
    );
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

describe("ProgressRing glow", () => {
  it("marks the glow only when a value exists", () => {
    const { container, rerender } = render(
      <ProgressRing glow label="Tagesfortschritt" value={0.5} />,
    );
    expect(container.querySelector(".ui-progress-ring")).toHaveAttribute(
      "data-glow",
      "true",
    );

    rerender(<ProgressRing glow label="Tagesfortschritt" value={null} />);
    expect(container.querySelector(".ui-progress-ring")).toHaveAttribute(
      "data-glow",
      "false",
    );
  });
});
