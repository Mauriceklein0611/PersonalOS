import { useState, type FormEvent } from "react";

import { Button, EmptyState, Input, Select } from "../../../components/ui";
import {
  formatMoney,
  parseMoneyInput,
  type Money,
} from "../../../lib/money/money";
import {
  financeKindLabels,
  financeKinds,
  type FinanceCategory,
  type FinanceKind,
  type RecurringTransaction,
  type RecurringTransactionDetails,
} from "../model";
import type { DueRecurringTransaction } from "../recurring";
import { formatDay } from "./format";

export type RecurringSectionProps = {
  categories: FinanceCategory[];
  categoriesById: ReadonlyMap<string, FinanceCategory>;
  currency: string;
  due: DueRecurringTransaction[];
  onArchive: (template: RecurringTransaction) => Promise<void>;
  onConfirm: (due: DueRecurringTransaction) => Promise<boolean>;
  onCreate: (details: RecurringTransactionDetails) => Promise<boolean>;
  templates: RecurringTransaction[];
};

type RecurringFormValues = {
  amount: string;
  categoryId: string;
  dayOfMonth: string;
  kind: FinanceKind;
  name: string;
};

const emptyForm: RecurringFormValues = {
  amount: "",
  categoryId: "",
  dayOfMonth: "1",
  kind: "expense",
  name: "",
};

/**
 * Vorlagen sind Vorschläge. Dieser Abschnitt bucht nichts von sich aus; jede
 * Buchung entsteht aus einem Klick auf „Übernehmen". Siehe
 * [ADR 0013](../../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
 */
export function RecurringSection({
  categories,
  categoriesById,
  currency,
  due,
  onArchive,
  onConfirm,
  onCreate,
  templates,
}: RecurringSectionProps) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (name.length === 0) {
      setError("Gib der Vorlage einen Namen.");
      return;
    }
    if (form.categoryId === "") {
      setError("Wähle eine Kategorie.");
      return;
    }
    const amount = parseMoneyInput(form.amount, currency);
    if (!amount.ok) {
      setError("Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 12,50.");
      return;
    }
    const dayOfMonth = Number(form.dayOfMonth);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      setError("Wähle einen Monatstag zwischen 1 und 28.");
      return;
    }

    setError(undefined);
    const saved = await onCreate({
      categoryId: form.categoryId,
      dayOfMonth,
      kind: form.kind,
      money: amount.money as Money,
      name,
    });
    if (saved) setForm(emptyForm);
  }

  return (
    <section
      aria-labelledby="finance-recurring-title"
      className="page-section finance-recurring"
      data-span="full"
    >
      <h2 id="finance-recurring-title">Wiederkehrende Buchungen</h2>
      <p className="finance-note">
        Eine Vorlage bucht nie von selbst. Fällige Vorlagen stehen hier als
        Vorschlag und warten auf deine Bestätigung.
      </p>

      {due.length === 0 ? (
        <p className="finance-note" role="status">
          In diesem Monat ist keine Vorlage offen.
        </p>
      ) : (
        <ul className="finance-recurring-due">
          {due.map((entry) => (
            <li key={entry.template.id}>
              <div className="finance-recurring-copy">
                <h3>{entry.template.name}</h3>
                <p>
                  {financeKindLabels[entry.template.kind]} über{" "}
                  {formatMoney(entry.template.money)} ·{" "}
                  {categoriesById.get(entry.template.categoryId)?.name ??
                    "Kategorie entfernt"}{" "}
                  · vorgeschlagen für {formatDay(entry.proposedDate)}
                </p>
              </div>
              <Button
                aria-label={`„${entry.template.name}“ als Buchung übernehmen`}
                disabled={busyId === entry.template.id}
                onClick={() => {
                  setBusyId(entry.template.id);
                  void onConfirm(entry).finally(() => setBusyId(undefined));
                }}
              >
                Übernehmen
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="finance-recurring-form"
        onSubmit={(event) => void submit(event)}
      >
        <Input
          label="Name der Vorlage"
          maxLength={200}
          onChange={(event) =>
            setForm({ ...form, name: event.currentTarget.value })
          }
          placeholder="Miete"
          value={form.name}
        />
        <Select
          label="Art der Vorlage"
          onChange={(event) =>
            setForm({
              ...form,
              categoryId: "",
              kind: event.currentTarget.value as FinanceKind,
            })
          }
          value={form.kind}
        >
          {financeKinds.map((kind) => (
            <option key={kind} value={kind}>
              {financeKindLabels[kind]}
            </option>
          ))}
        </Select>
        <Input
          inputMode="decimal"
          label={`Betrag der Vorlage in ${currency}`}
          onChange={(event) =>
            setForm({ ...form, amount: event.currentTarget.value })
          }
          value={form.amount}
        />
        <Select
          label="Kategorie der Vorlage"
          onChange={(event) =>
            setForm({ ...form, categoryId: event.currentTarget.value })
          }
          value={form.categoryId}
        >
          <option value="">Bitte wählen</option>
          {categories
            .filter((category) => category.kind === form.kind)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </Select>
        <Input
          hint="1 bis 28 — jeden Monat gibt es diesen Tag."
          inputMode="numeric"
          label="Monatstag"
          max={28}
          min={1}
          onChange={(event) =>
            setForm({ ...form, dayOfMonth: event.currentTarget.value })
          }
          type="number"
          value={form.dayOfMonth}
        />
        <Button type="submit">Vorlage anlegen</Button>
      </form>

      {error ? (
        <p className="page-alert" role="alert">
          {error}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <EmptyState
          description="Lege oben eine an, etwa für Miete oder ein Abo."
          title="Noch keine Vorlage"
        />
      ) : (
        <ul className="finance-recurring-list">
          {templates.map((template) => (
            <li key={template.id}>
              <span>
                {template.name} · {financeKindLabels[template.kind]} über{" "}
                {formatMoney(template.money)} · jeden {template.dayOfMonth}.
              </span>
              <Button
                aria-label={`Vorlage „${template.name}“ archivieren`}
                onClick={() => void onArchive(template)}
                variant="ghost"
              >
                Archivieren
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
