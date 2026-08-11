import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { FirstRunCard } from "./FirstRunCard";
import { deriveFirstRunProgress } from "./first-run";

function renderCard(
  counts = { financeCategoryCount: 0, habitCount: 0, taskCount: 0 },
  onDismiss = vi.fn(async () => undefined),
) {
  render(
    <MemoryRouter>
      <FirstRunCard
        onDismiss={onDismiss}
        progress={deriveFirstRunProgress(counts)}
      />
    </MemoryRouter>,
  );
  return onDismiss;
}

describe("FirstRunCard", () => {
  it("explains a new local installation and offers three starts", () => {
    renderCard();

    expect(
      screen.getByRole("heading", { name: "PersonalOS lokal einrichten" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Exerivo-Adresse synchronisiert deine Daten nicht/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Aufgabe hier erfassen" }),
    ).toHaveAttribute("href", "#today-quick-task");
    expect(
      screen.getByRole("link", { name: "Routine anlegen" }),
    ).toHaveAttribute("href", "/routinen/uebersicht");
    expect(
      screen.getByRole("link", { name: "Finanzkategorie anlegen" }),
    ).toHaveAttribute("href", "/geld");
    expect(
      screen.getByRole("button", { name: "Einrichtung abschließen" }),
    ).toBeDisabled();
  });

  it("can be skipped without completing a step", async () => {
    const user = userEvent.setup();
    const onDismiss = renderCard();

    await user.click(screen.getByRole("button", { name: "Überspringen" }));

    expect(onDismiss).toHaveBeenCalledWith("skipped");
  });

  it("can be completed and explains backup and installation afterwards", async () => {
    const user = userEvent.setup();
    const onDismiss = renderCard({
      financeCategoryCount: 0,
      habitCount: 1,
      taskCount: 1,
    });

    expect(screen.getByText("2 von 2 Grundlagen")).toBeInTheDocument();
    expect(screen.getByText(/ersten Export/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Einrichtung abschließen" }),
    );

    expect(onDismiss).toHaveBeenCalledWith("completed");
  });
});
