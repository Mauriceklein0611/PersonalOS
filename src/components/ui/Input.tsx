import { forwardRef, type InputHTMLAttributes } from "react";

import { classNames } from "../../lib/class-names";
import { FormField, type FieldChromeProps } from "./FormField";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> &
  FieldChromeProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, hint, id, label, required, ...inputProps },
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
        <input
          {...inputProps}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={classNames("ui-control", className)}
          id={fieldId}
          ref={ref}
          required={required}
        />
      )}
    </FormField>
  );
});
