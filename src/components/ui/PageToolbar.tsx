import type { ReactNode } from "react";

import { classNames } from "../../lib/class-names";

export type PageSurface = "editor" | "overview" | "settings" | "work";

export type PageToolbarProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  headingLevel?: 1 | 2;
  headingId?: string;
  period?: ReactNode;
  periodLabel?: string;
  surface: PageSurface;
  title: string;
};

/**
 * Gemeinsamer Einstieg einer Domainseite.
 *
 * Der Flächentyp steuert die Breite der umgebenden Route. Die Werkzeugleiste
 * selbst bleibt in jeder Domain gleich aufgebaut: Einordnung und Titel links,
 * Zeitraum und wenige Aktionen rechts. Fachliche Filter gehören in den
 * jeweiligen Inhalt und werden nicht in dieser Komponente erfunden.
 */
export function PageToolbar({
  actions,
  className,
  description,
  eyebrow,
  headingLevel = 1,
  headingId = "page-title",
  period,
  periodLabel = "Zeitraum",
  surface,
  title,
}: PageToolbarProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <header
      className={classNames("ui-page-toolbar", className)}
      data-surface={surface}
    >
      <div className="ui-page-toolbar-copy">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <Heading id={headingId}>{title}</Heading>
        {description ? (
          <p className="ui-page-toolbar-description">{description}</p>
        ) : null}
      </div>

      {period || actions ? (
        <div className="ui-page-toolbar-tools">
          {period ? (
            <p className="ui-page-toolbar-period">
              <span>{periodLabel}</span>
              <strong>{period}</strong>
            </p>
          ) : null}
          {actions ? (
            <div
              aria-label="Seitenaktionen"
              className="ui-page-toolbar-actions"
              role="group"
            >
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
