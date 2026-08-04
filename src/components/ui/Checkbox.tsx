import { forwardRef, useId, type InputHTMLAttributes } from "react";

import { classNames } from "../../lib/class-names";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  error?: string;
  hint?: string;
  label: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { className, error, hint, id, label, ...checkboxProps },
    ref,
  ) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = `${fieldId}-hint`;
    const errorId = `${fieldId}-error`;
    const describedBy = [hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="ui-checkbox-field">
        <label className="ui-checkbox-label" htmlFor={fieldId}>
          <input
            {...checkboxProps}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            className={classNames("ui-checkbox", className)}
            id={fieldId}
            ref={ref}
            type="checkbox"
          />
          <span>{label}</span>
        </label>
        {hint ? (
          <span className="ui-field-hint ui-checkbox-message" id={hintId}>
            {hint}
          </span>
        ) : null}
        {error ? (
          <span className="ui-field-error ui-checkbox-message" id={errorId}>
            {error}
          </span>
        ) : null}
      </div>
    );
  },
);
