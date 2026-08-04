import type { ReactNode } from "react";

import { classNames } from "../../lib/class-names";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

export type ToastProps = {
  action?: {
    label: string;
    onClick: () => void;
  };
  message: string;
  onDismiss?: () => void;
  title?: string;
  tone?: "info" | "success" | "error";
  visual?: ReactNode;
};

export function Toast({
  action,
  message,
  onDismiss,
  title,
  tone = "info",
  visual,
}: ToastProps) {
  return (
    <div
      className={classNames("ui-toast", `ui-toast-${tone}`)}
      role={tone === "error" ? "alert" : "status"}
    >
      {visual ? (
        <span className="ui-toast-visual" aria-hidden="true">
          {visual}
        </span>
      ) : null}
      <div className="ui-toast-copy">
        {title ? <strong>{title}</strong> : null}
        <span>{message}</span>
      </div>
      {action ? (
        <Button onClick={action.onClick} variant="ghost">
          {action.label}
        </Button>
      ) : null}
      {onDismiss ? (
        <IconButton label="Hinweis schließen" onClick={onDismiss}>
          ×
        </IconButton>
      ) : null}
    </div>
  );
}
