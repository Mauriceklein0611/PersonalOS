import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createBackupEnvelope } from "../../db/backup/format";
import type { LocalDataService } from "../../db/local-data/service";
import { themeStorageKey } from "../theme/theme-preference";
import { backupDataFixture } from "../../test/fixtures/backup";
import { LocalDataPanel } from "./LocalDataPanel";

const backup = createBackupEnvelope(
  "2026-08-04T10:00:00.000Z",
  backupDataFixture,
);

describe("LocalDataPanel", () => {
  it("shows honest local storage and persistence information", async () => {
    render(
      <LocalDataPanel
        readStorageStatus={() =>
          Promise.resolve({
            persisted: false,
            quota: 10 * 1024 * 1024,
            usage: 2 * 1024 * 1024,
          })
        }
        service={createService(14)}
      />,
    );

    expect(await screen.findByText("14 lokale Datensätze")).toBeVisible();
    expect(
      screen.getByText(/Ca\. 2 MB von 10 MB für diese Website/),
    ).toBeVisible();
    expect(screen.getByText(/Best effort/)).toBeVisible();
    expect(screen.getByText(/nicht zusätzlich verschlüsselt/)).toBeVisible();
  });

  it("requires confirmation and downloads a backup before clear", async () => {
    const user = userEvent.setup();
    const service = createService(1);
    const download = vi.fn();
    const reloadAfterClear = vi.fn();
    window.localStorage.setItem(themeStorageKey, "dark");
    render(
      <LocalDataPanel
        download={download}
        readStorageStatus={() => Promise.resolve({})}
        reloadAfterClear={reloadAfterClear}
        service={service}
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Alle lokalen Daten löschen",
      }),
    );
    expect(service.clearWithSafetyBackup).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", {
        name: "Alle lokalen PersonalOS-Daten löschen?",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Backup herunterladen und endgültig löschen",
      }),
    );

    expect(download).toHaveBeenCalledWith(backup);
    expect(service.clearWithSafetyBackup).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(themeStorageKey)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Die lokalen Daten wurden gelöscht",
    );
    expect(screen.getByText("Noch keine lokalen Datensätze")).toBeVisible();
    expect(reloadAfterClear).toHaveBeenCalledOnce();
  });

  it("does not expose private errors or report a successful clear", async () => {
    const user = userEvent.setup();
    const service = createService(1);
    vi.mocked(service.clearWithSafetyBackup).mockRejectedValue(
      new Error("private record content"),
    );
    render(
      <LocalDataPanel
        readStorageStatus={() => Promise.resolve({})}
        service={service}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Alle lokalen Daten löschen" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Backup herunterladen und endgültig löschen",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die lokalen Daten wurden nicht gelöscht",
    );
    expect(
      screen.queryByText("private record content"),
    ).not.toBeInTheDocument();
  });
});

function createService(recordCount: number): LocalDataService {
  return {
    clearWithSafetyBackup: vi.fn(async (onSafetyBackup) => {
      await onSafetyBackup(backup);
    }),
    countRecords: vi.fn().mockResolvedValue(recordCount),
  };
}
