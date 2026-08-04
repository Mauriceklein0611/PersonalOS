import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PersistenceError } from "../../../db/errors";
import type { CalendarDay } from "../../../lib/dates/date-values";
import { hasJournalContent, type JournalEntry } from "../model";
import type { JournalService } from "../service";
import { JournalPage } from "./JournalPage";

const fixedNow = new Date("2026-08-04T18:30:00.000Z");
const baseInstant = "2026-08-04T18:00:00.000Z";

function renderPage(service: JournalService, now = () => fixedNow) {
  return render(
    <JournalPage now={now} service={service} timeZone="Europe/Berlin" />,
  );
}

function scaleGroup(label: string) {
  return within(screen.getByRole("group", { name: label }));
}

describe("JournalPage", () => {
  it("saves a short reflection and shows the stored state", async () => {
    const user = userEvent.setup();
    const service = createMemoryJournalService();
    renderPage(service);

    expect(
      await screen.findByText("Für diesen Tag ist noch nichts gespeichert."),
    ).toBeInTheDocument();
    expect(
      scaleGroup("Stimmung").getByRole("radio", { name: "Keine Angabe" }),
    ).toBeChecked();

    await user.click(
      scaleGroup("Stimmung").getByRole("radio", { name: "4 von 5" }),
    );
    expect(
      await screen.findByText("Nicht gespeicherte Änderungen"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eintrag speichern" }));

    expect(
      await screen.findByText("Gespeichert um 20:30 Uhr"),
    ).toBeInTheDocument();
    expect(service.saveForDate).toHaveBeenCalledWith({
      localDate: "2026-08-04",
      mood: 4,
    });
  });

  it("explains an empty entry instead of storing it", async () => {
    const user = userEvent.setup();
    const service = createMemoryJournalService();
    renderPage(service);

    await screen.findByRole("button", { name: "Eintrag speichern" });
    await user.click(screen.getByRole("button", { name: "Eintrag speichern" }));

    expect(
      await screen.findByText(
        "Halte mindestens einen Wert oder Text fest, bevor du speicherst.",
      ),
    ).toBeInTheDocument();
    expect(service.saveForDate).not.toHaveBeenCalled();
  });

  it("keeps a full reflection and its untouched scales apart from zero", async () => {
    const user = userEvent.setup();
    const service = createMemoryJournalService();
    renderPage(service);

    await screen.findByRole("button", { name: "Eintrag speichern" });
    await user.click(
      scaleGroup("Stimmung").getByRole("radio", { name: "5 von 5" }),
    );
    await user.click(
      scaleGroup("Energie").getByRole("radio", { name: "3 von 5" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Highlight des Tages" }),
      "Langer Spaziergang",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Wofür bist du dankbar?" }),
      "Ruhige Stunde",
    );
    await user.click(screen.getByRole("button", { name: "Eintrag speichern" }));

    await screen.findByText("Gespeichert um 20:30 Uhr");
    expect(service.saveForDate).toHaveBeenCalledWith({
      localDate: "2026-08-04",
      energy: 3,
      gratitude: "Ruhige Stunde",
      highlight: "Langer Spaziergang",
      mood: 5,
    });
    expect(
      scaleGroup("Stress").getByRole("radio", { name: "Keine Angabe" }),
    ).toBeChecked();
  });

  it("opens an older entry from the history and loads its values", async () => {
    const user = userEvent.setup();
    const service = createMemoryJournalService([
      createEntry("2026-08-02", { mood: 2, highlight: "Regentag" }),
    ]);
    renderPage(service);

    await user.click(
      await screen.findByRole("button", {
        name: "Eintrag vom Sonntag, 2. August 2026 bearbeiten",
      }),
    );

    expect(
      await screen.findByText("Für diesen Tag ist ein Eintrag gespeichert."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tag der Reflexion")).toHaveValue(
      "2026-08-02",
    );
    expect(
      screen.getByRole("textbox", { name: "Highlight des Tages" }),
    ).toHaveValue("Regentag");
    expect(
      scaleGroup("Stimmung").getByRole("radio", { name: "2 von 5" }),
    ).toBeChecked();
  });

  it("blocks the day change while edits are unsaved and restores them on discard", async () => {
    const user = userEvent.setup();
    const service = createMemoryJournalService();
    renderPage(service);

    await screen.findByRole("button", { name: "Eintrag speichern" });
    await user.type(
      screen.getByRole("textbox", { name: "Freitext" }),
      "Noch nicht gespeichert",
    );

    expect(
      screen.getByRole("button", { name: "Vorheriger Tag" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Der Tag lässt sich wechseln, sobald du gespeichert oder die Änderungen verworfen hast.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Änderungen verwerfen" }),
    );

    expect(screen.getByRole("textbox", { name: "Freitext" })).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Vorheriger Tag" }),
    ).toBeEnabled();
  });

  it("uses the local day of the given time zone after a day change", async () => {
    const service = createMemoryJournalService();
    renderPage(service, () => new Date("2026-08-04T22:30:00.000Z"));

    expect(await screen.findByLabelText("Tag der Reflexion")).toHaveValue(
      "2026-08-05",
    );
  });

  it("keeps the input when saving fails", async () => {
    const user = userEvent.setup();
    const service = createMemoryJournalService();
    service.saveForDate = vi.fn(async () => {
      throw new PersistenceError("storage");
    });
    renderPage(service);

    await screen.findByRole("button", { name: "Eintrag speichern" });
    await user.type(
      screen.getByRole("textbox", { name: "Freitext" }),
      "Wichtiger Gedanke",
    );
    await user.click(screen.getByRole("button", { name: "Eintrag speichern" }));

    expect(
      await screen.findByText(
        "Der Eintrag konnte nicht gespeichert werden. Deine Eingaben bleiben im Formular.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Freitext" })).toHaveValue(
      "Wichtiger Gedanke",
    );
  });
});

function createEntry(
  localDate: CalendarDay,
  fields: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id: `00000000-0000-4000-8000-${localDate.replaceAll("-", "").padStart(12, "0")}`,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    localDate,
    ...fields,
  };
}

function createMemoryJournalService(
  initialEntries: JournalEntry[] = [],
): JournalService {
  let entries = [...initialEntries];

  return {
    getForDate: vi.fn(async (localDate) =>
      entries.find((entry) => entry.localDate === localDate),
    ),
    list: vi.fn(async () =>
      [...entries].sort((left, right) =>
        right.localDate.localeCompare(left.localDate),
      ),
    ),
    saveForDate: vi.fn(async (details) => {
      if (!hasJournalContent(details)) {
        throw new PersistenceError("validation");
      }
      const current = entries.find(
        (entry) => entry.localDate === details.localDate,
      );
      const saved: JournalEntry = {
        ...(current ?? {
          id: createEntry(details.localDate).id,
          createdAt: baseInstant,
        }),
        ...details,
        updatedAt: baseInstant,
      };
      entries = current
        ? entries.map((entry) => (entry.id === saved.id ? saved : entry))
        : [...entries, saved];
      return saved;
    }),
  };
}
