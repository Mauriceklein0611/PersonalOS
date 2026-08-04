import { useId } from "react";

import { journalScaleValues } from "../model";

type JournalScaleFieldProps = {
  hint: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

/**
 * Native Radios statt eines nachgebauten Widgets: Der Wert ist damit ohne
 * zusätzliche ARIA-Logik per Tastatur erreichbar. „Keine Angabe“ ist eine
 * gleichwertige Option und kein Nullwert.
 */
export function JournalScaleField({
  hint,
  label,
  onChange,
  value,
}: JournalScaleFieldProps) {
  const groupName = useId();
  const hintId = `${groupName}-hint`;

  return (
    <fieldset aria-describedby={hintId} className="journal-scale-field">
      <legend>{label}</legend>
      <span className="ui-field-hint" id={hintId}>
        {hint}
      </span>
      <div className="journal-scale-options">
        {journalScaleValues.map((scaleValue) => (
          <label className="journal-scale-option" key={scaleValue}>
            <input
              aria-label={`${scaleValue} von 5`}
              checked={value === String(scaleValue)}
              name={groupName}
              onChange={() => onChange(String(scaleValue))}
              type="radio"
              value={scaleValue}
            />
            <span aria-hidden="true">{scaleValue}</span>
          </label>
        ))}
        <label className="journal-scale-option journal-scale-option-empty">
          <input
            aria-label="Keine Angabe"
            checked={value === ""}
            name={groupName}
            onChange={() => onChange("")}
            type="radio"
            value=""
          />
          <span aria-hidden="true">Keine Angabe</span>
        </label>
      </div>
    </fieldset>
  );
}
