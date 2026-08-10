import { useState, type FormEvent } from "react";

import {
  Button,
  Checkbox,
  IconButton,
  Input,
  Select,
} from "../../../components/ui";
import { isCategoryNameValid } from "../finance-form-values";
import {
  financeKindLabels,
  financeKinds,
  type FinanceCategory,
  type FinanceCategoryDetails,
  type FinanceKind,
} from "../model";

export type CategorySectionProps = {
  categories: readonly FinanceCategory[];
  onCreate: (details: FinanceCategoryDetails) => Promise<boolean>;
  onToggleFixedCost: (category: FinanceCategory, isFixedCost: boolean) => void;
  onRemove: (category: FinanceCategory) => void;
};

export function CategorySection({
  categories,
  onCreate,
  onToggleFixedCost,
  onRemove,
}: CategorySectionProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FinanceKind>("expense");
  const [isFixedCost, setIsFixedCost] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCategoryNameValid(name)) {
      setError("Gib einen Namen mit mindestens einem Zeichen ein.");
      return;
    }

    setError(undefined);
    const created = await onCreate({
      kind,
      name: name.trim(),
      ...(kind === "expense" && isFixedCost ? { isFixedCost: true } : {}),
    });
    if (created) {
      setName("");
      setIsFixedCost(false);
    }
  }

  return (
    <section className="page-section">
      <h2>Kategorien</h2>
      <p className="finance-hint">
        Die Startwerte sind Beispiele. Eine Kategorie mit Buchungen wird
        archiviert statt gelöscht, damit keine Buchung ihren Bezug verliert.
      </p>
      <form
        className="finance-category-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <Input
          error={error}
          label="Neue Kategorie"
          onChange={(event) => {
            setName(event.currentTarget.value);
            setError(undefined);
          }}
          value={name}
        />
        <Select
          label="Art der Kategorie"
          onChange={(event) =>
            setKind(event.currentTarget.value as FinanceKind)
          }
          value={kind}
        >
          {financeKinds.map((entry) => (
            <option key={entry} value={entry}>
              {financeKindLabels[entry]}
            </option>
          ))}
        </Select>
        {/* Nur Ausgaben können Fixkosten sein; bei Einnahmen wäre die Frage
            sinnlos. */}
        {kind === "expense" ? (
          <Checkbox
            checked={isFixedCost}
            label="Fixkosten"
            onChange={(event) => setIsFixedCost(event.currentTarget.checked)}
          />
        ) : null}
        <Button type="submit" variant="secondary">
          Kategorie anlegen
        </Button>
      </form>

      <ul className="finance-list">
        {categories.map((category) => (
          <li key={category.id}>
            <div className="finance-list-copy">
              <h3>{category.name}</h3>
              <p>{financeKindLabels[category.kind]}</p>
              {/* Auch die Startkategorien müssen sich pflegen lassen, sonst
                  bliebe „frei verfügbar" dauerhaft ohne Grundlage. */}
              {category.kind === "expense" ? (
                <Checkbox
                  checked={category.isFixedCost === true}
                  label={`„${category.name}“ sind Fixkosten`}
                  onChange={(event) =>
                    onToggleFixedCost(category, event.currentTarget.checked)
                  }
                />
              ) : null}
            </div>
            <IconButton
              label={`Kategorie „${category.name}“ entfernen`}
              onClick={() => onRemove(category)}
            >
              ×
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
