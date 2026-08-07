import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createMemorySavingsService } from "../../../test/factories/savings";
import type { Transaction } from "../model";
import type { SavingsService } from "../savings-service";
import { SavingsPanel } from "./SavingsPanel";

const fixedNow = new Date("2026-08-04T10:00:00.000Z");

function renderPanel(
  service: SavingsService,
  transactions: readonly Transaction[] = [],
) {
  return render(
    <SavingsPanel
      now={() => fixedNow}
      service={service}
      timeZone="Europe/Berlin"
      transactions={transactions}
    />,
  );
}

const linkableExpense: Transaction = {
  bookedOn: "2026-08-04",
  categoryId: "00000000-0000-4000-8000-000000009801",
  createdAt: "2026-08-04T08:00:00.000Z",
  description: "Synthetische Überweisung",
  id: "00000000-0000-4000-8000-000000009802",
  kind: "expense",
  money: { amountMinor: 25_000, currency: "EUR" },
  updatedAt: "2026-08-04T08:00:00.000Z",
};

async function addGoal(target: string, targetDate = "") {
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: /Name des Sparziels/ }),
    "Synthetisches Sparziel",
  );
  await user.type(
    screen.getByRole("textbox", { name: /Zielbetrag in Euro/ }),
    target,
  );
  if (targetDate.length > 0) {
    await user.type(screen.getByLabelText(/Frist/), targetDate);
  }
  await user.click(screen.getByRole("button", { name: "Sparziel anlegen" }));
  await screen.findByRole("heading", {
    level: 3,
    name: "Synthetisches Sparziel",
  });
}

async function openHistory() {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", {
      name: "Verlauf von „Synthetisches Sparziel“ anzeigen",
    }),
  );
}

async function addContribution(amount: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByRole("textbox", { name: /Beitrag in Euro/ }));
  await user.type(
    screen.getByRole("textbox", { name: /Beitrag in Euro/ }),
    amount,
  );
  await user.click(screen.getByRole("button", { name: "Beitrag hinzufügen" }));
}

describe("SavingsPanel", () => {
  it("explains the empty state before the first savings goal", async () => {
    renderPanel(createMemorySavingsService());

    expect(await screen.findByText("Kein Sparziel")).toBeInTheDocument();
  });

  it("derives the current amount from the contributions", async () => {
    renderPanel(createMemorySavingsService());
    await screen.findByRole("button", { name: "Sparziel anlegen" });

    await addGoal("1.000,00");
    await openHistory();
    await addContribution("250,00");

    expect(await screen.findByText(/250,00.*von.*1\.000,00/)).toBeVisible();
    expect(
      screen.getByText("Ein Teil des Zielbetrags ist noch offen."),
    ).toBeVisible();
    expect(screen.getByText(/Noch offen: .*750,00/)).toBeVisible();
  });

  it("keeps an exceeded target correct and free of judgement", async () => {
    renderPanel(createMemorySavingsService());
    await screen.findByRole("button", { name: "Sparziel anlegen" });

    await addGoal("100,00");
    await openHistory();
    await addContribution("150,00");

    expect(
      await screen.findByText(
        "Der Zielbetrag ist erreicht; darüber hinaus sind weitere Beiträge erfasst.",
      ),
    ).toBeVisible();
    expect(screen.getByText(/Darüber hinaus: .*50,00/)).toBeVisible();
  });

  it("withdraws a contribution and offers to undo it", async () => {
    const user = userEvent.setup();
    renderPanel(createMemorySavingsService());
    await screen.findByRole("button", { name: "Sparziel anlegen" });

    await addGoal("1.000,00");
    await openHistory();
    await addContribution("250,00");

    await user.click(
      screen.getByRole("button", { name: /Beitrag vom .* zurücknehmen/ }),
    );

    expect(await screen.findByText(/0,00.*von.*1\.000,00/)).toBeVisible();
    expect(screen.getByText(/zählt nicht mehr zum Stand/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(await screen.findByText(/250,00.*von.*1\.000,00/)).toBeVisible();
  });

  it("updates the amount after editing a contribution", async () => {
    const user = userEvent.setup();
    renderPanel(createMemorySavingsService());
    await screen.findByRole("button", { name: "Sparziel anlegen" });

    await addGoal("1.000,00");
    await openHistory();
    await addContribution("250,00");

    await user.click(
      screen.getByRole("button", { name: /Beitrag vom .* bearbeiten/ }),
    );
    await user.clear(screen.getByRole("textbox", { name: /Beitrag in Euro/ }));
    await user.type(
      screen.getByRole("textbox", { name: /Beitrag in Euro/ }),
      "400,00",
    );
    await user.click(
      screen.getByRole("button", { name: "Beitrag aktualisieren" }),
    );

    expect(await screen.findByText(/400,00.*von.*1\.000,00/)).toBeVisible();
  });

  it("shows a savings goal without a deadline as a valid state", async () => {
    renderPanel(createMemorySavingsService());
    await screen.findByRole("button", { name: "Sparziel anlegen" });

    await addGoal("1.000,00");

    expect(await screen.findByText(/0 Beiträge · Ohne Frist/)).toBeVisible();
  });

  it("warns about the affected contributions before a permanent deletion", async () => {
    const user = userEvent.setup();
    renderPanel(createMemorySavingsService());
    await screen.findByRole("button", { name: "Sparziel anlegen" });

    await addGoal("1.000,00");
    await openHistory();
    await addContribution("250,00");

    await user.click(
      screen.getByRole("button", { name: "Sparziel endgültig löschen" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Sparziel endgültig löschen",
    });
    expect(dialog).toHaveTextContent(/1 Beitrag wird mitgelöscht/);

    await user.click(screen.getByRole("button", { name: "Endgültig löschen" }));

    expect(await screen.findByText("Kein Sparziel")).toBeInTheDocument();
  });

  it("offers only a matching expense and records the chosen link", async () => {
    const user = userEvent.setup();
    const service = createMemorySavingsService();
    renderPanel(service, [linkableExpense]);
    await screen.findByRole("button", { name: "Sparziel anlegen" });

    await addGoal("1.000,00");
    await openHistory();

    // Ohne Betrag gibt es nichts zu verknüpfen.
    expect(screen.getByLabelText(/Belegende Ausgabe/)).toHaveDisplayValue(
      "Ohne Verknüpfung",
    );
    expect(screen.getByText(/Gib zuerst einen Betrag ein/)).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: /Beitrag in Euro/ }),
      "100,00",
    );
    expect(
      await screen.findByText(/keine passende, noch freie Ausgabe/),
    ).toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: /Beitrag in Euro/ }));
    await user.type(
      screen.getByRole("textbox", { name: /Beitrag in Euro/ }),
      "250,00",
    );
    await user.selectOptions(
      screen.getByLabelText(/Belegende Ausgabe/),
      linkableExpense.id,
    );
    await user.click(
      screen.getByRole("button", { name: "Beitrag hinzufügen" }),
    );

    expect(
      await screen.findByText(/Mit einer Ausgabe verknüpft/),
    ).toBeInTheDocument();
    expect((await service.listContributions())[0]?.sourceTransactionId).toBe(
      linkableExpense.id,
    );
  });

  it("stops offering an expense that already backs a contribution", async () => {
    const user = userEvent.setup();
    renderPanel(createMemorySavingsService(), [linkableExpense]);
    await screen.findByRole("button", { name: "Sparziel anlegen" });

    await addGoal("1.000,00");
    await openHistory();
    await user.type(
      screen.getByRole("textbox", { name: /Beitrag in Euro/ }),
      "250,00",
    );
    await user.selectOptions(
      screen.getByLabelText(/Belegende Ausgabe/),
      linkableExpense.id,
    );
    await user.click(
      screen.getByRole("button", { name: "Beitrag hinzufügen" }),
    );
    await screen.findByText(/Mit einer Ausgabe verknüpft/);

    await user.type(
      screen.getByRole("textbox", { name: /Beitrag in Euro/ }),
      "250,00",
    );

    expect(
      await screen.findByText(/keine passende, noch freie Ausgabe/),
    ).toBeInTheDocument();
  });
});
