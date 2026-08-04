import { forwardRef, type SelectHTMLAttributes } from "react";

import { classNames } from "../../lib/class-names";
import { FormField, type FieldChromeProps } from "./FormField";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  FieldChromeProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { children, className, error, hint, id, label, required, ...selectProps },
    ref,
  ) {
    return (
      <FormField
        error={error}
        hint={hint}
        id={id}
        label={label}
        required={required}
      >
        {({ describedBy, fieldId }) => (
          <select
            {...selectProps}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={classNames("ui-control", "ui-select", className)}
            id={fieldId}
            ref={ref}
            required={required}
          >
            {children}
          </select>
        )}
      </FormField>
    );
  },
);
