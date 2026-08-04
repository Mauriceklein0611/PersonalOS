import { useEffect, useState, type ReactNode } from "react";

import { Button, Dialog } from "../../components/ui";
import {
  personalOsDatabaseLifecycle,
  type DatabaseLifecycle,
} from "../../db/lifecycle";

type DatabaseStatus = "loading" | "ready" | "recovery" | "resetting";

export type DatabaseGateProps = {
  children: ReactNode;
  lifecycle?: DatabaseLifecycle;
  reloadAfterReset?: () => void;
};

export function DatabaseGate({
  children,
  lifecycle = personalOsDatabaseLifecycle,
  reloadAfterReset = reloadPage,
}: DatabaseGateProps) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<DatabaseStatus>("loading");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);

  useEffect(() => {
    let isCurrentAttempt = true;

    void lifecycle.open().then(
      () => {
        if (isCurrentAttempt) {
          setStatus("ready");
        }
      },
      () => {
        if (isCurrentAttempt) {
          setStatus("recovery");
        }
      },
    );

    return () => {
      isCurrentAttempt = false;
    };
  }, [attempt, lifecycle]);

  if (status === "ready") {
    return children;
  }

  if (status === "loading") {
    return (
      <main className="centered-state" role="status" aria-live="polite">
        <p className="state-kicker">Lokaler Speicher</p>
        <h1>Lokale Daten werden vorbereitet …</h1>
        <p>Bestehende Einträge bleiben während der Prüfung unverändert.</p>
      </main>
    );
  }

  async function resetDatabase() {
    setStatus("resetting");
    setResetFailed(false);

    try {
      await lifecycle.reset();
      reloadAfterReset();
    } catch {
      setStatus("recovery");
      setResetFailed(true);
      setIsResetDialogOpen(false);
    }
  }

  return (
    <main className="centered-state database-recovery" role="alert">
      <p className="state-kicker">Lokaler Speicher braucht Aufmerksamkeit</p>
      <h1>Die lokalen Daten konnten nicht aktualisiert werden.</h1>
      <p>
        Deine vorhandenen Daten wurden nicht gelöscht. PersonalOS zeigt die
        normale Oberfläche erst wieder an, wenn die lokale Datenbank sicher
        geöffnet werden kann.
      </p>
      <div className="database-recovery-note" role="note">
        <strong>Vor einem Reset</strong>
        <span>
          Bewahre einen vorhandenen Export auf. Ein neuer Export kann aus diesem
          Fehlerzustand noch nicht erstellt werden. Zurücksetzen entfernt alle
          lokalen PersonalOS-Daten auf diesem Gerät und kann nicht rückgängig
          gemacht werden.
        </span>
      </div>
      {resetFailed ? (
        <p className="database-recovery-error">
          Die lokalen Daten konnten nicht zurückgesetzt werden. Schließe andere
          geöffnete PersonalOS-Fenster und versuche es erneut.
        </p>
      ) : null}
      <div className="database-recovery-actions">
        <Button
          disabled={status === "resetting"}
          onClick={() => {
            setResetFailed(false);
            setStatus("loading");
            setAttempt((currentAttempt) => currentAttempt + 1);
          }}
        >
          Erneut versuchen
        </Button>
        <Button
          disabled={status === "resetting"}
          onClick={() => setIsResetDialogOpen(true)}
          variant="danger"
        >
          Lokale Daten zurücksetzen
        </Button>
      </div>
      <Dialog
        actions={
          <>
            <Button
              disabled={status === "resetting"}
              onClick={() => setIsResetDialogOpen(false)}
              variant="secondary"
            >
              Abbrechen
            </Button>
            <Button
              isLoading={status === "resetting"}
              loadingLabel="Lokale Daten werden zurückgesetzt …"
              onClick={() => void resetDatabase()}
              variant="danger"
            >
              Endgültig zurücksetzen
            </Button>
          </>
        }
        description="Alle lokalen PersonalOS-Daten auf diesem Gerät werden dauerhaft gelöscht."
        onClose={() => setIsResetDialogOpen(false)}
        open={isResetDialogOpen}
        title="Lokale Daten wirklich zurücksetzen?"
      >
        <p>Dieser Schritt kann nicht rückgängig gemacht werden.</p>
      </Dialog>
    </main>
  );
}

function reloadPage() {
  window.location.reload();
}
