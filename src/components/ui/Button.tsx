import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { classNames } from "../../lib/class-names";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingLabel?: string;
  startIcon?: ReactNode;
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className,
      disabled,
      isLoading = false,
      loadingLabel = "Wird geladen …",
      startIcon,
      type = "button",
      variant = "primary",
      ...buttonProps
    },
    ref,
  ) {
    return (
      <button
        {...buttonProps}
        aria-busy={isLoading || undefined}
        className={classNames("ui-button", `ui-button-${variant}`, className)}
        disabled={disabled || isLoading}
        ref={ref}
        type={type}
      >
        {isLoading ? (
          <span className="ui-spinner" aria-hidden="true" />
        ) : (
          startIcon
        )}
        <span>{isLoading ? loadingLabel : children}</span>
      </button>
    );
  },
);
