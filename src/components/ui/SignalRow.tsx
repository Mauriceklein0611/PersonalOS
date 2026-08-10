import type { ReactNode } from "react";

import { classNames } from "../../lib/class-names";

/**
 * `attention` heißt: Etwas ist über eine Schwelle gegangen und lohnt einen
 * Blick. `info` heißt: Es gibt etwas zu wissen, aber nichts ist überschritten.
 *
 * Bewusst zwei Stufen und kein Warnrot: Ein Signal ist eine Beobachtung, keine
 * Aufforderung. Eine dritte, dringlichere Stufe würde aus der Beobachtung eine
 * Bewertung machen.
 */
export type SignalTone = "attention" | "info";

export type SignalRowProps = {
  /**
   * Wohin der Blick als Nächstes geht, als fertiger Link. Der Baustein bleibt
   * dadurch frei vom Router, wie `EmptyState` auch.
   */
  action?: ReactNode;
  /** Der Signaltext. Eine Feststellung, kein Imperativ. */
  children: ReactNode;
  className?: string;
  tone?: SignalTone;
};

/**
 * Eine Zeile, keine Karte: Karten kosten senkrechten Raum, den mobil niemand
 * hat. Der farbige Rand links trägt die Stufe, der Text trägt die Aussage —
 * die Farbe ist damit nie die einzige Quelle.
 */
export function SignalRow({
  action,
  children,
  className,
  tone = "info",
}: SignalRowProps) {
  return (
    <li className={classNames("ui-signal-row", className)} data-tone={tone}>
      <p className="ui-signal-row-text">{children}</p>
      {action ? <p className="ui-signal-row-action">{action}</p> : null}
    </li>
  );
}
