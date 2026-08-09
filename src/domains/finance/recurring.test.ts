import { describe, expect, it } from "vitest";

import { buildEntityMeta, buildMoney } from "../../test/factories/entity";
import type { RecurringTransaction, Transaction } from "./model";
import {
  buildTransactionFromTemplate,
  getProposedDate,
  isConfirmedInMonth,
  listDueRecurringTransactions,
} from "./recurring";

const categoryId = "00000000-0000-4000-8000-000000007001";

function buildTemplate(
  suffix: string,
  overrides: Partial<RecurringTransaction> = {},
): RecurringTransaction {
  return {
    ...buildEntityMeta({ id: `00000000-0000-4000-8000-00000000710${suffix}` }),
    categoryId,
    dayOfMonth: 1,
    kind: "expense",
    money: buildMoney({ amountMinor: 95_000 }),
    name: `Vorlage ${suffix}`,
    ...overrides,
  };
}

function buildTransaction(
  suffix: string,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    ...buildEntityMeta({ id: `00000000-0000-4000-8000-00000000720${suffix}` }),
    bookedOn: "2026-08-01",
    categoryId,
    kind: "expense",
    money: buildMoney({ amountMinor: 95_000 }),
    ...overrides,
  };
}

describe("listDueRecurringTransactions", () => {
  it("proposes a template once its day of month has come", () => {
    const template = buildTemplate("1", { dayOfMonth: 5 });

    expect(listDueRecurringTransactions([template], [], "2026-08-04")).toEqual(
      [],
    );
    expect(
      listDueRecurringTransactions([template], [], "2026-08-05"),
    ).toHaveLength(1);
  });

  // Ein verpasster Tag lässt den Vorschlag nicht verschwinden — sonst wäre die
  // Erinnerung genau dann weg, wenn sie gebraucht wird.
  it("keeps proposing until the end of the month", () => {
    const template = buildTemplate("2", { dayOfMonth: 5 });

    const due = listDueRecurringTransactions([template], [], "2026-08-31");

    expect(due).toHaveLength(1);
    // Vorgeschlagen wird der Monatstag, nicht der Stichtag.
    expect(due[0]!.proposedDate).toBe("2026-08-05");
  });

  it("drops a template that was already confirmed this month", () => {
    const template = buildTemplate("3", { dayOfMonth: 1 });
    const booked = buildTransaction("3", {
      bookedOn: "2026-08-01",
      recurringTransactionId: template.id,
    });

    expect(
      listDueRecurringTransactions([template], [booked], "2026-08-15"),
    ).toEqual([]);
  });

  // Der Monat entscheidet, nicht die Vorlage: Im Folgemonat steht sie wieder an.
  it("proposes the same template again in the next month", () => {
    const template = buildTemplate("4", { dayOfMonth: 1 });
    const booked = buildTransaction("4", {
      bookedOn: "2026-08-01",
      recurringTransactionId: template.id,
    });

    const due = listDueRecurringTransactions(
      [template],
      [booked],
      "2026-09-02",
    );

    expect(due).toHaveLength(1);
    expect(due[0]!.proposedDate).toBe("2026-09-01");
  });

  /**
   * Die Rücknahme einer Buchung war die Aussage, dass sie so nicht
   * stattgefunden hat. Also steht die Vorlage wieder offen.
   */
  it("proposes again once the booking was archived", () => {
    const template = buildTemplate("5", { dayOfMonth: 1 });
    const archived = buildTransaction("5", {
      archivedAt: "2026-08-02T10:00:00.000Z",
      bookedOn: "2026-08-01",
      recurringTransactionId: template.id,
    });

    expect(
      listDueRecurringTransactions([template], [archived], "2026-08-15"),
    ).toHaveLength(1);
  });

  it("ignores a booking of the same category that came from no template", () => {
    const template = buildTemplate("6", { dayOfMonth: 1 });
    const byHand = buildTransaction("6", { bookedOn: "2026-08-01" });

    expect(
      listDueRecurringTransactions([template], [byHand], "2026-08-15"),
    ).toHaveLength(1);
  });

  it("leaves out an archived template", () => {
    const template = buildTemplate("7", {
      archivedAt: "2026-07-01T10:00:00.000Z",
      dayOfMonth: 1,
    });

    expect(listDueRecurringTransactions([template], [], "2026-08-15")).toEqual(
      [],
    );
  });

  it("orders by day of month and then by name", () => {
    const templates = [
      buildTemplate("8", { dayOfMonth: 15, name: "Strom" }),
      buildTemplate("9", { dayOfMonth: 1, name: "Versicherung" }),
      buildTemplate("0", { dayOfMonth: 1, name: "Miete" }),
    ];

    expect(
      listDueRecurringTransactions(templates, [], "2026-08-20").map(
        (due) => due.template.name,
      ),
    ).toEqual(["Miete", "Versicherung", "Strom"]);
  });
});

describe("isConfirmedInMonth", () => {
  it("counts only a booking of the same template in the same month", () => {
    const template = buildTemplate("1");
    const otherTemplate = buildTemplate("2");

    const lastMonth = buildTransaction("1", {
      bookedOn: "2026-07-01",
      recurringTransactionId: template.id,
    });
    const otherTemplateBooking = buildTransaction("2", {
      bookedOn: "2026-08-01",
      recurringTransactionId: otherTemplate.id,
    });

    expect(
      isConfirmedInMonth(
        template,
        [lastMonth, otherTemplateBooking],
        "2026-08-15",
      ),
    ).toBe(false);
  });
});

describe("buildTransactionFromTemplate", () => {
  // Erkennbarkeit ist ein Akzeptanzkriterium: Die Buchung trägt ihre Herkunft.
  it("carries the template id and books on the proposed day", () => {
    const template = buildTemplate("1", {
      dayOfMonth: 3,
      description: "Monatlich",
      kind: "income",
    });
    const [due] = listDueRecurringTransactions([template], [], "2026-08-20");

    expect(buildTransactionFromTemplate(due!)).toEqual({
      bookedOn: "2026-08-03",
      categoryId,
      description: "Monatlich",
      kind: "income",
      money: template.money,
      recurringTransactionId: template.id,
    });
  });
});

describe("getProposedDate", () => {
  it("pads a single digit day of month", () => {
    expect(
      getProposedDate(buildTemplate("1", { dayOfMonth: 7 }), "2026-11-30"),
    ).toBe("2026-11-07");
  });
});
