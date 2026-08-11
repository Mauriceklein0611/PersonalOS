import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { classNames } from "../../lib/class-names";

export type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  /**
   * Ebene der Kartenüberschrift. Eine Karte innerhalb eines Abschnitts mit
   * `h2` bleibt bei `3`; steht sie direkt unter der Seitenüberschrift, gehört
   * ihr die `2`. Übersprungene Ebenen sind ein Fund des Accessibility-Audits.
   */
  headingLevel?: 2 | 3;
  title?: string;
  tone?: "default" | "muted";
};

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    children,
    className,
    description,
    footer,
    headingLevel = 3,
    title,
    tone = "default",
    ...articleProps
  },
  ref,
) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article
      {...articleProps}
      className={classNames(
        "ui-card",
        tone === "muted" && "ui-card-muted",
        className,
      )}
      ref={ref}
    >
      {title || description ? (
        <header className="ui-card-header">
          {title ? <Heading>{title}</Heading> : null}
          {description ? <p>{description}</p> : null}
        </header>
      ) : null}
      <div className="ui-card-content">{children}</div>
      {footer ? <footer className="ui-card-footer">{footer}</footer> : null}
    </article>
  );
});
