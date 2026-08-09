import { useContext, useRef, useState, type ChangeEvent } from "react";

import { Button, Card, Dialog } from "../../components/ui";
import {
  maximumBackupBytes,
  type PersonalOsBackup,
} from "../../db/backup/format";
import {
  personalOsBackupService,
  type BackupPreview,
  type BackupService,
} from "../../db/backup/service";
import { downloadBackup } from "./download-backup";
import { AppSettingsContext } from "./settings-context";
import "./backup-panel.css";

const countLabels: Record<keyof BackupPreview["counts"], string> = {
  settings: "Einstellungen",
  tasks: "Aufgaben",
  habits: "Gewohnheiten",
  habitEntries: "Habit-Check-ins",
  journalEntries: "Journaleinträge",
  goals: "Ziele",
  goalMilestones: "Meilensteine",
  financeCategories: "Finanzkategorien",
  transactions: "Buchungen",
  monthlyBudgets: "Monatsbudgets",
  savingsGoals: "Sparziele",
  savingsContributions: "Sparbeiträge",
  scoreSettings: "Score-Einstellungen",
  scoreSnapshots: "Score-Snapshots",
  hiddenInsights: "Ausgeblendete Insights",
  recurringTransactions: "Buchungsvorlagen",
};

export type BackupPanelProps = {
  download?: (backup: PersonalOsBackup) => void;
  service?: BackupService;
};

export function BackupPanel({
  download = downloadBackup,
  service = personalOsBackupService,
}: BackupPanelProps) {
  const [preview, setPreview] = useState<BackupPreview>();
  const [fileName, setFileName] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appSettings = useContext(AppSettingsContext);

  async function exportData() {
    setIsExporting(true);
    setError(undefined);
    setMessage(undefined);
    try {
      download(await service.create());
      setMessage("Der vollständige Export wurde erstellt.");
    } catch {
      setError(
        "Der Export konnte nicht erstellt werden. Deine Daten wurden nicht verändert.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setError(undefined);
    setMessage(undefined);
    setPreview(undefined);
    setFileName(file.name);
    try {
      if (file.size > maximumBackupBytes) {
        throw new Error("Backup file exceeds the local size limit.");
      }
      setPreview(service.parse(await file.text()));
    } catch {
      setFileName(undefined);
      setError(
        "Das Backup ist ungültig, unbekannt oder enthält widersprüchliche Daten. Lokal wurde nichts verändert.",
      );
    }
  }

  async function restoreData() {
    if (!preview) return;
    setIsRestoring(true);
    setError(undefined);
    try {
      await service.replace(preview, (safetyBackup) => download(safetyBackup));
      // Der Import ersetzt auch den Settings-Datensatz. Zeitzone, Währung und
      // Theme kommen deshalb aus dem Backup, nicht aus dem bisherigen Stand.
      await appSettings?.reload().catch(() => undefined);
      setPreview(undefined);
      setFileName(undefined);
      setIsRestoreDialogOpen(false);
      setMessage("Das Backup wurde vollständig wiederhergestellt und geprüft.");
    } catch {
      setIsRestoreDialogOpen(false);
      setError(
        "Das Backup konnte nicht wiederhergestellt werden. Die bisherigen lokalen Daten bleiben erhalten.",
      );
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <Card
      description="Erstelle einen vollständigen lokalen Export oder prüfe ein Backup vor der Wiederherstellung."
      title="Backup und Wiederherstellung"
    >
      <div className="backup-actions">
        <Button isLoading={isExporting} onClick={() => void exportData()}>
          Vollständigen Export herunterladen
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="secondary"
        >
          Backup-Datei prüfen
        </Button>
        <input
          accept="application/json,.json"
          aria-label="Backup-Datei auswählen"
          className="visually-hidden"
          onChange={(event) => void selectBackup(event)}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />
      </div>

      {error ? (
        <p className="backup-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="backup-message" role="status">
          {message}
        </p>
      ) : null}

      {preview ? (
        <section
          className="backup-preview"
          aria-labelledby="backup-preview-title"
        >
          <div>
            <p className="state-kicker">Geprüfte Importvorschau</p>
            <h3 id="backup-preview-title">{fileName}</h3>
            <p>
              Format {preview.formatVersion} · {preview.totalRecords} Datensätze
              · Export vom {formatInstant(preview.exportedAt)}
            </p>
            {preview.period ? (
              <p>
                Datenzeitraum: {formatInstant(preview.period.from)} bis{" "}
                {formatInstant(preview.period.to)}
              </p>
            ) : null}
          </div>
          <dl className="backup-counts">
            {Object.entries(preview.counts).map(([tableName, count]) => (
              <div key={tableName}>
                <dt>{countLabels[tableName as keyof typeof countLabels]}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          {preview.warnings.length > 0 ? (
            <ul className="backup-warnings">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <Button onClick={() => setIsRestoreDialogOpen(true)} variant="danger">
            Lokale Daten durch Backup ersetzen
          </Button>
        </section>
      ) : null}

      <Dialog
        actions={
          <>
            <Button
              disabled={isRestoring}
              onClick={() => setIsRestoreDialogOpen(false)}
              variant="secondary"
            >
              Abbrechen
            </Button>
            <Button
              isLoading={isRestoring}
              loadingLabel="Backup wird wiederhergestellt …"
              onClick={() => void restoreData()}
              variant="danger"
            >
              Sicherheitsbackup laden und ersetzen
            </Button>
          </>
        }
        description="Zuerst wird automatisch ein Export der aktuellen lokalen Daten heruntergeladen. Danach ersetzt das geprüfte Backup alle lokalen Datensätze."
        onClose={() => {
          if (!isRestoring) setIsRestoreDialogOpen(false);
        }}
        open={isRestoreDialogOpen}
        title="Lokale Daten vollständig ersetzen?"
      >
        <p>Zusammenführen ist im MVP bewusst nicht verfügbar.</p>
      </Dialog>
    </Card>
  );
}

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
