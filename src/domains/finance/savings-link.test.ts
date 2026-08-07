import { describe, expect, it } from "vitest";

import type { SavingsContribution, Transaction } from "./model";
import {
  checkSavingsLink,
  findLinkableTransactions,
  type SavingsLinkSubject,
} from "./savings-link";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;
const instant = "2026-08-01T08:00:00.000Z";

const expense: Transaction = {
  bookedOn: "2026-08-05",
  categoryId: id("000000009601"),
  createdAt: instant,
  id: id("000000009602"),
  kind: "expense",
  money: { amountMinor: 25_000, currency: "EUR" },
  updatedAt: instant,
};

const subject: SavingsLinkSubject = {
  amountMinor: 25_000,
  bookedOn: "2026-08-20",
  currency: "EUR",
};

function contribution(
  overrides: Partial<SavingsContribution> = {},
): SavingsContribution {
  return {
    bookedOn: "2026-08-20",
    createdAt: instant,
    id: id("000000009603"),
    money: { amountMinor: 25_000, currency: "EUR" },
    savingsGoalId: id("000000009604"),
    updatedAt: instant,
    ...overrides,
  };
}

describe("checkSavingsLink", () => {
  it("accepts an expense of the same month, amount and currency", () => {
    expect(checkSavingsLink(expense, subject, [])).toEqual({ ok: true });
  });

  it("names why a booking cannot back a contribution", () => {
    expect(checkSavingsLink(undefined, subject, [])).toEqual({
      ok: false,
      reason: "unknown-transaction",
    });
    expect(
      checkSavingsLink({ ...expense, kind: "income" }, subject, []),
    ).toEqual({ ok: false, reason: "not-an-expense" });
    expect(
      checkSavingsLink(
        { ...expense, money: { amountMinor: 25_000, currency: "CHF" } },
        subject,
        [],
      ),
    ).toEqual({ ok: false, reason: "different-currency" });
    expect(
      checkSavingsLink(
        { ...expense, money: { amountMinor: 24_000, currency: "EUR" } },
        subject,
        [],
      ),
    ).toEqual({ ok: false, reason: "different-amount" });
    expect(
      checkSavingsLink({ ...expense, bookedOn: "2026-07-05" }, subject, []),
    ).toEqual({ ok: false, reason: "different-month" });
  });

  it("treats an archived booking as gone", () => {
    expect(
      checkSavingsLink(
        { ...expense, archivedAt: "2026-08-21T08:00:00.000Z" },
        subject,
        [],
      ),
    ).toEqual({ ok: false, reason: "unknown-transaction" });
  });

  /*
   * Ein zurückgenommener Beitrag behält seinen Verweis. Gäbe die Prüfung die
   * Ausgabe wieder frei, entstünden zwei Beiträge auf derselben Buchung.
   */
  it("keeps a booking claimed by an archived contribution", () => {
    const claimed = [
      contribution({
        archivedAt: "2026-08-21T08:00:00.000Z",
        sourceTransactionId: expense.id,
      }),
    ];

    expect(checkSavingsLink(expense, subject, claimed)).toEqual({
      ok: false,
      reason: "already-linked",
    });
  });

  it("lets the edited contribution keep its own booking", () => {
    const claimed = [contribution({ sourceTransactionId: expense.id })];

    expect(checkSavingsLink(expense, subject, claimed, claimed[0]!.id)).toEqual(
      {
        ok: true,
      },
    );
  });
});

describe("findLinkableTransactions", () => {
  it("offers only the bookings that would be accepted", () => {
    const otherAmount = {
      ...expense,
      id: id("000000009605"),
      money: { amountMinor: 10_000, currency: "EUR" },
    };
    const income: Transaction = {
      ...expense,
      id: id("000000009606"),
      kind: "income",
    };
    const taken = { ...expense, id: id("000000009607") };

    const candidates = findLinkableTransactions(
      [expense, otherAmount, income, taken],
      subject,
      [contribution({ sourceTransactionId: taken.id })],
    );

    expect(candidates.map((entry) => entry.id)).toEqual([expense.id]);
  });

  it("offers nothing without any booking", () => {
    expect(findLinkableTransactions([], subject, [])).toEqual([]);
  });
});
