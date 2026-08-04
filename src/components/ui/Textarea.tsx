import { forwardRef, type TextareaHTMLAttributes } from "react";

import { classNames } from "../../lib/class-names";
import { FormField, type FieldChromeProps } from "./FormField";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldChromeProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { className, error, hint, id, label, required, rows = 4, ...textareaProps },
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
          <textarea
            {...textareaProps}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={classNames("ui-control", "ui-textarea", className)}
            id={fieldId}
            ref={ref}
            required={required}
            rows={rows}
          />
        )}
      </FormField>
    );
  },
);
