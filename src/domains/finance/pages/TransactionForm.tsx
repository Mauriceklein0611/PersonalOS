import { useState, type FormEvent } from "react";

import { Button, Input, Select, Textarea } from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import {
  createTransactionFormValues,
  toTransactionDetails,
  type TransactionFormErrors,
  type TransactionFormValues,
} from "../finance-form-values";
import {
  financeKindLabels,
  financeKinds,
  type FinanceCategory,
  type FinanceKind,
  type TransactionDetails,
} from "../model";

export type TransactionFormProps = {
  categories: readonly FinanceCategory[];
  currency: string;
  /** Meldet eine geprüfte Buchung; `true` bedeutet gespeichert. */
  onSubmit: (details: TransactionDetails) => Promise<boolean>;
  today: CalendarDay;
};

/**
 * Erfassen steht vor dem Auswerten: Diese Form ist der erste Abschnitt der
 * Seite. Sie hält ihre eigenen Eingaben, damit die Seite nur noch mit
 * geprüften Buchungen arbeitet.
 */
export function TransactionForm({
  categories,
  currency,
  onSubmit,
  today,
}: TransactionFormProps) {
  const [values, setValues] = useState<TransactionFormValues>(() =>
    createTransactionFormValues(today),
  );
  const [errors, setErrors] = useState<TransactionFormErrors>({});

  const selectableCategories = categories.filter(
    (category) => category.kind === values.kind,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = toTransactionDetails(values, currency);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    if (await onSubmit(result.details)) {
      setValues(createTransactionFormValues(today, values.kind));
    }
  }

  return (
    <section className="page-section" data-span="full">
      <h2>Buchung erfassen</h2>
      {/* Die eigene Prüfung nennt Problem und Korrektur; die native
        Browsermeldung würde sie nur verdecken. */}
      <form
        className="finance-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <Select
          label="Art"
          onChange={(event) => {
            const kind = event.currentTarget.value as FinanceKind;
            setValues((current) => ({ ...current, categoryId: "", kind }));
          }}
          value={values.kind}
        >
          {financeKinds.map((kind) => (
            <option key={kind} value={kind}>
              {financeKindLabels[kind]}
            </option>
          ))}
        </Select>
        <Input
          error={errors.amount}
          hint="Zum Beispiel 12,50. Die Richtung ergibt sich aus der Art."
          inputMode="decimal"
          label="Betrag in Euro"
          onChange={(event) => {
            const amount = event.currentTarget.value;
            setValues((current) => ({ ...current, amount }));
          }}
          required
          value={values.amount}
        />
        <Select
          error={errors.categoryId}
          label="Kategorie der Buchung"
          onChange={(event) => {
            const categoryId = event.currentTarget.value;
            setValues((current) => ({ ...current, categoryId }));
          }}
          required
          value={values.categoryId}
        >
          <option value="">Bitte wählen</option>
          {selectableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Input
          error={errors.bookedOn}
          label="Datum"
          onChange={(event) => {
            const bookedOn = event.currentTarget.value;
            setValues((current) => ({ ...current, bookedOn }));
          }}
          required
          type="date"
          value={values.bookedOn}
        />
        <Textarea
          hint="Optional, zum Beispiel ein kurzer Verwendungszweck."
          label="Notiz"
          onChange={(event) => {
            const description = event.currentTarget.value;
            setValues((current) => ({ ...current, description }));
          }}
          value={values.description}
        />
        <Button type="submit">Buchung speichern</Button>
      </form>
    </section>
  );
}
