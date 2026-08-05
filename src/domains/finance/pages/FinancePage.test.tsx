import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type {
  FinanceCategory,
  FinanceCategoryDetails,
  Transaction,
  TransactionDetails,
} from "../model";
import type { TransactionFilter } from "../repository";
import type { CategoryRemoval, FinanceService } from "../service";
import { FinancePage } from "./FinancePage";

const fixedNow = new Date("2026-08-04T10:00:00.000Z");

function renderPage(service: FinanceService) {
  return render(
    <FinancePage
      now={() => fixedNow}
      service={service}
      timeZone="Europe/Berlin"
    />,
  );
}

/** Kleiner In-Memory-Ersatz; die Persistenz ist im Repository-Test abgedeckt. */
function createMemoryFinanceService(): FinanceService {
  const categories: FinanceCategory[] = [];
  const transactions: Transaction[] = [];
  let sequence = 0;

  const nextId = () =>
    `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  const meta = () => ({
    createdAt: "2026-08-04T08:00:00.000Z",
    id: nextId(),
    updatedAt: "2026-08-04T08:00:00.000Z",
  });

  return {
    archiveCategory: async (id) => requireCategory(id),
    archiveTransaction: async (id) => {
      const entry = transactions.find((row) => row.id === id);
      if (!entry) throw new Error("unknown transaction");
      entry.archivedAt = "2026-08-04T09:00:00.000Z";
      return entry;
    },
    createCategory: async (details: FinanceCategoryDetails) => {
      const category = { ...meta(), ...details } as FinanceCategory;
      categories.push(category);
      return category;
    },
    createTransaction: async (details: TransactionDetails) => {
      const transaction = { ...meta(), ...details } as Transaction;
      transactions.push(transaction);
      return transaction;
    },
    listCategories: async () =>
      categories.filter((category) => category.archivedAt === undefined),
    listTransactions: async (filter: TransactionFilter = {}) =>
      transactions.filter(
        (entry) =>
          entry.archivedAt === undefined &&
          (filter.kind === undefined || entry.kind === filter.kind),
      ),
    removeCategory: async (id): Promise<CategoryRemoval> => {
      const category = requireCategorySync(id);
      const usageCount = transactions.filter(
        (entry) => entry.categoryId === id && entry.archivedAt === undefined,
      ).length;
      if (usageCount > 0) {
        category.archivedAt = "2026-08-04T09:00:00.000Z";
        return { category, kind: "archived", usageCount };
      }
      categories.splice(categories.indexOf(category), 1);
      return { categoryId: id, kind: "deleted" };
    },
    restoreCategory: async (id) => requireCategory(id),
    restoreTransaction: async (id) => {
      const entry = transactions.find((row) => row.id === id);
      if (!entry) throw new Error("unknown transaction");
      delete entry.archivedAt;
      return entry;
    },
    updateCategory: async (id) => requireCategory(id),
    updateTransaction: async (id) => {
      const entry = transactions.find((row) => row.id === id);
      if (!entry) throw new Error("unknown transaction");
      return entry;
    },
  };

  function requireCategorySync(id: string): FinanceCategory {
    const category = categories.find((row) => row.id === id);
    if (!category) throw new Error("unknown category");
    return category;
  }

  async function requireCategory(id: string): Promise<FinanceCategory> {
    return requireCategorySync(id);
  }
}

async function addExpense(amount: string, category: string) {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByRole("combobox", { name: "Art" }), [
    "expense",
  ]);
  await user.type(
    screen.getByRole("textbox", { name: /Betrag in Euro/ }),
    amount,
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: /Kategorie der Buchung/ }),
    [category],
  );
  await user.click(screen.getByRole("button", { name: "Buchung speichern" }));
}

describe("FinancePage", () => {
  it("offers editable default categories on first use", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);

    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });
    expect(await screen.findAllByText("Lebensmittel")).not.toHaveLength(0);
    expect(screen.getAllByText("Einkommen").length).toBeGreaterThan(0);
  });

  it("stores a German amount exactly and sums it into the totals", async () => {
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel");

    const expenseTile = screen
      .getByText("Ausgaben")
      .closest(".ui-metric-tile") as HTMLElement;
    expect(within(expenseTile).getByText(/12,50/)).toBeInTheDocument();

    const balanceTile = screen
      .getByText("Saldo")
      .closest(".ui-metric-tile") as HTMLElement;
    expect(within(balanceTile).getByText(/−.*12,50/)).toBeInTheDocument();
  });

  it("rejects an unreadable amount with a correction hint", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await user.type(
      screen.getByRole("textbox", { name: /Betrag in Euro/ }),
      "-5",
    );
    await user.click(screen.getByRole("button", { name: "Buchung speichern" }));

    expect(
      screen.getByText(
        "Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 12,50.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Wähle eine Kategorie.")).toBeInTheDocument();
  });

  it("filters the list by kind", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel");
    expect(screen.queryByText("Keine Buchung")).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Art der Buchung" }),
      ["income"],
    );

    expect(screen.getByText("Keine Buchung")).toBeInTheDocument();
  });

  it("archives a used category instead of breaking its bookings", async () => {
    const user = userEvent.setup();
    const service = createMemoryFinanceService();
    renderPage(service);
    await screen.findByRole("heading", { level: 2, name: "Buchung erfassen" });

    await addExpense("12,50", "Lebensmittel");
    await user.click(
      screen.getByRole("button", {
        name: "Kategorie „Lebensmittel“ entfernen",
      }),
    );

    expect(
      await screen.findByText(/wurde deshalb archiviert/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Die Buchungen bleiben erhalten/)).toBeVisible();
  });
});
