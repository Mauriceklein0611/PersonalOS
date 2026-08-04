import type { ReactNode } from "react";

export type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
  visual?: ReactNode;
};

export function EmptyState({
  action,
  description,
  title,
  visual,
}: EmptyStateProps) {
  return (
    <div className="ui-empty-state" role="note">
      {visual ? (
        <span className="ui-empty-state-visual" aria-hidden="true">
          {visual}
        </span>
      ) : null}
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="ui-empty-state-action">{action}</div> : null}
    </div>
  );
}
