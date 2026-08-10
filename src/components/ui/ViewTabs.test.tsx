import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { viewTabId } from "./view-tab-id";
import { ViewTabs, type ViewTabItem } from "./ViewTabs";

const fourTabs: Array<ViewTabItem<"inbox" | "today" | "week" | "done">> = [
  { count: { label: "3 Aufgaben", value: 3 }, id: "inbox", label: "Inbox" },
  { count: { label: "1 Aufgaben", value: 1 }, id: "today", label: "Heute" },
  {
    count: { label: "0 Aufgaben", value: 0 },
    id: "week",
    label: "Diese Woche",
  },
  { count: { label: "7 Aufgaben", value: 7 }, id: "done", label: "Erledigt" },
];

function Harness({ tabs = fourTabs }: { tabs?: typeof fourTabs }) {
  const [activeId, setActiveId] = useState(tabs[0]!.id);

  return (
    <>
      <ViewTabs
        activeId={activeId}
        idPrefix="probe"
        label="Beispielansicht"
        onChange={setActiveId}
        panelId="probe-panel"
        tabs={tabs}
      />
      <div
        aria-labelledby={viewTabId("probe", activeId)}
        id="probe-panel"
        role="tabpanel"
      >
        Inhalt von {activeId}
      </div>
    </>
  );
}

describe("ViewTabs", () => {
  it("names every tab with its label and its counter", () => {
    render(<Harness />);

    expect(
      screen.getByRole("tab", { name: "Diese Woche: 0 Aufgaben" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "Beispielansicht" }),
    ).toBeVisible();
  });

  it("relates the selected tab and its panel in both directions", () => {
    render(<Harness />);

    const selected = screen.getByRole("tab", { selected: true });
    const panel = screen.getByRole("tabpanel", { name: "Inbox: 3 Aufgaben" });

    expect(selected).toHaveAttribute("aria-controls", "probe-panel");
    expect(panel).toHaveAttribute("aria-labelledby", selected.id);
  });

  /*
   * Ein wanderndes `tabindex` heißt: Genau ein Reiter liegt im
   * Tabulatorpfad. Ohne diese Regel wandert der Tabulator durch alle vier,
   * bevor er den Inhalt erreicht.
   */
  it("keeps exactly one tab in the tab order", () => {
    render(<Harness />);

    const inTabOrder = screen
      .getAllByRole("tab")
      .filter((tab) => tab.getAttribute("tabindex") === "0");

    expect(inTabOrder).toHaveLength(1);
    expect(inTabOrder[0]).toHaveAccessibleName("Inbox: 3 Aufgaben");
  });

  it("moves the selection with the arrow keys and wraps around", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();
    expect(
      screen.getByRole("tab", { name: "Inbox: 3 Aufgaben" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    const second = screen.getByRole("tab", { name: "Heute: 1 Aufgaben" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Inhalt von today");

    // Links am ersten Reiter läuft ans Ende, nicht ins Leere.
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(
      screen.getByRole("tab", { name: "Erledigt: 7 Aufgaben" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("tab", { name: "Inbox: 3 Aufgaben" }),
    ).toHaveFocus();
  });

  it("jumps to both ends with Home and End", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();
    await user.keyboard("{End}");
    expect(
      screen.getByRole("tab", { name: "Erledigt: 7 Aufgaben" }),
    ).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(
      screen.getByRole("tab", { name: "Inbox: 3 Aufgaben" }),
    ).toHaveFocus();
  });

  it.each([1, 2, 3, 4])("works with %i tabs", async (count) => {
    const user = userEvent.setup();
    render(<Harness tabs={fourTabs.slice(0, count)} />);

    expect(screen.getAllByRole("tab")).toHaveLength(count);

    await user.tab();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName(
      `${fourTabs[count - 1]!.label}: ${fourTabs[count - 1]!.count!.label}`,
    );
  });

  it("shows a tab without a counter", () => {
    render(
      <ViewTabs
        activeId="only"
        idPrefix="probe"
        label="Beispielansicht"
        onChange={() => {}}
        panelId="probe-panel"
        tabs={[{ id: "only", label: "Ohne Zähler" }]}
      />,
    );

    expect(
      screen.getByRole("tab", { name: "Ohne Zähler" }),
    ).toBeInTheDocument();
  });
});
