import { useId, type ReactNode } from "react";

export type FieldChromeProps = {
  error?: string;
  hint?: string;
  id?: string;
  label: string;
  required?: boolean;
};

type FormFieldProps = FieldChromeProps & {
  children: (metadata: {
    describedBy: string | undefined;
    errorId: string;
    fieldId: string;
    hintId: string;
  }) => ReactNode;
};

export function FormField({
  children,
  error,
  hint,
  id,
  label,
  required,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ui-field">
      <label className="ui-field-label" htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children({
        describedBy: describedBy || undefined,
        errorId,
        fieldId,
        hintId,
      })}
      {hint ? (
        <span className="ui-field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="ui-field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
