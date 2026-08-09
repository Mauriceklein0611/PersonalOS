import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { backupDataFixture } from "../../test/fixtures/backup";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import type { PersonalOsDatabase } from "../database";
import { personalOsTableNamesV1 } from "../schema";
import { backupFormatVersion, createBackupEnvelope } from "./format";
import { createBackupService } from "./service";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

const exportedAt = "2026-08-20T10:00:00.000Z";

/**
 * Ein Export im Format 1 kennt `hiddenInsights` nicht — weder in den Daten
 * noch in den Zahlen. Er muss weiterhin lesbar bleiben, siehe
 * [ADR 0010](../../../docs/decisions/0010-deterministic-insights-v1.md).
 */
function createVersionOneBackup() {
  const data = Object.fromEntries(
    personalOsTableNamesV1.map((tableName) => [
      tableName,
      backupDataFixture[tableName],
    ]),
  );
  const counts = Object.fromEntries(
    personalOsTableNamesV1.map((tableName) => [
      tableName,
      backupDataFixture[tableName].length,
    ]),
  );

  return {
    appVersion: "0.1.0",
    counts,
    data,
    exportedAt,
    format: "personalos",
    formatVersion: 1,
    schemaVersion: 3,
  };
}

/**
 * Ein Export im Format 2 kennt `sourceTransactionId` noch nicht. Er bleibt
 * lesbar; seine Beiträge sind schlicht mit keiner Buchung verknüpft. Siehe
 * [ADR 0011](../../../docs/decisions/0011-savings-contribution-links-a-transaction.md).
 */
function createVersionTwoBackup() {
  const envelope = createBackupEnvelope(exportedAt, withoutTemplates());
  return {
    ...envelope,
    counts: withoutTemplateCount(envelope.counts),
    formatVersion: 2,
  };
}

/**
 * Ein Export vor Format 4 kennt die Vorlagen nicht — weder in den Daten noch
 * in den Zahlen. Siehe
 * [ADR 0013](../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
 */
function withoutTemplates() {
  return { ...backupDataFixture, recurringTransactions: [] };
}

function withoutTemplateCount(counts: Record<string, number | undefined>) {
  const { recurringTransactions, ...rest } = counts;
  void recurringTransactions;
  return rest;
}

function createVersionThreeBackup() {
  const envelope = createBackupEnvelope(exportedAt, withoutTemplates());
  return {
    ...envelope,
    counts: withoutTemplateCount(envelope.counts),
    formatVersion: 3,
  };
}

/** Dieselben Daten, aber mit belegter Ausgabe – nur im Format 3 möglich. */
function createLinkedData() {
  return {
    ...backupDataFixture,
    savingsContributions: backupDataFixture.savingsContributions.map(
      (contribution) => ({
        ...contribution,
        sourceTransactionId: backupDataFixture.transactions[0]!.id,
      }),
    ),
  };
}

describe("Backup-Format", () => {
  it("writes new exports in version 4", () => {
    const envelope = createBackupEnvelope(exportedAt, backupDataFixture);

    expect(backupFormatVersion).toBe(4);
    expect(envelope.formatVersion).toBe(4);
    expect(envelope.counts.hiddenInsights).toBe(1);
    expect(envelope.counts.recurringTransactions).toBe(1);
  });

  // Ein Export vor Format 4 hat keine Vorlagen; seine Buchungen sind allesamt
  // von Hand erfasst.
  it("still reads a version 3 export as having no templates", () => {
    const service = createBackupService(database);

    const preview = service.parse(JSON.stringify(createVersionThreeBackup()));

    expect(preview.formatVersion).toBe(3);
    expect(preview.backup.data.recurringTransactions).toEqual([]);
    expect(
      preview.backup.data.transactions[0]!.recurringTransactionId,
    ).toBeUndefined();
    expect(preview.warnings).toEqual([]);
  });

  it("restores a version 3 export without losing a record", async () => {
    const service = createBackupService(database);
    const preview = service.parse(JSON.stringify(createVersionThreeBackup()));

    await service.replace(preview, () => undefined);

    expect(await database.table("transactions").count()).toBe(1);
    expect(await database.table("recurringTransactions").count()).toBe(0);
  });

  it("refuses a version 3 export that carries templates anyway", () => {
    const service = createBackupService(database);
    const tampered = {
      ...createVersionThreeBackup(),
      data: {
        ...createVersionThreeBackup().data,
        recurringTransactions: backupDataFixture.recurringTransactions,
      },
    };

    expect(() => service.parse(JSON.stringify(tampered))).toThrow();
  });

  it("round-trips a template and its booking in version 4", async () => {
    const service = createBackupService(database);
    const template = backupDataFixture.recurringTransactions[0]!;
    const data = {
      ...backupDataFixture,
      transactions: backupDataFixture.transactions.map((transaction) => ({
        ...transaction,
        recurringTransactionId: template.id,
      })),
    };
    const preview = service.parse(
      JSON.stringify(createBackupEnvelope(exportedAt, data)),
    );

    await service.replace(preview, () => undefined);

    const restored = await service.create();
    expect(restored.data.recurringTransactions).toEqual([template]);
    expect(restored.data.transactions[0]!.recurringTransactionId).toBe(
      template.id,
    );
  });

  it("still reads a version 2 export as unlinked contributions", () => {
    const service = createBackupService(database);

    const preview = service.parse(JSON.stringify(createVersionTwoBackup()));

    expect(preview.formatVersion).toBe(2);
    expect(
      preview.backup.data.savingsContributions[0]!.sourceTransactionId,
    ).toBeUndefined();
    expect(preview.warnings).toEqual([]);
  });

  it("round-trips a linked contribution in version 3", async () => {
    const service = createBackupService(database);
    const linked = createLinkedData();
    const preview = service.parse(
      JSON.stringify(createBackupEnvelope(exportedAt, linked)),
    );

    await service.replace(preview, () => undefined);

    const restored = await service.create();
    expect(restored.data.savingsContributions).toEqual(
      linked.savingsContributions,
    );
  });

  it("refuses a backup whose contribution points at a missing booking", () => {
    const service = createBackupService(database);
    const orphaned = {
      ...createLinkedData(),
      transactions: [],
    };

    expect(() =>
      service.parse(JSON.stringify(createBackupEnvelope(exportedAt, orphaned))),
    ).toThrow();
  });

  it("refuses two contributions that claim the same booking", () => {
    const service = createBackupService(database);
    const [contribution] = createLinkedData().savingsContributions;
    const doubled = {
      ...createLinkedData(),
      savingsContributions: [
        contribution!,
        { ...contribution!, id: "00000000-0000-4000-8000-000000000916" },
      ],
    };

    expect(() =>
      service.parse(JSON.stringify(createBackupEnvelope(exportedAt, doubled))),
    ).toThrow();
  });

  it("still reads a version 1 export and treats it as nothing hidden", () => {
    const service = createBackupService(database);

    const preview = service.parse(JSON.stringify(createVersionOneBackup()));

    expect(preview.formatVersion).toBe(1);
    expect(preview.backup.data.hiddenInsights).toEqual([]);
    expect(preview.backup.data.tasks).toHaveLength(1);
  });

  it("restores a version 1 export without losing a record", async () => {
    const service = createBackupService(database);
    const preview = service.parse(JSON.stringify(createVersionOneBackup()));

    await service.replace(preview, () => undefined);

    expect(await database.table("tasks").count()).toBe(1);
    expect(await database.table("hiddenInsights").count()).toBe(0);
  });

  it("refuses a version 1 export that carries hidden insights anyway", () => {
    const service = createBackupService(database);
    const tampered = {
      ...createVersionOneBackup(),
      data: {
        ...createVersionOneBackup().data,
        hiddenInsights: backupDataFixture.hiddenInsights,
      },
    };

    expect(() => service.parse(JSON.stringify(tampered))).toThrow();
  });

  it("keeps the count check strict for a version 2 export", () => {
    const service = createBackupService(database);
    const envelope = createBackupEnvelope(exportedAt, backupDataFixture);
    const tampered = {
      ...envelope,
      counts: { ...envelope.counts, hiddenInsights: 99 },
    };

    expect(() => service.parse(JSON.stringify(tampered))).toThrow();
  });

  it("round-trips a version 2 export including the hidden insights", async () => {
    const service = createBackupService(database);
    const envelope = createBackupEnvelope(exportedAt, backupDataFixture);
    const preview = service.parse(JSON.stringify(envelope));

    await service.replace(preview, () => undefined);

    expect(await database.table("hiddenInsights").count()).toBe(1);
    const restored = await service.create();
    expect(restored.data.hiddenInsights).toEqual(
      backupDataFixture.hiddenInsights,
    );
  });
});
