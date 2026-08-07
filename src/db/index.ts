export {
  PersonalOsDatabase,
  personalOsDatabase,
  personalOsDatabaseName,
} from "./database";
export {
  backupFormatVersion,
  createBackupFilename,
  maximumBackupBytes,
  personalOsBackupSchema,
  type PersonalOsBackup,
} from "./backup/format";
export {
  createBackupService,
  personalOsBackupService,
  type BackupPreview,
  type BackupService,
} from "./backup/service";
export {
  PersistenceError,
  toPersistenceError,
  type PersistenceErrorCode,
} from "./errors";
export {
  createDatabaseLifecycle,
  DatabaseStartupError,
  personalOsDatabaseLifecycle,
  type DatabaseLifecycle,
  type DatabaseSeed,
} from "./lifecycle";
export {
  createLocalDataService,
  personalOsLocalDataService,
  type LocalDataService,
} from "./local-data/service";
export {
  personalOsSchemaV1,
  personalOsSchemaV2,
  personalOsSchemaV3,
  personalOsSchemaV4,
  personalOsSchemaV5,
  personalOsSchemaVersion,
  personalOsTableNames,
  type PersonalOsTableName,
} from "./schema";
export {
  createDefaultSettingsDetails,
  settingsDetailsSchema,
  settingsSchema,
  type Settings,
  type SettingsDetails,
} from "./schemas/settings";
export {
  createSettingsRepository,
  personalOsSettingsRepository,
  seedSettingsRecord,
  type SettingsRepository,
} from "./settings/repository";
export { runInTransaction, type TransactionTableNames } from "./transactions";
export {
  createEntityMeta,
  entityMetaSchema,
  touchEntity,
  type EntityMeta,
  type StoredEntity,
} from "./types";
export type {
  EntityPatch,
  ListOptions,
  ReadRepository,
  Repository,
} from "./repositories/contracts";
export {
  DexieRepository,
  type DexieRepositoryOptions,
} from "./repositories/dexie-repository";
