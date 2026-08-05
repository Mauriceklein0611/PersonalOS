import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../../db/database";
import { createTestDatabase, deleteTestDatabase } from "../../../test/database";
import {
  createGoalMilestoneRepository,
  createGoalRepository,
} from "../repository";
import { createGoalService } from "../service";
import { GoalsPage } from "./GoalsPage";

const fixedNow = new Date("2026-08-05T10:00:00.000Z");
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

function renderPage() {
  const service = createGoalService(
    createGoalRepository(database),
    createGoalMilestoneRepository(database),
    () => "2026-08-05T09:00:00.000Z",
  );
  render(
    <GoalsPage
      now={() => fixedNow}
      service={service}
      timeZone="Europe/Berlin"
    />,
  );
  return service;
}

async function createGoal(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) {
  await user.type(screen.getByRole("textbox", { name: /Titel/ }), title);
  await user.click(screen.getByRole("button", { name: "Ziel anlegen" }));
}

describe("GoalsPage", () => {
  it("explains the empty state instead of showing an empty list", async () => {
    renderPage();

    expect(await screen.findByText("Noch kein Ziel")).toBeInTheDocument();
  });

  it("walks a goal from creation through milestones to completion", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Noch kein Ziel");

    await createGoal(user, "Synthetisches Ziel");
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Synthetisches Ziel",
      }),
    ).toBeInTheDocument();

    // Ein Ziel ohne Meilenstein bleibt gültig und wird nicht als Null gewertet.
    expect(
      screen.getByText(
        "Noch kein Meilenstein. Ein leeres Ziel ist in Ordnung.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Keine Angabe")).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: /Neuer Meilenstein/ }),
      "Erster Schritt",
    );
    await user.click(
      screen.getByRole("button", { name: "Meilenstein hinzufügen" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /Neuer Meilenstein/ }),
      "Zweiter Schritt",
    );
    await user.click(
      screen.getByRole("button", { name: "Meilenstein hinzufügen" }),
    );

    await user.click(
      await screen.findByRole("checkbox", { name: "Erster Schritt" }),
    );

    expect(
      await screen.findByText("1 von 2 Meilensteinen abgeschlossen."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Fortschritt" }),
    ).toHaveValue(50);

    await user.click(screen.getByRole("button", { name: "Abgeschlossen" }));
    expect(
      await screen.findByText("Der Status ist jetzt „Abgeschlossen“."),
    ).toBeInTheDocument();
  });

  it("keeps an archived milestone out of the rate and restores it through undo", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Noch kein Ziel");
    await createGoal(user, "Synthetisches Ziel");

    await user.type(
      await screen.findByRole("textbox", { name: /Neuer Meilenstein/ }),
      "Erster Schritt",
    );
    await user.click(
      screen.getByRole("button", { name: "Meilenstein hinzufügen" }),
    );
    await user.click(
      await screen.findByRole("checkbox", { name: "Erster Schritt" }),
    );
    expect(
      await screen.findByText("1 von 1 Meilensteinen abgeschlossen."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Meilenstein „Erster Schritt“ entfernen",
      }),
    );
    expect(
      await screen.findByText("Noch kein Meilenstein angelegt."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(
      await screen.findByText("1 von 1 Meilensteinen abgeschlossen."),
    ).toBeInTheDocument();
  });

  it("refuses an empty title with a correction hint", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Noch kein Ziel");

    await user.click(screen.getByRole("button", { name: "Ziel anlegen" }));

    expect(
      screen.getByText("Gib einen Titel mit mindestens einem Zeichen ein."),
    ).toBeInTheDocument();
    expect(screen.getByText("Noch kein Ziel")).toBeInTheDocument();
  });

  it("offers only reachable status transitions", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Noch kein Ziel");
    await createGoal(user, "Synthetisches Ziel");

    const detail = await screen.findByRole("region", {
      name: "Synthetisches Ziel",
    });
    await user.click(
      within(detail).getByRole("button", { name: "Abgeschlossen" }),
    );

    // Erst prüfen, wenn der Statuswechsel tatsächlich gerendert ist.
    await screen.findByText("Der Status ist jetzt „Abgeschlossen“.");

    const afterCompletion = await screen.findByRole("region", {
      name: "Synthetisches Ziel",
    });
    expect(
      within(afterCompletion).queryByRole("button", {
        name: "Nicht weiterverfolgt",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(afterCompletion).getByRole("button", { name: "Aktiv" }),
    ).toBeInTheDocument();
  });
});
