import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import type { Repository } from "../../db/repositories/contracts";
import { DexieRepository } from "../../db/repositories/dexie-repository";
import { runInTransaction } from "../../db/transactions";
import type { EntityMeta, EntityMetadataDependencies } from "../../db/types";
import {
  createDefaultScoreComponents,
  scoreSettingsDetailsSchema,
  scoreSettingsSchema,
  type ScoreSettings,
  type ScoreSettingsDetails,
} from "./score-model";

export type ScoreSettingsRepository = Repository<
  ScoreSettings,
  ScoreSettingsDetails
> & {
  /**
   * Der Score hat genau eine Konfiguration. Sie entsteht beim ersten Zugriff
   * mit den Standardgewichten, damit die Oberfläche nie einen leeren Zustand
   * behandeln muss.
   */
  loadOrCreate(): Promise<ScoreSettings>;
};

export function createScoreSettingsRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): ScoreSettingsRepository {
  const records = new DexieRepository<ScoreSettings, ScoreSettingsDetails>({
    clock: dependencies.clock,
    createEntity: (input: ScoreSettingsDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: scoreSettingsDetailsSchema,
    database,
    entitySchema: scoreSettingsSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "scoreSettings",
  });

  return Object.assign(records, {
    async loadOrCreate() {
      return runInTransaction(database, ["scoreSettings"], async () => {
        const [existing] = await records.list();
        if (existing !== undefined) return existing;
        return records.create({
          components: createDefaultScoreComponents(),
          enabled: true,
        });
      });
    },
  });
}

export const personalOsScoreSettingsRepository =
  createScoreSettingsRepository(personalOsDatabase);
