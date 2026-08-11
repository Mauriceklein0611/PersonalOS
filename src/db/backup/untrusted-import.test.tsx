import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { backupDataFixture } from "../../test/fixtures/backup";
import type { PersonalOsDatabase } from "../database";
import { personalOsTableNames } from "../schema";
import { maximumBackupBytes } from "./format";
import { createBackupService } from "./service";

/**
 * Ein Import ist nicht vertrauenswürdig, Issue #29.
 *
 * Die Datei kann aus jeder Quelle stammen. Diese Prüfungen halten die drei
 * Zusagen aus `docs/PRIVACY_AND_SECURITY.md` fest: Ein Import kann keinen Code
 * ausführen, kein HTML einschleusen und keine Felder mitbringen, die das
 * Datenmodell nicht kennt.
 */
const scriptPayload = '<img src=x onerror="globalThis.__personalOsXss = true">';

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
  delete (globalThis as { __personalOsXss?: boolean }).__personalOsXss;
});

async function seed(target: PersonalOsDatabase): Promise<void> {
  for (const tableName of personalOsTableNames) {
    if (backupDataFixture[tableName].length > 0) {
      await target.table(tableName).bulkAdd(backupDataFixture[tableName]);
    }
  }
}

describe("untrusted backup import", () => {
  it("stores markup as text and renders it as text", async () => {
    await seed(database);
    const service = createBackupService(database);
    const backup = await service.create();
    backup.data.tasks[0]!.title = scriptPayload;

    const preview = service.parse(JSON.stringify(backup));
    await service.replace(preview, () => undefined);

    const [task] = await database.table("tasks").toArray();
    // Der Text bleibt Text — er wird weder ausgeführt noch entschärft.
    expect(task.title).toBe(scriptPayload);

    render(<p>{task.title}</p>);
    expect(screen.getByText(scriptPayload)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(
      (globalThis as { __personalOsXss?: boolean }).__personalOsXss,
    ).toBeUndefined();
  });

  /*
   * Ein Feld, das das Datenmodell nicht kennt, lässt den ganzen Import
   * scheitern — auch `__proto__`. Die Datei wird zurückgewiesen, bevor
   * irgendetwas geschrieben ist; ein stilles Verwerfen einzelner Felder würde
   * einen manipulierten Import als gültig durchgehen lassen.
   */
  it("refuses a record with a field the data model does not know", async () => {
    await seed(database);
    const service = createBackupService(database);
    const backup = await service.create();

    const withUnknownField = JSON.stringify(backup).replace(
      '"title":',
      '"unbekanntesFeld":"wird abgelehnt","title":',
    );
    expect(() => service.parse(withUnknownField)).toThrow();

    // `__proto__` als echter Schlüssel im JSON, nicht als Zuweisung.
    const withPrototypeKey = JSON.stringify(backup).replace(
      '"title":',
      '"__proto__":{"polluted":true},"title":',
    );
    expect(() => service.parse(withPrototypeKey)).toThrow();

    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("polluted");
    // Der Bestand ist unverändert: Geprüft wird vor dem Schreiben.
    expect(await database.table("tasks").count()).toBe(1);
  });

  it("refuses a file above the size limit before parsing it", async () => {
    const service = createBackupService(database);
    const oversized = `{"padding":"${"x".repeat(maximumBackupBytes)}"}`;

    expect(() => service.parse(oversized)).toThrow();
    expect(await database.table("tasks").count()).toBe(0);
  });

  it("refuses a file that is not a PersonalOS backup", async () => {
    const service = createBackupService(database);

    expect(() => service.parse("not json")).toThrow();
    expect(() =>
      service.parse(JSON.stringify({ format: "etwas anderes" })),
    ).toThrow();
    expect(() => service.parse(JSON.stringify([1, 2, 3]))).toThrow();
    expect(await database.table("tasks").count()).toBe(0);
  });
});
