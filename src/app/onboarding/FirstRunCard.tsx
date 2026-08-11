import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { Button } from "../../components/ui";
import type { FirstRunProgress } from "./first-run";
import "./first-run-card.css";

export type FirstRunOutcome = "completed" | "skipped";

export type FirstRunCardProps = {
  onDismiss: (outcome: FirstRunOutcome) => Promise<void>;
  progress: FirstRunProgress;
};

export function FirstRunCard({ onDismiss, progress }: FirstRunCardProps) {
  const [busyOutcome, setBusyOutcome] = useState<FirstRunOutcome>();
  const [error, setError] = useState<string>();

  const dismiss = async (outcome: FirstRunOutcome) => {
    setBusyOutcome(outcome);
    setError(undefined);
    try {
      await onDismiss(outcome);
    } catch {
      setError(
        "Die Entscheidung konnte nicht lokal gespeichert werden. Die Einrichtung bleibt sichtbar.",
      );
      setBusyOutcome(undefined);
    }
  };

  return (
    <section aria-labelledby="first-run-title" className="first-run-card">
      <div className="first-run-heading">
        <div>
          <p className="first-run-eyebrow">Start auf diesem Gerät</p>
          <h2 id="first-run-title">PersonalOS lokal einrichten</h2>
        </div>
        <strong className="first-run-progress">
          {progress.requiredDone} von 2 Grundlagen
        </strong>
      </div>

      <p className="first-run-privacy">
        Aufgaben, Routinen, Journal und Finanzen bleiben in diesem
        Browserprofil. Die bereitgestellte Website lädt nur die App – auch eine
        Exerivo-Adresse synchronisiert deine Daten nicht mit anderen Geräten.
      </p>

      <ol className="first-run-steps">
        <FirstRunStep
          action={<a href="#today-quick-task">Aufgabe hier erfassen</a>}
          complete={progress.taskCreated}
          description="Gibt der Tagesansicht einen ersten konkreten Fokus."
          title="Erste Aufgabe"
        />
        <FirstRunStep
          action={<Link to="/routinen/uebersicht">Routine anlegen</Link>}
          complete={progress.habitCreated}
          description="Macht den täglichen Check-in und den Wochenstatus nutzbar."
          title="Erste Routine"
        />
        <FirstRunStep
          action={<Link to="/geld">Finanzkategorie anlegen</Link>}
          complete={progress.financeCategoryCreated}
          description="Optional – nötig, bevor du eine Ausgabe buchen möchtest."
          optional
          title="Finanzen vorbereiten"
        />
      </ol>

      {progress.requiredComplete ? (
        <p className="first-run-next-step" role="note">
          Dein Tagesablauf ist startklar. Erstelle unter{" "}
          <Link to="/einstellungen">Einstellungen</Link> einen ersten Export.
          Wenn dein Browser die Installation anbietet, kannst du PersonalOS
          danach wie eine App öffnen.
        </p>
      ) : null}

      {error ? (
        <p className="first-run-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="first-run-actions">
        <Button
          disabled={!progress.requiredComplete || busyOutcome !== undefined}
          isLoading={busyOutcome === "completed"}
          onClick={() => void dismiss("completed")}
        >
          Einrichtung abschließen
        </Button>
        <Button
          disabled={busyOutcome !== undefined}
          isLoading={busyOutcome === "skipped"}
          onClick={() => void dismiss("skipped")}
          variant="secondary"
        >
          Überspringen
        </Button>
      </div>
    </section>
  );
}

type FirstRunStepProps = {
  action: ReactNode;
  complete: boolean;
  description: string;
  optional?: boolean;
  title: string;
};

function FirstRunStep({
  action,
  complete,
  description,
  optional = false,
  title,
}: FirstRunStepProps) {
  return (
    <li data-complete={complete}>
      <span aria-hidden="true" className="first-run-step-marker">
        {complete ? "✓" : "○"}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        <span className="first-run-step-status">
          {complete ? "Vorhanden" : optional ? "Optional" : "Noch offen"}
        </span>
      </div>
      <div className="first-run-step-action">{action}</div>
    </li>
  );
}
