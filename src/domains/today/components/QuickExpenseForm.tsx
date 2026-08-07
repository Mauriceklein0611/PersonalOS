import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { useBaseCurrency } from "../../../app/settings/settings-context";
import { Button, Input, Select } from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import { parseMoneyInput } from "../../../lib/money/money";
/*
 * Das Dashboard ist die domänenübergreifende Fläche (ADR 0007). Es greift
 * deshalb auf den Finanz-Service und dessen Modell zu, niemals auf eine
 * Oberfläche der Finanzdomäne.
 */
import type { FinanceCategory } from "../../finance/model";
import {
  personalOsFinanceService,
  type FinanceService,
} from "../../finance/service";

const amountMessages: Record<string, string> = {
  empty: "Gib einen Betrag ein, zum Beispiel 12,50.",
  format: "Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 12,50.",
  precision: "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 12,50.",
};

export type QuickExpenseFormProps = {
  /** Meldet die gespeicherte Ausgabe, damit die Seite Toast und Undo führt. */
  onSaved: (transactionId: string, amount: string) => void;
  service?: FinanceService;
  today: CalendarDay;
};

/**
 * Ausgaben-Schnellerfassung: Betrag und Kategorie, alles Weitere ist bereits
 * entschieden. Das Datum ist heute; wer ein anderes braucht, bucht im
 * Finanzbereich. Ohne gepflegte Ausgabenkategorie bleibt die Erfassung
 * deaktiviert — eine erfundene Kategorie wäre eine stille Falschangabe.
 */
export function QuickExpenseForm({
  onSaved,
  service = personalOsFinanceService,
  today,
}: QuickExpenseFormProps) {
  const currency = useBaseCurrency();
  const [categories, setCategories] = useState<FinanceCategory[]>();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void service.listCategories().then(
      (stored) => {
        if (!isCurrent) return;
        setCategories(stored.filter((entry) => entry.kind === "expense"));
      },
      () => {
        if (isCurrent) setCategories([]);
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [service]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const money = parseMoneyInput(amount, currency);
    if (!money.ok) {
      setError(amountMessages[money.reason] ?? amountMessages.format);
      return;
    }
    if (categoryId.length === 0) {
      setError("Wähle eine Kategorie.");
      return;
    }

    setError(undefined);
    setIsSaving(true);
    try {
      const created = await service.createTransaction({
        bookedOn: today,
        categoryId,
        kind: "expense",
        money: money.money,
      });
      setAmount("");
      onSaved(created.id, amount);
    } catch {
      setError("Die Ausgabe konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  if (categories !== undefined && categories.length === 0) {
    return (
      <section className="today-quick-expense" data-span="full">
        <h2>Ausgabe erfassen</h2>
        <p className="today-status">
          Dafür fehlt noch eine Ausgabenkategorie. PersonalOS legt keine für
          dich an, weil eine erfundene Kategorie deine Auswertung verfälschen
          würde.
        </p>
        <Link to="/finanzen">Kategorie im Finanzbereich anlegen</Link>
      </section>
    );
  }

  return (
    <section className="today-quick-expense" data-span="full">
      <h2>Ausgabe erfassen</h2>
      <form
        className="today-quick-expense-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <Input
          error={error}
          hint={`Wird auf heute gebucht, in ${currency}.`}
          inputMode="decimal"
          label="Betrag der Ausgabe"
          onChange={(event) => {
            setAmount(event.currentTarget.value);
            setError(undefined);
          }}
          required
          value={amount}
        />
        <Select
          label="Kategorie der Ausgabe"
          onChange={(event) => {
            setCategoryId(event.currentTarget.value);
            setError(undefined);
          }}
          required
          value={categoryId}
        >
          <option value="">Bitte wählen</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Button
          disabled={categories === undefined}
          isLoading={isSaving}
          loadingLabel="Ausgabe wird gespeichert …"
          type="submit"
        >
          Ausgabe buchen
        </Button>
      </form>
    </section>
  );
}
