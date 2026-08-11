import { classNames } from "../../lib/class-names";

export type ViewPurposeProps = {
  className?: string;
  period: string;
  purpose: string;
  question: string;
};

/**
 * Erklärt eine fachlich ähnliche Ansicht direkt an ihrem Einstieg.
 *
 * Die Nutzerfrage unterscheidet die Ansicht, der Zweck nennt ihre Datenbasis
 * und der Zeitraum verhindert, dass mehrere Wochenflächen still verschiedene
 * Kalenderausschnitte zeigen.
 */
export function ViewPurpose({
  className,
  period,
  purpose,
  question,
}: ViewPurposeProps) {
  return (
    <div
      aria-label="Zweck dieser Ansicht"
      className={classNames("ui-view-purpose", className)}
      role="note"
    >
      <strong className="ui-view-purpose-question">{question}</strong>
      <span>{purpose}</span>
      <span className="ui-view-purpose-period">Zeitraum: {period}</span>
    </div>
  );
}
