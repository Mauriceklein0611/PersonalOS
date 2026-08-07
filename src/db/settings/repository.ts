import { personalOsDatabase, type PersonalOsDatabase } from "../database";
import type { EntityPatch, Repository } from "../repositories/contracts";
import { DexieRepository } from "../repositories/dexie-repository";
import {
  createDefaultSettingsDetails,
  settingsDetailsSchema,
  settingsSchema,
  type Settings,
  type SettingsDetails,
} from "../schemas/settings";
import { runInTransaction } from "../transactions";
import type { EntityMeta, EntityMetadataDependencies } from "../types";

export type SettingsRepository = Repository<Settings, SettingsDetails> & {
  /**
   * PersonalOS hat genau einen Settings-Datensatz. Er entsteht beim ersten
   * Start und wird danach nur noch gelesen, damit Zeitzone, Währung und Theme
   * überall dieselbe Quelle haben.
   */
  loadOrCreate(): Promise<Settings>;
  /** Ändert den vorhandenen Datensatz und legt ihn bei Bedarf zuerst an. */
  save(patch: EntityPatch<Settings>): Promise<Settings>;
};

export function createSettingsRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): SettingsRepository {
  const records = new DexieRepository<Settings, SettingsDetails>({
    clock: dependencies.clock,
    createEntity: (input: SettingsDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: settingsDetailsSchema,
    database,
    entitySchema: settingsSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "settings",
  });

  /*
   * Auch archivierte Datensätze zählen: Ein zweiter Datensatz wäre eine
   * zweite Wahrheit, selbst wenn der erste nicht mehr sichtbar ist.
   */
  const findExisting = async () =>
    (await records.list({ includeArchived: true }))[0];

  return Object.assign(records, {
    async loadOrCreate() {
      return runInTransaction(database, ["settings"], async () => {
        const existing = await findExisting();
        if (existing !== undefined) return existing;
        return records.create(createDefaultSettingsDetails());
      });
    },
    async save(patch: EntityPatch<Settings>) {
      return runInTransaction(database, ["settings"], async () => {
        const existing = await findExisting();
        if (existing === undefined) {
          return records.create({
            ...createDefaultSettingsDetails(),
            ...patch,
          });
        }
        return records.update(existing.id, patch);
      });
    },
  });
}

export const personalOsSettingsRepository =
  createSettingsRepository(personalOsDatabase);

/**
 * Der Start-Seed. Er ist idempotent: Ein zweiter Start findet den vorhandenen
 * Datensatz und schreibt nicht erneut.
 */
export async function seedSettingsRecord(
  database: PersonalOsDatabase,
): Promise<void> {
  await createSettingsRepository(database).loadOrCreate();
}
