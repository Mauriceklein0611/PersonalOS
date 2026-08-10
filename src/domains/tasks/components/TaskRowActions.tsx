import { useId, useRef, useState, type ReactNode } from "react";

export type TaskRowActionsProps = {
  children: ReactNode;
  /** Zugänglicher Name der Schaltfläche, zum Beispiel mit dem Aufgabentitel. */
  label: string;
};

/**
 * Sekundäre Aktionen einer Aufgabenzeile hinter einer Ausklappfläche.
 *
 * Grundlage ist `<details>`/`<summary>`: Tastaturbedienung, Rolle und
 * Auf-/Zuklappen bringt der Browser mit, und es kostet keine
 * Laufzeitabhängigkeit. Ein nachgebautes Menü müsste Fokusfalle,
 * Pfeiltasten, Escape und Positionierung selbst lösen — für drei
 * Schaltflächen ein schlechter Tausch.
 *
 * Nach einer Aktion schließt die Fläche und der Fokus kehrt auf die
 * Schaltfläche zurück. Ohne das landete er im Nichts: Die Zeile darunter
 * verschwindet mit der Aktion aus der Liste.
 */
export function TaskRowActions({ children, label }: TaskRowActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const summary = useRef<HTMLElement>(null);
  const panelId = useId();

  const close = () => {
    setIsOpen(false);
    summary.current?.focus();
  };

  return (
    <details
      className="task-row-actions"
      onKeyDown={(event) => {
        // `<details>` schließt von sich aus nicht auf Escape. Für eine
        // Fläche, die wie ein Menü über der Zeile liegt, gehört das dazu.
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          close();
        }
      }}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary
        aria-label={label}
        className="task-row-actions-summary"
        ref={summary}
      >
        <span aria-hidden="true">⋯</span>
      </summary>
      {/*
        Die Fläche wird nur im geöffneten Zustand gerendert. Auf das Verbergen
        durch `<details>` allein ist kein Verlass: Der Inhalt liegt absolut
        positioniert, und was der Browser dann noch verbirgt, unterscheidet
        sich zwischen den Fassungen.

        Jede Aktion darin schließt sie. Der Klick wird beim Aufstieg
        abgefangen, damit die Schaltflächen nichts davon wissen müssen.
      */}
      {isOpen ? (
        <div
          className="task-row-actions-panel"
          id={panelId}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) {
              close();
            }
          }}
        >
          {children}
        </div>
      ) : null}
    </details>
  );
}
