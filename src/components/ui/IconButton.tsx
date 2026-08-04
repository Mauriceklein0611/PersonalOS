import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { classNames } from "../../lib/class-names";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  children: ReactNode;
  label: string;
  variant?: "default" | "danger";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      className,
      label,
      type = "button",
      variant = "default",
      ...buttonProps
    },
    ref,
  ) {
    return (
      <button
        {...buttonProps}
        aria-label={label}
        className={classNames(
          "ui-icon-button",
          variant === "danger" && "ui-icon-button-danger",
          className,
        )}
        ref={ref}
        type={type}
      >
        <span aria-hidden="true">{children}</span>
      </button>
    );
  },
);
