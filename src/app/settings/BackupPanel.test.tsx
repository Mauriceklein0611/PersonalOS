import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createBackupEnvelope } from "../../db/backup/format";
import type { BackupPreview, BackupService } from "../../db/backup/service";
import { backupDataFixture } from "../../test/fixtures/backup";
import { BackupPanel } from "./BackupPanel";

const exportedAt = "2026-08-04T08:30:00.000Z";
const backup = createBackupEnvelope(exportedAt, backupDataFixture);
const preview: BackupPreview = {
  backup,
  counts: backup.counts,
  exportedAt,
  formatVersion: 1,
  period: {
    from: "2026-01-15T09:30:00.000Z",
    to: "2026-01-15T09:30:00.000Z",
  },
  totalRecords: 14,
  warnings: [],
};

describe("BackupPanel", () => {
  it("downloads a complete export after an explicit action", async () => {
    const user = userEvent.setup();
    const download = vi.fn();
    const service = createService();
    render(<BackupPanel download={download} service={service} />);

    await user.click(
      screen.getByRole("button", {
        name: "Vollständigen Export herunterladen",
      }),
    );

    expect(service.create).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledWith(backup);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Der vollständige Export wurde erstellt.",
    );
  });

  it("shows only a safe preview and requires confirmation before replace", async () => {
    const user = userEvent.setup();
    const download = vi.fn();
    const service = createService();
    render(<BackupPanel download={download} service={service} />);

    const file = new File([JSON.stringify(backup)], "synthetic-backup.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(JSON.stringify(backup)),
    });
    await user.upload(screen.getByLabelText("Backup-Datei auswählen"), file);

    expect(
      await screen.findByText("synthetic-backup.json"),
    ).toBeInTheDocument();
    expect(screen.getByText(/14 Datensätze/)).toBeInTheDocument();
    expect(
      screen.queryByText("Neutraler synthetischer Journaleintrag."),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Lokale Daten durch Backup ersetzen",
      }),
    );
    expect(service.replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", {
        name: "Lokale Daten vollständig ersetzen?",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Sicherheitsbackup laden und ersetzen",
      }),
    );

    expect(service.replace).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledWith(backup);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Das Backup wurde vollständig wiederhergestellt und geprüft.",
    );
  });

  it("does not offer replacement for invalid input", async () => {
    const user = userEvent.setup();
    const service = createService();
    vi.mocked(service.parse).mockImplementation(() => {
      throw new Error("private input details");
    });
    render(<BackupPanel service={service} />);

    const file = new File(["invalid"], "invalid.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("invalid"),
    });
    await user.upload(screen.getByLabelText("Backup-Datei auswählen"), file);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Das Backup ist ungültig",
    );
    expect(screen.queryByText("private input details")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Lokale Daten durch Backup ersetzen",
      }),
    ).not.toBeInTheDocument();
    expect(service.replace).not.toHaveBeenCalled();
  });
});

function createService(): BackupService {
  return {
    create: vi.fn().mockResolvedValue(backup),
    parse: vi.fn().mockReturnValue(preview),
    replace: vi.fn(async (_preview, onSafetyBackup) => {
      await onSafetyBackup(backup);
    }),
  };
}
