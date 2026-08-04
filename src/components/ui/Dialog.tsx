import {
  useEffect,
  useId,
  useRef,
  type DialogHTMLAttributes,
  type ReactNode,
} from "react";

import { classNames } from "../../lib/class-names";
import { IconButton } from "./IconButton";

export type DialogProps = Omit<
  DialogHTMLAttributes<HTMLDialogElement>,
  "open" | "onClose" | "title"
> & {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function Dialog({
  actions,
  children,
  className,
  description,
  onClose,
  open,
  title,
  ...dialogProps
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  return (
    <dialog
      {...dialogProps}
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className={classNames("ui-dialog", className)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="ui-dialog-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <IconButton label="Dialog schließen" onClick={onClose}>
          ×
        </IconButton>
      </div>
      <div className="ui-dialog-content">{children}</div>
      {actions ? <div className="ui-dialog-actions">{actions}</div> : null}
    </dialog>
  );
}
