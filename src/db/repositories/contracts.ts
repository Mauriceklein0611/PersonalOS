import type { EntityMeta } from "../types";

export type ListOptions = {
  includeArchived?: boolean;
};

export type EntityPatch<TEntity extends EntityMeta> = Partial<
  Omit<TEntity, keyof EntityMeta>
>;

export interface ReadRepository<TEntity extends EntityMeta> {
  get(id: string): Promise<TEntity | undefined>;
  list(options?: ListOptions): Promise<TEntity[]>;
  require(id: string): Promise<TEntity>;
}

export interface Repository<
  TEntity extends EntityMeta,
  TCreate,
> extends ReadRepository<TEntity> {
  archive(id: string): Promise<TEntity>;
  create(input: TCreate): Promise<TEntity>;
  deletePermanently(id: string): Promise<void>;
  restore(id: string): Promise<TEntity>;
  update(id: string, patch: EntityPatch<TEntity>): Promise<TEntity>;
}
