import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { createMemoryFinanceService } from "../../../test/factories/finance";
import type { FinanceService } from "../../finance/service";
import { QuickExpenseForm } from "./QuickExpenseForm";

function renderForm(service: FinanceService, onSaved = vi.fn()) {
  render(
    <MemoryRouter>
      <QuickExpenseForm
        onSaved={onSaved}
        service={service}
        today="2026-08-04"
      />
    </MemoryRouter>,
  );
  return onSaved;
}

async function createExpenseCategory(service: FinanceService) {
  await service.createCategory({ kind: "expense", name: "Lebensmittel" });
  return service;
}

describe("QuickExpenseForm", () => {
  it("books an expense for today from amount and category alone", async () => {
    const user = userEvent.setup();
    const service = await createExpenseCategory(createMemoryFinanceService());
    const onSaved = renderForm(service);

    await user.type(
      await screen.findByRole("textbox", { name: /Betrag der Ausgabe/ }),
      "12,50",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Kategorie der Ausgabe/ }),
      [screen.getByRole("option", { name: "Lebensmittel" })],
    );
    await user.click(screen.getByRole("button", { name: "Ausgabe buchen" }));

    const [stored] = await service.listTransactions();
    expect(stored).toMatchObject({
      bookedOn: "2026-08-04",
      kind: "expense",
      money: { amountMinor: 1_250, currency: "EUR" },
    });
    expect(stored?.description).toBeUndefined();
    expect(onSaved).toHaveBeenCalledWith(stored?.id, "12,50");
  });

  it("names an unreadable amount and a missing category", async () => {
    const user = userEvent.setup();
    const service = await createExpenseCategory(createMemoryFinanceService());
    renderForm(service);

    await user.type(
      await screen.findByRole("textbox", { name: /Betrag der Ausgabe/ }),
      "12,345",
    );
    await user.click(screen.getByRole("button", { name: "Ausgabe buchen" }));
    expect(
      screen.getByText(
        "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 12,50.",
      ),
    ).toBeInTheDocument();

    await user.clear(
      screen.getByRole("textbox", { name: /Betrag der Ausgabe/ }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /Betrag der Ausgabe/ }),
      "12,50",
    );
    await user.click(screen.getByRole("button", { name: "Ausgabe buchen" }));

    expect(screen.getByText("Wähle eine Kategorie.")).toBeInTheDocument();
    expect(await service.listTransactions()).toEqual([]);
  });

  /*
   * Ohne gepflegte Kategorie bleibt die Erfassung erklärt deaktiviert. Eine
   * erfundene Kategorie wäre eine stille Falschangabe in der Auswertung.
   */
  it("explains itself instead of inventing a category", async () => {
    const service = createMemoryFinanceService();
    renderForm(service);

    expect(
      await screen.findByText(/fehlt noch eine Ausgabenkategorie/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ausgabe buchen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Kategorie im Bereich Geld anlegen" }),
    ).toHaveAttribute("href", "/geld");
  });

  it("keeps an income category out of the quick capture", async () => {
    const service = createMemoryFinanceService();
    await service.createCategory({ kind: "income", name: "Einkommen" });
    await service.createCategory({ kind: "expense", name: "Freizeit" });
    renderForm(service);

    await screen.findByRole("option", { name: "Freizeit" });
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Bitte wählen", "Freizeit"]);
  });
});
