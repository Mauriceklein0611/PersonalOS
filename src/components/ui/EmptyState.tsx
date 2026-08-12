import type { ReactNode } from "react";

export type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  headingLevel?: 2 | 3;
  title: string;
  visual?: ReactNode;
};

export function EmptyState({
  action,
  description,
  headingLevel = 3,
  title,
  visual,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="ui-empty-state" role="note">
      {visual ? (
        <span className="ui-empty-state-visual" aria-hidden="true">
          {visual}
        </span>
      ) : null}
      <div>
        <Heading>{title}</Heading>
        <p>{description}</p>
      </div>
      {action ? <div className="ui-empty-state-action">{action}</div> : null}
    </div>
  );
}
