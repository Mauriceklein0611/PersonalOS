import { Input } from "./Input";

export type SearchFieldProps = {
  hint?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Trefferansage, zum Beispiel „3 von 12 Aufgaben“. Sie steht in einem
   * Live-Bereich und wird beim Tippen vorgelesen.
   */
  resultLabel?: string;
  value: string;
};

/**
 * Freitextsuche über eine bereits sichtbare Liste. Das Feld beschriftet sich
 * sichtbar, nennt die Trefferzahl und speichert den Begriff nicht: Ohne
 * `autoComplete="off"` legt der Browser eine Formularhistorie des Suchbegriffs
 * an.
 */
export function SearchField({
  hint,
  id,
  label,
  onChange,
  placeholder,
  resultLabel,
  value,
}: SearchFieldProps) {
  return (
    <div className="ui-search-field">
      <Input
        autoComplete="off"
        hint={hint}
        id={id}
        label={label}
        maxLength={200}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {/* Der Bereich bleibt im Dokument, damit die erste Trefferzahl angesagt wird. */}
      <p className="ui-search-result" role="status">
        {resultLabel}
      </p>
    </div>
  );
}
