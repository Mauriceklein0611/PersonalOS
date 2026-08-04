export {
  PersonalOsDatabase,
  personalOsDatabase,
  personalOsDatabaseName,
} from "./database";
export {
  PersistenceError,
  toPersistenceError,
  type PersistenceErrorCode,
} from "./errors";
export {
  personalOsSchemaV1,
  personalOsSchemaVersion,
  personalOsTableNames,
  type PersonalOsTableName,
} from "./schema";
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
