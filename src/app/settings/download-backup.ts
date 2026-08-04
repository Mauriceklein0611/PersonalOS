import {
  createBackupFilename,
  type PersonalOsBackup,
} from "../../db/backup/format";

export function downloadBackup(backup: PersonalOsBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = createBackupFilename(backup.exportedAt);
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
