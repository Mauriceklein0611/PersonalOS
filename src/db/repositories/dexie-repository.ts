import type { z } from "zod";

import {
  nextUpdatedAt,
  systemClock,
  type Clock,
} from "../../lib/dates/date-values";
import {
  createEntityId,
  entityIdSchema,
  type IdGenerator,
} from "../../lib/identifiers/entity-id";
import type { PersonalOsDatabase } from "../database";
import { PersistenceError, toPersistenceError } from "../errors";
import type { PersonalOsTableName } from "../schema";
import { createEntityMeta, type EntityMeta } from "../types";
import type { EntityPatch, ListOptions, Repository } from "./contracts";

export type DexieRepositoryOptions<TEntity extends EntityMeta, TCreate> = {
  clock?: Clock;
  createEntity: (input: TCreate, metadata: EntityMeta) => TEntity;
  createSchema: z.ZodType<TCreate>;
  database: PersonalOsDatabase;
  entitySchema: z.ZodType<TEntity>;
  idGenerator?: IdGenerator;
  tableName: PersonalOsTableName;
};

export class DexieRepository<
  TEntity extends EntityMeta,
  TCreate,
> implements Repository<TEntity, TCreate> {
  readonly #clock: Clock;
  readonly #createEntity: DexieRepositoryOptions<
    TEntity,
    TCreate
  >["createEntity"];
  readonly #createSchema: z.ZodType<TCreate>;
  readonly #database: PersonalOsDatabase;
  readonly #entitySchema: z.ZodType<TEntity>;
  readonly #idGenerator: IdGenerator;
  readonly #tableName: PersonalOsTableName;

  constructor(options: DexieRepositoryOptions<TEntity, TCreate>) {
    this.#clock = options.clock ?? systemClock;
    this.#createEntity = options.createEntity;
    this.#createSchema = options.createSchema;
    this.#database = options.database;
    this.#entitySchema = options.entitySchema;
    this.#idGenerator = options.idGenerator ?? createEntityId;
    this.#tableName = options.tableName;
  }

  async create(input: TCreate): Promise<TEntity> {
    try {
      const validInput = this.#parse(this.#createSchema, input);
      const metadata = createEntityMeta({
        clock: this.#clock,
        idGenerator: this.#idGenerator,
      });
      const entity = this.#parse(
        this.#entitySchema,
        this.#createEntity(validInput, metadata),
      );

      await this.#table().add(entity);
      return entity;
    } catch (error) {
      throw toPersistenceError(error);
    }
  }

  async get(id: string): Promise<TEntity | undefined> {
    try {
      const validId = this.#parse(entityIdSchema, id);
      const entity = await this.#table().get(validId);
      return entity === undefined
        ? undefined
        : this.#parse(this.#entitySchema, entity);
    } catch (error) {
      throw toPersistenceError(error);
    }
  }

  async require(id: string): Promise<TEntity> {
    const entity = await this.get(id);
    if (entity === undefined) {
      throw new PersistenceError("not-found");
    }
    return entity;
  }

  async list(options: ListOptions = {}): Promise<TEntity[]> {
    try {
      const entities = (await this.#table().toArray()).map((entity) =>
        this.#parse(this.#entitySchema, entity),
      );
      const visibleEntities = options.includeArchived
        ? entities
        : entities.filter((entity) => entity.archivedAt === undefined);

      return [...visibleEntities].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      );
    } catch (error) {
      throw toPersistenceError(error);
    }
  }

  async update(id: string, patch: EntityPatch<TEntity>): Promise<TEntity> {
    try {
      const current = await this.require(id);
      const entity = this.#parse(this.#entitySchema, {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: nextUpdatedAt(current.updatedAt, this.#clock),
        archivedAt: current.archivedAt,
      });

      await this.#table().put(entity);
      return entity;
    } catch (error) {
      throw toPersistenceError(error);
    }
  }

  async archive(id: string): Promise<TEntity> {
    try {
      const current = await this.require(id);
      if (current.archivedAt !== undefined) {
        return current;
      }

      const archivedAt = nextUpdatedAt(current.updatedAt, this.#clock);
      const entity = this.#parse(this.#entitySchema, {
        ...current,
        archivedAt,
        updatedAt: archivedAt,
      });

      await this.#table().put(entity);
      return entity;
    } catch (error) {
      throw toPersistenceError(error);
    }
  }

  async restore(id: string): Promise<TEntity> {
    try {
      const current = await this.require(id);
      if (current.archivedAt === undefined) {
        return current;
      }

      const activeFields = { ...current };
      delete activeFields.archivedAt;
      const entity = this.#parse(this.#entitySchema, {
        ...activeFields,
        updatedAt: nextUpdatedAt(current.updatedAt, this.#clock),
      });

      await this.#table().put(entity);
      return entity;
    } catch (error) {
      throw toPersistenceError(error);
    }
  }

  async deletePermanently(id: string): Promise<void> {
    try {
      await this.require(id);
      await this.#table().delete(id);
    } catch (error) {
      throw toPersistenceError(error);
    }
  }

  #parse<TValue>(schema: z.ZodType<TValue>, value: unknown): TValue {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new PersistenceError("validation", { cause: result.error });
    }
    return result.data;
  }

  #table() {
    return this.#database.tableFor<TEntity>(this.#tableName);
  }
}
