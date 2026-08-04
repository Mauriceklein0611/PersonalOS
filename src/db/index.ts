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
  personalOsSchemaVersion,
  personalOsTableNames,
  type PersonalOsTableName,
} from "./schema";
export { settingsSchema, type Settings } from "./schemas/settings";
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
