import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import type { Repository } from "../../db/repositories/contracts";
import { DexieRepository } from "../../db/repositories/dexie-repository";
import { runInTransaction } from "../../db/transactions";
import type { EntityMeta, EntityMetadataDependencies } from "../../db/types";
import { createIsoInstant, systemClock } from "../../lib/dates/date-values";
import {
  hiddenInsightDetailsSchema,
  hiddenInsightSchema,
  type HiddenInsight,
  type HiddenInsightDetails,
} from "./insight-model";
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

export type HiddenInsightRepository = Repository<
  HiddenInsight,
  HiddenInsightDetails
> & {
  /** Ausblenden ist idempotent: Zweimal ausblenden bleibt ein Datensatz. */
  hide(insightId: string, ruleId: string): Promise<HiddenInsight>;
  listIds(): Promise<Set<string>>;
  show(insightId: string): Promise<boolean>;
};

export function createHiddenInsightRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): HiddenInsightRepository {
  const clock = dependencies.clock ?? systemClock;
  const records = new DexieRepository<HiddenInsight, HiddenInsightDetails>({
    clock: dependencies.clock,
    createEntity: (input: HiddenInsightDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: hiddenInsightDetailsSchema,
    database,
    entitySchema: hiddenInsightSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "hiddenInsights",
  });

  const find = async (insightId: string) =>
    (await records.list()).find((record) => record.insightId === insightId);

  return Object.assign(records, {
    async hide(insightId: string, ruleId: string) {
      return runInTransaction(database, ["hiddenInsights"], async () => {
        const existing = await find(insightId);
        if (existing !== undefined) return existing;
        return records.create({
          hiddenAt: createIsoInstant(clock.now()),
          insightId,
          ruleId,
        });
      });
    },
    async listIds() {
      return new Set((await records.list()).map((record) => record.insightId));
    },
    async show(insightId: string) {
      return runInTransaction(database, ["hiddenInsights"], async () => {
        const existing = await find(insightId);
        if (existing === undefined) return false;
        // Endgültig entfernen: Ein archivierter Datensatz würde den eindeutigen
        // Index dauerhaft belegen und ein erneutes Ausblenden verhindern.
        await records.deletePermanently(existing.id);
        return true;
      });
    },
  });
}

export const personalOsHiddenInsightRepository =
  createHiddenInsightRepository(personalOsDatabase);
