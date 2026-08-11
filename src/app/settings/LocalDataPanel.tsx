import { useEffect, useState } from "react";

import { Button, Card, Dialog } from "../../components/ui";
import type { PersonalOsBackup } from "../../db/backup/format";
import {
  personalOsLocalDataService,
  type LocalDataService,
} from "../../db/local-data/service";
import { clearThemePreference } from "../theme/theme-preference";
import {
  formatStorageBytes,
  readBrowserStorageStatus,
  requestBrowserPersistence,
  type BrowserStorageStatus,
  type ReadBrowserStorageStatus,
  type RequestBrowserPersistence,
} from "./browser-storage-status";
import { downloadBackup } from "./download-backup";
import "./local-data-panel.css";

export type LocalDataPanelProps = {
  download?: (backup: PersonalOsBackup) => void;
  readStorageStatus?: ReadBrowserStorageStatus;
  reloadAfterClear?: () => void;
  requestPersistence?: RequestBrowserPersistence;
  service?: LocalDataService;
};

export function LocalDataPanel({
  download = downloadBackup,
  readStorageStatus = readBrowserStorageStatus,
  reloadAfterClear = reloadPage,
  requestPersistence = requestBrowserPersistence,
  service = personalOsLocalDataService,
}: LocalDataPanelProps) {
  const [recordCount, setRecordCount] = useState<number>();
  const [storageStatus, setStorageStatus] = useState<BrowserStorageStatus>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);
  const [clearComplete, setClearComplete] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isRequestingPersistence, setIsRequestingPersistence] = useState(false);
  const [persistenceRefused, setPersistenceRefused] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void Promise.all([service.countRecords(), readStorageStatus()]).then(
      ([nextRecordCount, nextStorageStatus]) => {
        if (isCurrent) {
          setRecordCount(nextRecordCount);
          setStorageStatus(nextStorageStatus);
        }
      },
      () => {
        if (isCurrent) {
          setLoadFailed(true);
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [readStorageStatus, service]);

  /*
   * Der Browser entscheidet, nicht die Anwendung. Deshalb wird der Status
   * danach neu gelesen, statt das erhoffte Ergebnis anzunehmen.
   */
  async function askForPersistence() {
    setIsRequestingPersistence(true);
    setPersistenceRefused(false);
    try {
      const granted = await requestPersistence();
      setStorageStatus(await readStorageStatus());
      setPersistenceRefused(granted !== true);
    } catch {
      setPersistenceRefused(true);
    } finally {
      setIsRequestingPersistence(false);
    }
  }

  async function clearLocalData() {
    setIsClearing(true);
    setClearFailed(false);
    try {
      await service.clearWithSafetyBackup((backup) => download(backup));
      clearThemePreference();
      setRecordCount(0);
      setClearComplete(true);
      setIsClearDialogOpen(false);
      reloadAfterClear();
    } catch {
      setClearFailed(true);
      setIsClearDialogOpen(false);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <Card
      description="Prüfe, wo PersonalOS Daten ablegt, und entferne sie nur mit einem vorherigen Sicherheitsbackup."
      headingLevel={2}
      title="Lokaler Speicher und Datenschutz"
    >
      <dl className="local-data-summary">
        <div>
          <dt>Speicherort</dt>
          <dd>Dieses Browserprofil auf diesem Gerät</dd>
        </div>
        <div>
          <dt>Lokale Datensätze</dt>
          <dd>{formatRecordCount(recordCount, loadFailed)}</dd>
        </div>
        <div>
          <dt>Website-Speicher</dt>
          <dd>{formatStorageEstimate(storageStatus)}</dd>
        </div>
        <div>
          <dt>Beständigkeit</dt>
          <dd>{formatPersistence(storageStatus.persisted)}</dd>
        </div>
      </dl>

      {storageStatus.persisted === false ? (
        <div className="local-data-persistence">
          <Button
            isLoading={isRequestingPersistence}
            loadingLabel="Anfrage läuft …"
            onClick={() => void askForPersistence()}
            variant="secondary"
          >
            Dauerhaften Speicher anfordern
          </Button>
          {persistenceRefused ? (
            <p className="local-data-message" role="status">
              Der Browser hat den dauerhaften Speicher nicht gewährt. Er
              entscheidet das selbst; eine installierte App und regelmäßige
              Nutzung machen es wahrscheinlicher. Ein aktueller Export bleibt
              der verlässlichere Schutz.
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="local-data-hint">
        Die App-Einstellungen zählen als eigener Datensatz mit. Sie entstehen
        beim ersten Start automatisch neu, auch nach einer Löschung.
      </p>

      <section className="local-privacy-note" aria-labelledby="privacy-title">
        <h3 id="privacy-title">Was local-first schützt – und was nicht</h3>
        <p>
          PersonalOS überträgt deine Einträge nicht automatisch und verwendet
          weder Konto noch Cloud-Synchronisation. Die lokale Datenbank ist aber
          nicht zusätzlich verschlüsselt und schützt nicht vor Personen oder
          Schadsoftware mit Zugriff auf dein Gerät und Browserprofil.
        </p>
        <ul>
          <li>
            Private oder Inkognito-Fenster löschen lokale Daten häufig beim
            Schließen.
          </li>
          <li>
            Browserbereinigung, Speicherdruck oder ein verlorenes Gerät können
            Daten entfernen.
          </li>
          <li>
            Nur regelmäßig extern aufbewahrte Exporte schützen vor einem
            vollständigen Verlust dieses Browserprofils.
          </li>
        </ul>
      </section>

      {clearFailed ? (
        <p className="local-data-error" role="alert">
          Die lokalen Daten wurden nicht gelöscht. Erstelle einen manuellen
          Export und versuche es erneut.
        </p>
      ) : null}
      {clearComplete ? (
        <p className="local-data-message" role="status">
          Die lokalen Daten wurden gelöscht. PersonalOS startet mit einem leeren
          Datenspeicher neu.
        </p>
      ) : null}

      <Button onClick={() => setIsClearDialogOpen(true)} variant="danger">
        Alle lokalen Daten löschen
      </Button>

      <Dialog
        actions={
          <>
            <Button
              disabled={isClearing}
              onClick={() => setIsClearDialogOpen(false)}
              variant="secondary"
            >
              Abbrechen
            </Button>
            <Button
              isLoading={isClearing}
              loadingLabel="Backup und Löschung werden vorbereitet …"
              onClick={() => void clearLocalData()}
              variant="danger"
            >
              Backup herunterladen und endgültig löschen
            </Button>
          </>
        }
        description="Zuerst wird automatisch ein vollständiger Export heruntergeladen. Erst danach löscht PersonalOS die lokale Datenbank und die lokale Theme-Einstellung."
        onClose={() => {
          if (!isClearing) setIsClearDialogOpen(false);
        }}
        open={isClearDialogOpen}
        title="Alle lokalen PersonalOS-Daten löschen?"
      >
        <p>
          Der Download bleibt außerhalb von PersonalOS bestehen. Ohne dieses
          Backup kann die Löschung nicht rückgängig gemacht werden.
        </p>
      </Dialog>
    </Card>
  );
}

function formatRecordCount(
  recordCount: number | undefined,
  loadFailed: boolean,
): string {
  if (loadFailed) return "Status nicht verfügbar";
  if (recordCount === undefined) return "Wird geprüft …";
  if (recordCount === 0) return "Noch keine lokalen Datensätze";
  if (recordCount === 1) return "1 lokaler Datensatz";
  return `${recordCount} lokale Datensätze`;
}

function formatStorageEstimate(status: BrowserStorageStatus): string {
  if (status.usage === undefined || status.quota === undefined) {
    return "Schätzung nicht verfügbar";
  }
  return `Ca. ${formatStorageBytes(status.usage)} von ${formatStorageBytes(status.quota)} für diese Website`;
}

function formatPersistence(persisted: boolean | undefined): string {
  if (persisted === true) return "Vom Browser als dauerhaft markiert";
  if (persisted === false)
    return "Best effort – kann bei Speicherdruck entfernt werden";
  return "Keine Browserangabe verfügbar";
}

function reloadPage() {
  window.location.reload();
}
